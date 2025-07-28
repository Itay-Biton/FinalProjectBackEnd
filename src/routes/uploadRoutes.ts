import { Router } from "express";
import multer from "multer";
import { verifyFirebaseToken } from "../middleware/auth";
import admin from "../config/firebase";
import { v4 as uuidv4 } from "uuid";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * @openapi
 * /upload/image:
 *   post:
 *     summary: Upload image
 *     tags:
 *       - Upload
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               type:
 *                 type: string
 *                 enum: [pet, business, profile]
 *     responses:
 *       200:
 *         description: Image uploaded
 */
router.post(
  "/image",
  verifyFirebaseToken,
  upload.single("file"),
  async (req, res) => {
    const { type } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    if (!ALLOWED_TYPES.includes(file.mimetype))
      return res.status(400).json({ error: "Unsupported file type" });
    if (file.size > MAX_SIZE)
      return res.status(400).json({ error: "File too large" });
    // TODO: Optionally check dimensions
    let folder = "images/other/";
    if (type === "pet") folder = `images/pets/${req.user._id}/`;
    else if (type === "business") folder = `images/businesses/${req.user._id}/`;
    else if (type === "profile") folder = `images/profiles/${req.user._id}/`;
    const filename = `${folder}${uuidv4()}`;
    const bucket = admin.storage().bucket();
    const fileRef = bucket.file(filename);
    await fileRef.save(file.buffer, {
      contentType: file.mimetype,
      public: true,
    });
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    res.json({ success: true, imageUrl });
  }
);

/**
 * @openapi
 * /upload/image:
 *   delete:
 *     summary: Delete image
 *     tags:
 *       - Upload
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               imageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Image deleted
 */
// Delete Image
router.delete("/image", verifyFirebaseToken, async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: "imageUrl is required" });
  const bucket = admin.storage().bucket();
  const path = imageUrl.split(`/${bucket.name}/`)[1];
  if (!path) return res.status(400).json({ error: "Invalid imageUrl" });
  await bucket.file(path).delete();
  res.json({ success: true, message: "Image deleted successfully" });
});

export default router;
