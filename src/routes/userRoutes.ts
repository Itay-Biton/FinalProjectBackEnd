import { Router } from "express";
import User from "../models/User";
import { verifyFirebaseToken } from "../middleware/auth";
import { requireSelfOrRole } from "../middleware/authorization";
import axios from "axios";

const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
const router = Router();

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
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: "idToken is required" });
  try {
    const admin = require("../config/firebase").default;
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user) {
      user = await User.create({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        firstName: decodedToken.name?.split(" ")[0] || "",
        lastName: decodedToken.name?.split(" ")[1] || "",
        profileImage: decodedToken.picture || "",
      });
    }
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
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

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
