// src/routes/activityRoutes.ts
import { Router } from "express";
import ActivityEntry from "../models/ActivityEntry";
import { verifyFirebaseToken } from "../middleware/auth";

const router = Router();

/**
 * @openapi
 * /activities:
 *   get:
 *     summary: List all activities for current user
 *     tags:
 *       - Activities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Number of activities to return
 *         example: 10
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *         description: Pagination offset
 *         example: 0
 *     responses:
 *       200:
 *         description: Activity list
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               activities:
 *                 - id: "64a123abc456"
 *                   date: "15/01/2024"
 *                   time: "08:30"
 *                   activityType: "feeding"
 *                   description: "Gave 1 cup of dry food with chicken flavor"
 *                   notes: "Pet enjoyed it"
 *                   quantity: "1 cup"
 *                   duration: null
 *               pagination:
 *                 total: 5
 *                 limit: 10
 *                 offset: 0
 *                 hasMore: false
 */
router.get("/", verifyFirebaseToken, async (req, res) => {
  const user = (req as any).user;
  const { limit = 20, offset = 0 } = req.query;

  try {
    const total = await ActivityEntry.countDocuments({ ownerId: user._id });
    const activities = await ActivityEntry.find({ ownerId: user._id })
      .skip(Number(offset))
      .limit(Number(limit))
      .sort({ date: -1, time: -1, createdAt: -1 });

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
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * @openapi
 * /activities:
 *   post:
 *     summary: Create a new activity
 *     tags:
 *       - Activities
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - time
 *               - activityType
 *               - description
 *             properties:
 *               date:
 *                 type: string
 *                 description: Date of the activity (e.g., "15/01/2024")
 *               time:
 *                 type: string
 *                 description: Time of the activity (e.g., "08:30")
 *               activityType:
 *                 type: string
 *                 description: Type of activity (e.g., "feeding")
 *               description:
 *                 type: string
 *                 description: Description of the activity
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *               quantity:
 *                 type: string
 *                 description: Quantity involved in the activity
 *               duration:
 *                 type: string
 *                 nullable: true
 *                 description: Duration of the activity
 *               petId:
 *                 type: string
 *                 description: ID of the pet associated with the activity
 *             example:
 *               date: "15/01/2024"
 *               time: "08:30"
 *               activityType: "feeding"
 *               description: "Gave 1 cup of dry food with chicken flavor"
 *               notes: "Pet enjoyed it"
 *               quantity: "1 cup"
 *               duration: null
 *               petId: null
 *     responses:
 *       201:
 *         description: Created activity
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               activity:
 *                 id: "64a123abc456"
 *                 date: "15/01/2024"
 *                 time: "08:30"
 *                 activityType: "feeding"
 *                 description: "Gave 1 cup of dry food with chicken flavor"
 *                 notes: "Pet enjoyed it"
 *                 quantity: "1 cup"
 *                 duration: null
 */
router.post("/", verifyFirebaseToken, async (req, res) => {
  const user = (req as any).user;
  try {
    const entry = await ActivityEntry.create({
      ownerId: user._id,
      ...req.body, // date, time, activityType, description, etc.
    });
    res.status(201).json({ success: true, activity: entry });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, error: "Invalid data" });
  }
});

/**
 * @openapi
 * /activities/{id}:
 *   get:
 *     summary: Get a single activity
 *     tags:
 *       - Activities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Activity detail
 */
router.get("/:id", verifyFirebaseToken, async (req, res) => {
  const user = (req as any).user;
  try {
    const entry = await ActivityEntry.findById(req.params.id);
    if (!entry || entry.ownerId.toString() !== user._id.toString()) {
      return res.status(404).json({ success: false, error: "Not found" });
    }
    res.json({ success: true, activity: entry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * @openapi
 * /activities/{id}:
 *   put:
 *     summary: Update an activity
 *     tags:
 *       - Activities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 description: Date of the activity (e.g., "15/01/2024")
 *               time:
 *                 type: string
 *                 description: Time of the activity (e.g., "14:15")
 *               activityType:
 *                 type: string
 *                 description: Type of activity (e.g., "medication")
 *               description:
 *                 type: string
 *                 description: Description of the activity
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *               quantity:
 *                 type: string
 *                 description: Quantity involved in the activity
 *               duration:
 *                 type: string
 *                 nullable: true
 *                 description: Duration of the activity
 *               petId:
 *                 type: string
 *                 description: ID of the pet associated with the activity
 *             example:
 *               date: "15/01/2024"
 *               time: "14:15"
 *               activityType: "medication"
 *               description: "Gave NexGard flea prevention pill"
 *               notes: "Monthly dose"
 *               quantity: "1 pill"
 *               duration: null
 *               petId: null
 *     responses:
 *       200:
 *         description: Updated activity
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               activity:
 *                 id: "64a123abc456"
 *                 date: "15/01/2024"
 *                 time: "14:15"
 *                 activityType: "medication"
 *                 description: "Gave NexGard flea prevention pill"
 *                 notes: "Monthly dose"
 *                 quantity: "1 pill"
 *                 duration: null
 */
router.put("/:id", verifyFirebaseToken, async (req, res) => {
  const user = (req as any).user;
  try {
    const entry = await ActivityEntry.findById(req.params.id);
    if (!entry || entry.ownerId.toString() !== user._id.toString()) {
      return res.status(404).json({ success: false, error: "Not found" });
    }
    Object.assign(entry, req.body);
    await entry.save();
    res.json({ success: true, activity: entry });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, error: "Invalid data" });
  }
});

/**
 * @openapi
 * /activities/{id}:
 *   delete:
 *     summary: Remove an activity
 *     tags:
 *       - Activities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     responses:
 *       200:
 *         description: Deleted activity
 */
router.delete("/:id", verifyFirebaseToken, async (req, res) => {
  const user = (req as any).user;
  try {
    const entry = await ActivityEntry.findById(req.params.id);
    if (!entry || entry.ownerId.toString() !== user._id.toString()) {
      return res.status(404).json({ success: false, error: "Not found" });
    }
    await entry.deleteOne();
    res.json({ success: true, message: "Activity deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;
