import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { Client, Storage, ID } from "node-appwrite";
const { InputFile } = require("node-appwrite/file");
import { verifyFirebaseToken } from "../middleware/auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// Appwrite setup
const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const storage = new Storage(client);
const BUCKET_ID = process.env.APPWRITE_BUCKET_ID!;

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

    let prefix = "other";
    if (type === "pet") prefix = `pets_${req.user._id}`;
    else if (type === "business") prefix = `businesses_${req.user._id}`;
    else if (type === "profile") prefix = `profiles_${req.user._id}`;

    const fileName = `${prefix}_${uuidv4()}`;

    try {
      const result = await storage.createFile(
        BUCKET_ID,
        ID.unique(),
        InputFile.fromBuffer(file.buffer, file.originalname)
      );

      const url = `https://cloud.appwrite.io/v1/storage/buckets/${BUCKET_ID}/files/${result.$id}/view?project=${process.env.APPWRITE_PROJECT_ID}`;

      res.json({ success: true, fileId: result.$id, imageUrl: url });
    } catch (err) {
      res.status(500).json({ error: "Failed to upload image", details: err });
    }
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
 *               fileId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Image deleted
 */
router.delete("/image", verifyFirebaseToken, async (req, res) => {
  const { fileId } = req.body;

  if (!fileId) return res.status(400).json({ error: "fileId is required" });

  try {
    await storage.deleteFile(BUCKET_ID, fileId);
    res.json({ success: true, message: "Image deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete image", details: err });
  }
});

export default router;
