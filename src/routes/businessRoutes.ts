import { Router } from "express";
import Business from "../models/Business";
import Review from "../models/Review";
import { verifyFirebaseToken } from "../middleware/auth";
import { Types } from "mongoose";

const router = Router();

/**
 * @openapi
 * /businesses:
 *   get:
 *     summary: List/Search businesses
 *     tags:
 *       - Businesses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: serviceType
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
 *       - in: query
 *         name: isOpen
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of businesses
 */
router.get("/", verifyFirebaseToken, async (req, res) => {
  const {
    serviceType,
    location,
    radius,
    limit = 20,
    offset = 0,
    search,
    isOpen,
  } = req.query;
  const query: any = {};
  if (serviceType) query.serviceType = serviceType;
  if (isOpen !== undefined) query.isOpen = isOpen === "true";
  if (search) query.name = { $regex: search, $options: "i" };
  let businessesQuery = Business.find(query);
  if (location && radius) {
    const [lat, lng] = (location as string).split(",").map(Number);
    businessesQuery = businessesQuery.where("location.coordinates").near({
      center: { type: "Point", coordinates: [lng, lat] },
      maxDistance: Number(radius) * 1000,
      spherical: true,
    });
  }
  const total = await Business.countDocuments(query);
  const businesses = await businessesQuery
    .skip(Number(offset))
    .limit(Number(limit));
  res.json({
    success: true,
    businesses,
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
 * /businesses:
 *   post:
 *     summary: Register new business
 *     tags:
 *       - Businesses
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
 *         description: Business registered
 */
router.post("/", verifyFirebaseToken, async (req, res) => {
  const business = await Business.create({
    ...req.body,
    ownerId: (req as any).user._id,
  });
  res.status(201).json({ success: true, business });
});

/**
 * @openapi
 * /businesses/{id}:
 *   get:
 *     summary: Get business details
 *     tags:
 *       - Businesses
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
 *         description: Business details
 */
router.get("/:id", verifyFirebaseToken, async (req, res) => {
  const business = await Business.findById(req.params.id).populate("ownerId");
  if (!business) return res.status(404).json({ error: "Business not found" });
  res.json({ success: true, business });
});

/**
 * @openapi
 * /businesses/{id}:
 *   put:
 *     summary: Update business
 *     tags:
 *       - Businesses
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
 *         description: Updated business
 */
router.put("/:id", verifyFirebaseToken, async (req, res) => {
  const business = await Business.findById(req.params.id);
  if (!business) return res.status(404).json({ error: "Business not found" });
  if (business.ownerId.toString() !== (req as any).user._id.toString())
    return res.status(403).json({ error: "Forbidden" });
  Object.assign(business, req.body);
  await business.save();
  res.json({ success: true, business });
});

/**
 * @openapi
 * /businesses/{id}:
 *   delete:
 *     summary: Delete business
 *     tags:
 *       - Businesses
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
 *         description: Business deleted
 */
router.delete("/:id", verifyFirebaseToken, async (req, res) => {
  const business = await Business.findById(req.params.id);
  if (!business) return res.status(404).json({ error: "Business not found" });
  if (business.ownerId.toString() !== (req as any).user._id.toString())
    return res.status(403).json({ error: "Forbidden" });
  await business.deleteOne();
  res.json({ success: true, message: "Business deleted successfully" });
});

/**
 * @openapi
 * /businesses/{id}/reviews:
 *   get:
 *     summary: Get business reviews
 *     tags:
 *       - Reviews
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
 *         description: List of reviews
 */
router.get("/:id/reviews", verifyFirebaseToken, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const reviews = await Review.find({ businessId: req.params.id })
    .populate("userId", "firstName lastName")
    .skip(Number(offset))
    .limit(Number(limit));
  const total = await Review.countDocuments({ businessId: req.params.id });
  res.json({
    success: true,
    reviews,
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
 * /businesses/{id}/reviews:
 *   post:
 *     summary: Add review
 *     tags:
 *       - Reviews
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
 *         description: Review added
 */
router.post("/:id/reviews", verifyFirebaseToken, async (req, res) => {
  const review = await Review.create({
    ...req.body,
    businessId: req.params.id,
    userId: (req as any).user._id,
  });
  res.status(201).json({ success: true, review });
});

/**
 * @openapi
 * /businesses/{businessId}/reviews/{reviewId}:
 *   put:
 *     summary: Update review
 *     tags:
 *       - Reviews
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: reviewId
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
 *         description: Review updated
 */
router.put(
  "/:businessId/reviews/:reviewId",
  verifyFirebaseToken,
  async (req, res) => {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ error: "Review not found" });
    if (review.userId.toString() !== (req as any).user._id.toString())
      return res.status(403).json({ error: "Forbidden" });
    Object.assign(review, req.body);
    await review.save();
    res.json({ success: true, review });
  }
);

/**
 * @openapi
 * /businesses/{businessId}/reviews/{reviewId}:
 *   delete:
 *     summary: Delete review
 *     tags:
 *       - Reviews
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review deleted
 */
router.delete(
  "/:businessId/reviews/:reviewId",
  verifyFirebaseToken,
  async (req, res) => {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ error: "Review not found" });
    if (review.userId.toString() !== (req as any).user._id.toString())
      return res.status(403).json({ error: "Forbidden" });
    await review.deleteOne();
    res.json({ success: true, message: "Review deleted successfully" });
  }
);

export default router;
