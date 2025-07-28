import { Router } from "express";

const router = Router();

/**
 * @openapi
 * /reference/species:
 *   get:
 *     summary: Get species list
 *     tags:
 *       - Reference
 *     responses:
 *       200:
 *         description: List of species
 */
router.get("/species", (req, res) => {
  res.json({
    success: true,
    species: [
      { label: "Dog", value: "dog", icon: "dog.png" },
      { label: "Cat", value: "cat", icon: "cat.png" },
      { label: "Bird", value: "bird", icon: "bird.png" },
      { label: "Rabbit", value: "rabbit", icon: "rabbit.png" },
      { label: "Other", value: "other", icon: "other.png" },
    ],
  });
});

/**
 * @openapi
 * /reference/service-types:
 *   get:
 *     summary: Get service types
 *     tags:
 *       - Reference
 *     responses:
 *       200:
 *         description: List of service types
 */
router.get("/service-types", (req, res) => {
  res.json({
    success: true,
    serviceTypes: [
      {
        label: "Veterinarian",
        value: "veterinarian",
        icon: "veterinarian.png",
      },
      { label: "Grooming", value: "grooming", icon: "grooming.png" },
      { label: "Boarding", value: "boarding", icon: "boarding.png" },
      { label: "Training", value: "training", icon: "training.png" },
      { label: "Other", value: "other", icon: "other.png" },
    ],
  });
});

/**
 * @openapi
 * /reference/fur-colors:
 *   get:
 *     summary: Get fur colors
 *     tags:
 *       - Reference
 *     responses:
 *       200:
 *         description: List of fur colors
 */
router.get("/fur-colors", (req, res) => {
  res.json({
    success: true,
    furColors: [
      { label: "Black", value: "black", color: "#000000" },
      { label: "White", value: "white", color: "#FFFFFF" },
      { label: "Brown", value: "brown", color: "#8B4513" },
      { label: "Golden", value: "golden", color: "#FFD700" },
      { label: "Gray", value: "gray", color: "#808080" },
      { label: "Other", value: "other", color: "#CCCCCC" },
    ],
  });
});

/**
 * @openapi
 * /reference/eye-colors:
 *   get:
 *     summary: Get eye colors
 *     tags:
 *       - Reference
 *     responses:
 *       200:
 *         description: List of eye colors
 */
router.get("/eye-colors", (req, res) => {
  res.json({
    success: true,
    eyeColors: [
      { label: "Blue", value: "blue", color: "#0000FF" },
      { label: "Brown", value: "brown", color: "#8B4513" },
      { label: "Green", value: "green", color: "#008000" },
      { label: "Amber", value: "amber", color: "#FFBF00" },
      { label: "Other", value: "other", color: "#CCCCCC" },
    ],
  });
});

export default router;
