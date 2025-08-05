import { Router } from "express";
import LostPet from "../models/LostPet";
import Pet from "../models/Pet";
import { verifyFirebaseToken } from "../middleware/auth";
import { computeMatchScore } from "../utils/matchAlgorithm";

const router = Router();

/**
 * @openapi
 * /lost:
 *   post:
 *     summary: Report lost pet
 *     tags:
 *       - LostPets
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Lost pet reported
 */
router.post("/", verifyFirebaseToken, async (req, res) => {
  try {
    const lostPet = await LostPet.create({
      ...req.body,
      reporterId: (req as any).user._id,
    });

    if (lostPet.petId) {
      await Pet.findByIdAndUpdate(lostPet.petId, { isLost: true });
    }

    res.status(201).json({ success: true, lostPet });
  } catch (error) {
    console.error("Error reporting lost pet:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * @openapi
 * /lost:
 *   get:
 *     summary: List lost pets
 *     tags:
 *       - LostPets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: lat,lng
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: Radius in km
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of lost pets
 */
router.get("/", verifyFirebaseToken, async (req, res) => {
  const { location, radius, limit = 20, offset = 0, status } = req.query;
  const query: any = {};
  if (status) query.status = status;
  let lostPetsQuery = LostPet.find(query).populate({
    path: "petId",
    select: [
      "name",
      "species",
      "breed",
      "images",
      "age",
      "weight",
      "vaccinated",
      "microchipped",
      "furColor",
      "eyeColor",
      "description",
      "birthday",
      "registrationDate",
      "location",
    ].join(" "),
  });
  if (location && radius) {
    const [lat, lng] = (location as string).split(",").map(Number);
    lostPetsQuery = lostPetsQuery.where("location.coordinates").near({
      center: { type: "Point", coordinates: [lng, lat] },
      maxDistance: Number(radius) * 1000,
      spherical: true,
    });
  }
  const total = await LostPet.countDocuments(query);
  const lostPets = await lostPetsQuery
    .skip(Number(offset))
    .limit(Number(limit));
  res.json({
    success: true,
    lostPets,
    pagination: {
      total,
      limit: Number(limit),
      offset: Number(offset),
      hasMore: total > Number(offset) + Number(limit),
    },
  });
});

/**
 * @openapi
 * /lost/{id}/status:
 *   put:
 *     summary: Update lost pet status
 *     tags:
 *       - LostPets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lost pet status updated
 */
router.put("/:id/status", verifyFirebaseToken, async (req, res) => {
  const lostPet = await LostPet.findById(req.params.id);
  if (!lostPet) return res.status(404).json({ error: "Lost pet not found" });

  lostPet.status = req.body.status;
  await lostPet.save();

  if (lostPet.petId) {
    await Pet.findByIdAndUpdate(lostPet.petId, {
      isLost: lostPet.status === "lost",
    });
  }

  res.json({ success: true, lostPet });
});

/**
 * @openapi
 * /lost-pets/match:
 *   post:
 *     summary: Find potential matches for a found pet
 *     tags:
 *       - Lost Pets
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - species
 *               - location
 *             properties:
 *               name:
 *                 type: string
 *               species:
 *                 type: string
 *               breed:
 *                 type: string
 *               age:
 *                 type: string
 *               furColor:
 *                 type: string
 *               eyeColor:
 *                 type: string
 *               location:
 *                 type: object
 *                 required:
 *                   - coordinates
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                     example: [34.78, 32.07]
 *     responses:
 *       200:
 *         description: List of best-matching lost pets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 matches:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       score:
 *                         type: number
 *                       lostPet:
 *                         type: object
 *                       lostEntry:
 *                         type: object
 */
router.post("/match", verifyFirebaseToken, async (req, res) => {
  const foundPet = req.body;
  if (!foundPet || !foundPet.species || !foundPet.location?.coordinates) {
    return res.status(400).json({
      success: false,
      error: "Missing required pet data (species, coordinates)",
    });
  }

  const lostPets = await LostPet.find({ status: "lost" }).populate("petId");

  const matches = lostPets
    .map((entry) => {
      const lostPet = entry.petId as any;
      const score = computeMatchScore(lostPet, foundPet);
      return { lostPet, lostEntry: entry, score };
    })
    .filter((match) => match.score >= 8) // Adjustable threshold
    .sort((a, b) => b.score - a.score);

  res.json({ success: true, matches });
});

export default router;
