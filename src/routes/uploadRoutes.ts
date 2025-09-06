// src/routes/uploadRoutes.ts
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import {
  Client,
  Storage,
  ID,
  Permission,
  Role,
  AppwriteException,
} from "node-appwrite";

import { verifyFirebaseToken } from "../middleware/auth";
import Pet from "../models/Pet";
import Business from "../models/Business";
import User from "../models/User";

// -----------------------
// Constants / Config
// -----------------------
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const APPWRITE_ENDPOINT =
  process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;
const BUCKET_ID = process.env.APPWRITE_BUCKET_ID!;

if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || !BUCKET_ID) {
  console.error(
    "[uploadRoutes] Missing one of APPWRITE_PROJECT_ID / APPWRITE_API_KEY / APPWRITE_BUCKET_ID"
  );
}

const router = Router();

// -----------------------
// Multer (memory storage)
// -----------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  },
});

// -----------------------
// Appwrite Client
// -----------------------
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const storage = new Storage(client);

// -----------------------
// Helpers
// -----------------------
function fileViewUrl(fileId: string): string {
  // Public view URL (works if file has read(any) OR bucket grants read(any))
  // You can switch to /preview for image transforms; both respect permissions.
  return `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
}

function extractFileIdFromUrl(imageUrl: string): string {
  const match = imageUrl.match(/\/files\/([^/]+)\//);
  return match ? match[1] : "";
}

/**
 * Build the "file" argument for Storage.createFile compatibly across SDK/runtime:
 * - Node ≥ 20: use the standard Web File (preferred in newer SDKs)
 * - Node 18:   lazily import InputFile.fromBuffer WITHOUT a literal subpath
 *              so TypeScript doesn't attempt to resolve "node-appwrite/file".
 */
async function makeAppwriteUploadFile(mf: Express.Multer.File): Promise<any> {
  const g: any = globalThis as any;

  // Prefer Node 20+: global File exists (via undici)
  if (typeof g.File === "function") {
    return new g.File([mf.buffer], mf.originalname, {
      type: mf.mimetype,
      lastModified: Date.now(),
    });
  }

  // Node 18 fallback — try subpath, then top-level, without tripping TS2307
  try {
    const sub = ["node-appwrite", "file"].join("/"); // computed to avoid TS static resolution
    const mod: any = await import(sub);
    if (mod?.InputFile?.fromBuffer) {
      return mod.InputFile.fromBuffer(mf.buffer, mf.originalname);
    }
  } catch {
    /* noop */
  }
  try {
    const mod2: any = await import("node-appwrite");
    if (mod2?.InputFile?.fromBuffer) {
      return mod2.InputFile.fromBuffer(mf.buffer, mf.originalname);
    }
  } catch {
    /* noop */
  }
  throw new Error(
    "This runtime lacks global File and no InputFile shim is available. Upgrade Node to ≥20 or use a node-appwrite version that exposes InputFile."
  );
}

export async function prewarmAppwrite(): Promise<void> {
  try {
    console.time("appwritePrewarm");
    // Newer SDKs use object args; this also keeps parity with future changes.
    await storage.listFiles({ bucketId: BUCKET_ID, queries: [] });
    console.timeEnd("appwritePrewarm");
  } catch (err) {
    console.warn("Appwrite prewarm failed (non-fatal):", err);
  }
}

// -----------------------
// Health / Warmup (dev)
// -----------------------
router.get("/health", verifyFirebaseToken, (_req, res) => {
  res.json({ ok: true, now: Date.now() });
});

router.get("/warmup", verifyFirebaseToken, async (_req, res) => {
  try {
    await prewarmAppwrite();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: "warmup failed" });
  }
});

// -----------------------
// POST /upload/image
// -----------------------
router.post(
  "/image",
  verifyFirebaseToken,

  // total timer
  (req: Request, _res: Response, next: NextFunction) => {
    console.time("uploadTotal");
    next();
  },

  // parse multipart with timing + friendly errors
  (req: Request, res: Response, next: NextFunction) => {
    console.time("multerParse");
    upload.single("file")(req, res, (err: any) => {
      console.timeEnd("multerParse");
      if (!err) return next();

      if (err?.code === "LIMIT_FILE_SIZE") {
        try {
          console.timeEnd("uploadTotal");
        } catch {}
        return res.status(413).json({ error: "File too large" });
      }
      try {
        console.timeEnd("uploadTotal");
      } catch {}
      return res
        .status(400)
        .json({ error: err.message || "Upload parse error" });
    });
  },

  async (req: Request, res: Response): Promise<void> => {
    const endAll = () => {
      try {
        console.timeEnd("uploadTotal");
      } catch {}
      try {
        console.timeEnd("appwriteCreateFile");
      } catch {}
    };

    try {
      const { type, petId } = req.body as {
        type?: "pet" | "business" | "profile";
        petId?: string;
      };
      const file = (req as any).file as Express.Multer.File | undefined;

      // Basic validations
      if (!file) {
        endAll();
        return void res.status(400).json({ error: "No file uploaded" });
      }
      if (!type || !["pet", "business", "profile"].includes(type)) {
        endAll();
        return void res
          .status(400)
          .json({ error: "Invalid or missing 'type' field" });
      }
      if (!ALLOWED_TYPES.includes(file.mimetype)) {
        endAll();
        return void res.status(400).json({ error: "Unsupported file type" });
      }
      if (type === "pet" && !petId) {
        endAll();
        return void res
          .status(400)
          .json({ error: "Missing petId for type=pet" });
      }

      const userId = (req as any).user?._id || "anon";
      const logicalName = `${type}_${userId}_${uuidv4()}`;

      // Create file (named-args, compatible with new SDK style)
      console.time("appwriteCreateFile");
      const appwriteFile = await makeAppwriteUploadFile(file);
      const created = await storage.createFile({
        bucketId: BUCKET_ID,
        fileId: ID.unique(),
        file: appwriteFile, // File (Node 20+) or InputFile (Node 18 fallback)
        permissions: [Permission.read(Role.any())], // public read (ensure bucket/file security set properly)
      });
      console.timeEnd("appwriteCreateFile");

      const fileId = (created as any).$id as string;
      const imageUrl = fileViewUrl(fileId);

      // Respond ASAP so client isn't blocked by DB writes
      res.json({ success: true, fileId, imageUrl, name: logicalName });
      endAll();

      // Background DB update; rollback file on failure to avoid orphans
      setImmediate(async () => {
        try {
          if (type === "pet") {
            await Pet.findByIdAndUpdate(
              petId!,
              { $push: { images: imageUrl } },
              { new: true }
            );
          } else if (type === "business") {
            await Business.findOneAndUpdate(
              { ownerId: userId },
              { $push: { images: imageUrl } },
              { new: true }
            );
          } else if (type === "profile") {
            await User.findByIdAndUpdate(userId, { profileImage: imageUrl });
          }
        } catch (dbErr) {
          console.error(
            "Post-upload DB update failed; rolling back file:",
            dbErr
          );
          try {
            await storage.deleteFile({ bucketId: BUCKET_ID, fileId });
          } catch (rollbackErr) {
            console.error("Rollback deleteFile failed:", rollbackErr);
          }
        }
      });

      req.on("aborted", () =>
        console.warn("Client aborted connection after upload")
      );
    } catch (e) {
      const ae = e as AppwriteException;
      console.error("[/upload/image] error:", ae?.message || e);
      endAll();
      return void res.status(502).json({ error: "Failed to upload image" });
    }
  }
);

// -----------------------
// DELETE /upload/image
// -----------------------
router.delete(
  "/image",
  verifyFirebaseToken,
  async (req: Request, res: Response): Promise<void> => {
    const { imageUrl, type, petId } = req.body as {
      imageUrl?: string;
      type?: "pet" | "business" | "profile";
      petId?: string;
    };

    if (!imageUrl || !type) {
      return void res
        .status(400)
        .json({ error: "Missing required fields (imageUrl, type)" });
    }

    const fileId = extractFileIdFromUrl(imageUrl);
    if (!fileId) {
      return void res.status(400).json({ error: "Invalid imageUrl" });
    }

    try {
      await storage.deleteFile({ bucketId: BUCKET_ID, fileId });

      if (type === "pet" && petId) {
        await Pet.findByIdAndUpdate(petId, { $pull: { images: imageUrl } });
      } else if (type === "business") {
        await Business.findOneAndUpdate(
          { ownerId: (req as any).user._id },
          { $pull: { images: imageUrl } }
        );
      } else if (type === "profile") {
        await User.findByIdAndUpdate((req as any).user._id, {
          $unset: { profileImage: "" },
        });
      }

      res.json({ success: true, message: "Image deleted successfully" });
    } catch (err) {
      console.error("[/upload/image:delete] error:", err);
      res.status(500).json({ error: "Failed to delete image" });
    }
  }
);

export default router;
