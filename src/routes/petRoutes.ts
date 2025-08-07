import { Router } from "express";
import Pet from "../models/Pet";
import ActivityEntry from "../models/ActivityEntry";
import { verifyFirebaseToken } from "../middleware/auth";
import { computeMatchScore } from "../utils/matchAlgorithm";

const router = Router();

/**
 * @openapi
 * /pets/mine:
 *   get:
 *     summary: Get all pets owned by the authenticated user
 *     tags:
 *       - Pets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of pets per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: List of the user's pets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 pets:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Pet'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     offset:
 *                       type: number
 *                     hasMore:
 *                       type: boolean
 *         examples:
 *           example:
 *             value:
 *               success: true
 *               pets:
 *                 - id: "65b123abc123"
 *                   name: "Buddy"
 *                   species: "dog"
 *                   breed: "Golden Retriever"
 *                   vaccinated: true
 *                   microchipped: true
 *                   isLost: false
 *                   isFound: false
 *                   phoneNumbers: ["123-456-7890"]
 *               pagination:
 *                 total: 1
 *                 limit: 20
 *                 offset: 0
 *                 hasMore: false
 */
router.get("/mine", verifyFirebaseToken, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const user = (req as any).user;

  const query = { ownerId: user._id };

  const total = await Pet.countDocuments(query);
  const rawPets = await Pet.find(query)
    .skip(Number(offset))
    .limit(Number(limit));

  const pets = rawPets.map((pet) => ({
    id: pet._id.toString(),
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    age: Number(pet.age) || 0,
    birthday: pet.birthday,
    furColor: pet.furColor,
    eyeColor: pet.eyeColor,
    weight: {
      value: pet.weight?.value || 0,
      unit: pet.weight?.unit || "kg",
    },
    images: pet.images || [],
    description: pet.description,
    isLost: pet.isLost,
    isFound: pet.isFound,
    phoneNumbers: pet.phoneNumbers || [],
    vaccinated: pet.vaccinated,
    microchipped: pet.microchipped,
    registrationDate: pet.registrationDate,
  }));

  res.json({
    success: true,
    pets,
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
 * /pets:
 *   get:
 *     summary: List/Search pets
 *     tags:
 *       - Pets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: species
 *         schema:
 *           type: string
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
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of pets
 */
router.get("/", verifyFirebaseToken, async (req, res) => {
  const {
    species,
    location,
    radius,
    limit = 20,
    offset = 0,
    search,
  } = req.query;

  const query: any = {};
  if (species) query.species = species;
  if (search) query.name = { $regex: search, $options: "i" };

  let petsQuery = Pet.find(query);

  // Geo search if location & radius provided
  if (location && radius) {
    const [lat, lng] = (location as string).split(",").map(Number);
    petsQuery = petsQuery.where("location.coordinates").near({
      center: { type: "Point", coordinates: [lng, lat] },
      maxDistance: Number(radius) * 1000,
      spherical: true,
    });
  }

  const total = await Pet.countDocuments(query);
  const pets = await petsQuery.skip(Number(offset)).limit(Number(limit));

  res.json({
    success: true,
    pets,
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
 * /pets:
 *   post:
 *     summary: Register new pet
 *     tags:
 *       - Pets
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - species
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Buddy"
 *               species:
 *                 type: string
 *                 example: "dog"
 *               breed:
 *                 type: string
 *                 example: "Golden Retriever"
 *               age:
 *                 type: number
 *                 example: 3
 *               birthday:
 *                 type: string
 *                 format: date
 *                 example: "2021-05-10"
 *               furColor:
 *                 type: string
 *                 example: "golden"
 *               eyeColor:
 *                 type: string
 *                 example: "brown"
 *               weight:
 *                 type: object
 *                 properties:
 *                   value:
 *                     type: number
 *                     example: 20
 *                   unit:
 *                     type: string
 *                     example: "kg"
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["https://mypetapp.com/images/pet1.jpg"]
 *               description:
 *                 type: string
 *                 example: "Very friendly and energetic"
 *               isLost:
 *                 type: boolean
 *                 example: false
 *               isFound:
 *                 type: boolean
 *                 example: false
 *               phoneNumbers:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["123-456-7890"]
 *               address:
 *                 type: string
 *                 example: "123 Pet Street, New York, NY"
 *               lat:
 *                 type: number
 *                 example: 40.7128
 *               lng:
 *                 type: number
 *                 example: -74.0060
 *               vaccinated:
 *                 type: boolean
 *                 example: true
 *               microchipped:
 *                 type: boolean
 *                 example: true
 *           example:
 *             name: "Buddy"
 *             species: "dog"
 *             breed: "Golden Retriever"
 *             age: "3 years"
 *             birthday: "2021-05-10"
 *             furColor: "golden"
 *             eyeColor: "brown"
 *             weight:
 *               value: 25
 *               unit: "kg"
 *             images:
 *               - "https://mypetapp.com/images/pet1.jpg"
 *             description: "Very friendly and energetic"
 *             isLost: false
 *             isFound: false
 *             phoneNumbers:
 *               - "123-456-7890"
 *             address: "123 Pet Street, New York, NY"
 *             lat: 40.7128
 *             lng: -74.0060
 *             vaccinated: true
 *             microchipped: true
 *     responses:
 *       201:
 *         description: Pet registered
 */
router.post("/", verifyFirebaseToken, async (req, res) => {
  const user = (req as any).user;
  const {
    name,
    species,
    breed,
    age,
    birthday,
    furColor,
    eyeColor,
    weight,
    images,
    description,
    isLost,
    isFound,
    phoneNumbers,
    address,
    lat,
    lng,
    vaccinated,
    microchipped,
  } = req.body;

  if (!name || !species) {
    return res.status(400).json({ error: "name and species are required" });
  }

  const parsedAge = typeof age === "string" ? parseFloat(age) : age;

  const pet = await Pet.create({
    ownerId: user._id,
    name,
    species,
    breed,
    age: parsedAge || 0,
    birthday,
    furColor,
    eyeColor,
    weight: {
      value: weight?.value || 0,
      unit: weight?.unit || "kg",
    },
    images: images || [],
    description,
    isLost,
    isFound,
    phoneNumbers,
    location: {
      address: address || "",
      coordinates: {
        type: "Point",
        coordinates: lng && lat ? [lng, lat] : [0, 0],
      },
    },
    vaccinated,
    microchipped,
  });

  res.status(201).json({ success: true, pet });
});

/**
 * @openapi
 * /pets/{id}:
 *   get:
 *     summary: Get pet details
 *     tags:
 *       - Pets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pet details
 */
router.get("/:id", verifyFirebaseToken, async (req, res) => {
  const pet = await Pet.findById(req.params.id).populate("ownerId");
  if (!pet) return res.status(404).json({ error: "Pet not found" });
  res.json({ success: true, pet });
});

/**
 * @openapi
 * /pets/{id}:
 *   put:
 *     summary: Update pet
 *     tags:
 *       - Pets
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
 *     responses:
 *       200:
 *         description: Updated pet
 */
router.put("/:id", verifyFirebaseToken, async (req, res) => {
  const pet = await Pet.findById(req.params.id);
  if (!pet) return res.status(404).json({ error: "Pet not found" });

  if (pet.ownerId.toString() !== (req as any).user._id.toString()) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const allowedUpdates = [
    "name",
    "species",
    "breed",
    "age",
    "birthday",
    "furColor",
    "eyeColor",
    "weight",
    "images",
    "description",
    "phoneNumbers",
    "vaccinated",
    "microchipped",
    "isLost",
    "isFound",
    "matchResults",
  ];

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      (pet as any)[field] = req.body[field];
    }
  });

  if (req.body.lat && req.body.lng) {
    pet.location = {
      address: req.body.address || pet.location?.address || "",
      coordinates: {
        type: "Point",
        coordinates: [req.body.lng, req.body.lat],
      },
    };
  }

  await pet.save();
  res.json({ success: true, pet });
});

/**
 * @openapi
 * /pets/{id}:
 *   delete:
 *     summary: Delete pet
 *     tags:
 *       - Pets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pet deleted
 */
router.delete("/:id", verifyFirebaseToken, async (req, res) => {
  const pet = await Pet.findById(req.params.id);
  if (!pet) return res.status(404).json({ error: "Pet not found" });

  if (pet.ownerId.toString() !== (req as any).user._id.toString()) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await pet.deleteOne();
  res.json({ success: true, message: "Pet deleted successfully" });
});

/**
 * @openapi
 * /pets/match:
 *   post:
 *     summary: Find potential matches for a found pet
 *     tags:
 *       - Pets
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

  // Use isLost and isFound flags for filtering lost pets, no populate needed
  const lostPets = await Pet.find({ isLost: true, isFound: false });

  const matches = lostPets
    .map((entry) => {
      const lostPet = entry._id as any;
      const score = computeMatchScore(lostPet, foundPet);
      return { lostPet, lostEntry: entry, score };
    })
    .filter((match) => match.score >= 8) // Adjustable threshold
    .sort((a, b) => b.score - a.score);

  res.json({ success: true, matches });
});

/**
 * @openapi
 * /pets/{id}/confirm-match:
 *   post:
 *     summary: Confirm a match for a lost pet
 *     tags:
 *       - Pets
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
 *             required:
 *               - matchedPetId
 *             properties:
 *               matchedPetId:
 *                 type: string
 *                 description: The ID of the found pet that was matched
 *     responses:
 *       200:
 *         description: Match confirmed
 */
router.post("/:id/confirm-match", verifyFirebaseToken, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { matchedPetId } = req.body;

  if (!matchedPetId) {
    return res.status(400).json({ error: "matchedPetId is required" });
  }

  const pet = await Pet.findById(id);
  if (!pet) return res.status(404).json({ error: "Pet not found" });

  if (pet.ownerId.toString() !== user._id.toString()) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Reset flags on the lost pet
  pet.isLost = false;
  pet.isFound = false;
  pet.set("matchResults", []);
  await pet.save();

  // Remove this found pet from matchResults of other pets
  await Pet.updateMany(
    {
      _id: { $ne: pet._id },
      "matchResults.petId": matchedPetId,
    },
    {
      $pull: {
        matchResults: { petId: matchedPetId },
      },
    }
  );

  res.json({ success: true, message: "Match confirmed and others cleared" });
});

export default router;

/**
 * @openapi
 * /pets/matches:
 *   get:
 *     summary: Get match results for my lost pets
 *     tags:
 *       - Pets
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of matches
 */
router.get("/matches", verifyFirebaseToken, async (req, res) => {
  const user = (req as any).user;

  const lostPets = await Pet.find({ ownerId: user._id, isLost: true });

  const matchResults = lostPets.flatMap((pet) =>
    (pet.matchResults || []).map((match) => ({
      petId: pet._id,
      petName: pet.name,
      matchedPetId: match.petId,
      score: match.score,
      matchedAt: match.matchedAt,
    }))
  );

  matchResults.sort(
    (a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime()
  );

  res.json({ success: true, matches: matchResults });
});
