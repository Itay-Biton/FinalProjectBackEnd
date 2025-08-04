import { Router } from "express";
import Pet from "../models/Pet";
import ActivityEntry from "../models/ActivityEntry";
import { verifyFirebaseToken } from "../middleware/auth";

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
  const pets = await Pet.find(query).skip(Number(offset)).limit(Number(limit));
  console.log(pets);
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

  // Only admins can see all pets
  if ((req as any).user.role !== "admin") {
    query.ownerId = (req as any).user._id;
  }

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
 *                 type: string
 *                 example: "3 years"
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
 *                 type: string
 *                 example: "25kg"
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
 *               healthHistory:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       example: "2024-01-15"
 *                     event:
 *                       type: string
 *                       example: "Vaccination"
 *                     details:
 *                       type: string
 *                       example: "DHPP vaccine administered"
 *           example:
 *             name: "Buddy"
 *             species: "dog"
 *             breed: "Golden Retriever"
 *             age: "3 years"
 *             birthday: "2021-05-10"
 *             furColor: "golden"
 *             eyeColor: "brown"
 *             weight: "25kg"
 *             images:
 *               - "https://mypetapp.com/images/pet1.jpg"
 *             description: "Very friendly and energetic"
 *             isLost: false
 *             address: "123 Pet Street, New York, NY"
 *             lat: 40.7128
 *             lng: -74.0060
 *             vaccinated: true
 *             microchipped: true
 *             healthHistory:
 *               - date: "2024-01-15"
 *                 event: "Vaccination"
 *                 details: "DHPP vaccine administered"
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
    address,
    lat,
    lng,
    vaccinated,
    microchipped,
    healthHistory,
  } = req.body;

  if (!name || !species) {
    return res.status(400).json({ error: "name and species are required" });
  }

  const pet = await Pet.create({
    ownerId: user._id,
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
    location: {
      address: address || "",
      coordinates: {
        type: "Point",
        coordinates: lng && lat ? [lng, lat] : [0, 0],
      },
    },
    vaccinated,
    microchipped,
    healthHistory,
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
    "isLost",
    "vaccinated",
    "microchipped",
    "healthHistory",
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
 * /pets/{id}/activity:
 *   get:
 *     summary: Get pet activity history
 *     tags:
 *       - Activities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Activity history
 */
router.get("/:id/activity", verifyFirebaseToken, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;

  const activities = await ActivityEntry.find({ petId: req.params.id })
    .skip(Number(offset))
    .limit(Number(limit));
  const total = await ActivityEntry.countDocuments({ petId: req.params.id });

  res.json({
    success: true,
    activities,
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
 * /pets/{id}/activity:
 *   post:
 *     summary: Add activity entry
 *     tags:
 *       - Activities
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
 *       201:
 *         description: Activity entry added
 */
router.post("/:id/activity", verifyFirebaseToken, async (req, res) => {
  const activity = await ActivityEntry.create({
    ...req.body,
    petId: req.params.id,
  });
  res.status(201).json({ success: true, activity });
});

/**
 * @openapi
 * /pets/{petId}/activity/{activityId}:
 *   put:
 *     summary: Update activity entry
 *     tags:
 *       - Activities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: petId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: activityId
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
 *         description: Activity entry updated
 */
router.put(
  "/:petId/activity/:activityId",
  verifyFirebaseToken,
  async (req, res) => {
    const activity = await ActivityEntry.findById(req.params.activityId);
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    Object.assign(activity, req.body);
    await activity.save();
    res.json({ success: true, activity });
  }
);

/**
 * @openapi
 * /pets/{petId}/activity/{activityId}:
 *   delete:
 *     summary: Delete activity entry
 *     tags:
 *       - Activities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: petId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Activity entry deleted
 */
router.delete(
  "/:petId/activity/:activityId",
  verifyFirebaseToken,
  async (req, res) => {
    const activity = await ActivityEntry.findById(req.params.activityId);
    if (!activity) return res.status(404).json({ error: "Activity not found" });

    await activity.deleteOne();
    res.json({ success: true, message: "Activity entry deleted successfully" });
  }
);

export default router;
