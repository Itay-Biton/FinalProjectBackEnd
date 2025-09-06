import { Router } from "express";
import User from "../models/User";
import { verifyFirebaseToken } from "../middleware/auth";
import { requireSelfOrRole } from "../middleware/authorization";
import axios from "axios";

const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
const router = Router();
const profilePicUrls = [
  "https://fra.cloud.appwrite.io/v1/storage/buckets/6890fc000033de743aaa/files/68bc502d002bd3b654ab/view?project=6890fbe8000f4b77a48f&mode=admin",
  "https://fra.cloud.appwrite.io/v1/storage/buckets/6890fc000033de743aaa/files/68bc503300283d6d02f2/view?project=6890fbe8000f4b77a48f&mode=admin",
  "https://fra.cloud.appwrite.io/v1/storage/buckets/6890fc000033de743aaa/files/68bc5039003900cb8d7f/view?project=6890fbe8000f4b77a48f&mode=admin",
  "https://fra.cloud.appwrite.io/v1/storage/buckets/6890fc000033de743aaa/files/68bc503f0017915d28a9/view?project=6890fbe8000f4b77a48f&mode=admin",
  "https://fra.cloud.appwrite.io/v1/storage/buckets/6890fc000033de743aaa/files/68bc50450009ff5c775d/view?project=6890fbe8000f4b77a48f&mode=admin",
];

/**
 * @openapi
 * /users/me:
 *   get:
 *     summary: Get current user profile
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
router.get("/me", verifyFirebaseToken, async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(404).json({ error: "User not found" });
  console.log("me:\n", user);
  res.json({ success: true, user });
});

/**
 * @openapi
 * /users/me:
 *   put:
 *     summary: Update current user profile
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated user profile
 */
router.put("/me", verifyFirebaseToken, async (req, res) => {
  const user = (req as any).user;
  if (!user) return res.status(404).json({ error: "User not found" });
  const update = req.body;
  Object.assign(user, update);
  await user.save();
  res.json({ success: true, user });
});

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags:
 *       - Users
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
 *         description: User profile
 */
router.get(
  "/:id",
  verifyFirebaseToken,
  requireSelfOrRole("admin"),
  async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, user });
  }
);

/**
 * @openapi
 * /users/auth/verify:
 *   post:
 *     summary: Verify Firebase token and create user if needed
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: User info and success
 */
router.post("/auth/verify", async (req, res) => {
  console.log("req body:\n", req.body);
  const authHeader = req.headers.authorization;
  const idToken =
    req.body.idToken ||
    (authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null);
  const { firstName, lastName, email, phoneNumber, profileImage, firebaseUid } =
    req.body;
  console.log(
    "body:\n",
    firstName,
    lastName,
    email,
    phoneNumber,
    profileImage,
    firebaseUid
  );
  if (!idToken) return res.status(400).json({ error: "idToken is required" });
  try {
    const admin = require("../config/firebase").default;
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      const randomImage =
        profilePicUrls[Math.floor(Math.random() * profilePicUrls.length)];
      console.log("Creating user with data:", {
        firebaseUid: firebaseUid ?? decodedToken.uid,
        email: email ?? decodedToken.email,
        firstName: firstName ?? decodedToken.name?.split(" ")[0] ?? "",
        lastName: lastName ?? decodedToken.name?.split(" ")[1] ?? "",
        phoneNumber: phoneNumber ?? "",
      });
      user = await User.create({
        firebaseUid: firebaseUid || decodedToken.uid,
        email: email || decodedToken.email,
        firstName: firstName || decodedToken.name?.split(" ")[0] || "",
        lastName: lastName || decodedToken.name?.split(" ")[1] || "",
        profileImage: profileImage || decodedToken.picture || randomImage,
        phoneNumber: phoneNumber || "",
      });
    }
    console.log("userData:\n", user);
    res.json({
      success: true,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid token", content: err });
  }
});

// ========= TEST ROUTES ONLY: DONT USE ========= //

/**
 * @openapi
 * /users/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Returns Firebase ID token
 */
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  try {
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`,
      {
        email,
        password,
        returnSecureToken: true,
      }
    );

    const { idToken, refreshToken, localId } = response.data;

    res.json({
      success: true,
      idToken,
      refreshToken,
      firebaseUid: localId,
    });
  } catch (err: any) {
    return res.status(401).json({
      error: "Invalid email or password",
      details: err.response?.data,
    });
  }
});

/**
 * @openapi
 * /users/auth/register:
 *   post:
 *     summary: Register a new user with email and password
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Returns created user
 */
router.post("/auth/register", async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  const admin = require("../config/firebase").default;

  try {
    // 1️⃣ Create Firebase Auth account
    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName || ""} ${lastName || ""}`.trim(),
    });

    // 2️⃣ Create MongoDB user
    const user = await User.create({
      firebaseUid: firebaseUser.uid,
      email,
      firstName,
      lastName,
      profileImage: firebaseUser.photoURL || "",
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
