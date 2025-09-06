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
 *                   isLost: true
 *                   isFound: false
 *                   phoneNumbers: ["123-456-7890"]
 *                   email: "owner@example.com"
 *                   lostDetails:
 *                     dateLost: "2025-08-01T10:30:00.000Z"
 *                     lastSeen:
 *                       address: "Herzl St 12, Tel Aviv"
 *                       coordinates: [34.7778, 32.0662]
 *                     notes: "Blue collar, friendly"
 *                   foundDetails:
 *                     dateFound: null
 *                     location:
 *                       address: ""
 *                       coordinates: [0, 0]
 *               pagination:
 *                 total: 1
 *                 limit: 20
 *                 offset: 0
 *                 hasMore: false
 */
router.get("/mine", verifyFirebaseToken, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query as any;
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
    email: pet.email || undefined,
    vaccinated: pet.vaccinated,
    microchipped: pet.microchipped,
    registrationDate: pet.registrationDate,
    lostDetails: pet.lostDetails || undefined,
    foundDetails: pet.foundDetails || undefined,
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
 *         description: "lat,lng"
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: "Radius in km"
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
  try {
    const {
      species,
      location,
      radius,
      limit = 20,
      offset = 0,
      search,
    } = req.query as any;

    const baseQuery: any = {};
    if (species) baseQuery.species = species;
    if (search) baseQuery.name = { $regex: search, $options: "i" };
    baseQuery.$or = [{ isLost: true }, { isFound: true }];

    // Helpers
    const toNumber = (v: any) => (typeof v === "number" ? v : Number(v));
    const KM_EARTH = 6371; // km

    const haversineKm = (
      lat1: number,
      lng1: number,
      lat2: number,
      lng2: number
    ) => {
      const toRad = (x: number) => (x * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
          Math.cos(toRad(lat2)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return KM_EARTH * c;
    };

    const pickBestCoords = (pet: any): [number, number] | undefined => {
      // return [lng, lat] with priority: found → lost → base
      const found = pet?.foundDetails?.location;
      const lost = pet?.lostDetails?.lastSeen;
      const base = pet?.location;

      const tryPoint = (obj: any): [number, number] | undefined => {
        if (!obj) return;
        // GeoJSON
        if (
          obj.coordinates?.type === "Point" &&
          Array.isArray(obj.coordinates.coordinates)
        ) {
          const [lng, lat] = obj.coordinates.coordinates.map(Number);
          if (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            !(lat === 0 && lng === 0)
          )
            return [lng, lat];
        }
        // Plain array [lng, lat]
        if (Array.isArray(obj.coordinates) && obj.coordinates.length === 2) {
          const [lng, lat] = obj.coordinates.map(Number);
          if (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            !(lat === 0 && lng === 0)
          )
            return [lng, lat];
        }
        return;
      };

      return tryPoint(found) || tryPoint(lost) || tryPoint(base) || undefined;
    };

    // If no geo filter, keep old simple flow + pagination via Mongo
    if (!location || !radius) {
      const total = await Pet.countDocuments(baseQuery);
      const pets = await Pet.find(baseQuery)
        .skip(Number(offset))
        .limit(Number(limit));

      return res.json({
        success: true,
        pets,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: total > Number(offset) + Number(limit),
        },
      });
    }

    // Parse geo filter
    const [latStr, lngStr] = (location as string)
      .split(",")
      .map((s: string) => s.trim());
    const lat = toNumber(latStr);
    const lng = toNumber(lngStr);
    const radiusKm = toNumber(radius);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(radiusKm)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid location/radius" });
    }

    const centerPoint = {
      type: "Point",
      coordinates: [lng, lat] as [number, number],
    };
    const maxDistanceMeters = radiusKm * 1000;
    const radiusRadians = radiusKm / KM_EARTH;

    // Run three geo queries separately (MongoDB does not allow $near inside $or)
    const [qBase, qFound, qLost] = await Promise.all([
      // base location (GeoJSON Point)
      Pet.find({
        ...baseQuery,
        "location.coordinates": {
          $near: { $geometry: centerPoint, $maxDistance: maxDistanceMeters },
        },
      }),

      // foundDetails.location (GeoJSON Point)
      Pet.find({
        ...baseQuery,
        "foundDetails.location.coordinates": {
          $near: { $geometry: centerPoint, $maxDistance: maxDistanceMeters },
        },
      }),

      // lostDetails.lastSeen (legacy [lng,lat] array) — use $geoWithin/$centerSphere
      Pet.find({
        ...baseQuery,
        "lostDetails.lastSeen.coordinates": {
          $geoWithin: { $centerSphere: [[lng, lat], radiusRadians] },
        },
      }),
    ]);

    // Merge + de-dupe
    const byId = new Map<string, any>();
    for (const p of [...qBase, ...qFound, ...qLost]) {
      byId.set(p._id.toString(), p);
    }
    const merged = Array.from(byId.values());

    // Compute distance using best available coords (found → lost → base) and sort
    const enriched = merged
      .map((p) => {
        const coords = pickBestCoords(p);
        let distanceKm: number | undefined;
        if (coords) {
          const [plng, plat] = coords;
          distanceKm = haversineKm(lat, lng, plat, plng);
        }
        return {
          pet: p,
          distanceKm,
        };
      })
      .filter(
        (x) => x.distanceKm === undefined || Number.isFinite(x.distanceKm)
      )
      .sort((a, b) => {
        const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
        return da - db;
      });

    // Manual pagination
    const total = enriched.length;
    const start = Number(offset);
    const end = start + Number(limit);
    const page = enriched.slice(start, end).map(({ pet, distanceKm }) => {
      const asObj = pet.toObject ? pet.toObject() : pet;
      return {
        ...asObj,
        distance:
          distanceKm != null ? `${distanceKm.toFixed(1)} km` : undefined,
      };
    });

    return res.json({
      success: true,
      pets: page,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: total > end,
      },
    });
  } catch (err: any) {
    console.error("[GET /pets] error:", err);
    res
      .status(500)
      .json({ success: false, error: err?.message || "Server error" });
  }
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
 *               phoneNumbers:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["123-456-7890"]
 *               email:
 *                 type: string
 *                 format: email
 *               isLost:
 *                 type: boolean
 *                 example: false
 *               isFound:
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
 *               lostDetails:
 *                 type: object
 *                 properties:
 *                   dateLost:
 *                     type: string
 *                     format: date-time
 *                   lastSeen:
 *                     type: object
 *                     properties:
 *                       address:
 *                         type: string
 *                       coordinates:
 *                         type: array
 *                         items:
 *                           type: number
 *                         description: [lng, lat]
 *                   notes:
 *                     type: string
 *               foundDetails:
 *                 type: object
 *                 properties:
 *                   dateFound:
 *                     type: string
 *                     format: date-time
 *                   location:
 *                     type: object
 *                     properties:
 *                       address:
 *                         type: string
 *                       coordinates:
 *                         type: array
 *                         items:
 *                           type: number
 *                         description: [lng, lat]
 *                   notes:
 *                     type: string
 *           example:
 *             name: "Buddy"
 *             species: "dog"
 *             breed: "Golden Retriever"
 *             age: 3
 *             birthday: "2021-05-10"
 *             furColor: "golden"
 *             eyeColor: "brown"
 *             weight:
 *               value: 25
 *               unit: "kg"
 *             images:
 *               - "https://mypetapp.com/images/pet1.jpg"
 *             description: "Very friendly and energetic"
 *             phoneNumbers:
 *               - "123-456-7890"
 *             email: "owner@example.com"
 *             isLost: true
 *             isFound: false
 *             address: "123 Pet Street, New York, NY"
 *             lat: 40.7128
 *             lng: -74.0060
 *             vaccinated: true
 *             microchipped: true
 *             lostDetails:
 *               dateLost: "2025-08-01T10:30:00.000Z"
 *               lastSeen:
 *                 address: "Herzl St 12, Tel Aviv"
 *                 coordinates: [34.7778, 32.0662]
 *               notes: "Blue collar, friendly"
 *             foundDetails:
 *               dateFound: null
 *               location:
 *                 address: ""
 *                 coordinates: [0, 0]
 *               notes: ""
 *     responses:
 *       201:
 *         description: Pet registered
 */
router.post("/", verifyFirebaseToken, async (req, res) => {
  const user = (req as any).user;

  // ---------- helpers ----------
  const emptyToUndef = (v: any) =>
    typeof v === "string" ? (v.trim() ? v.trim() : undefined) : v;

  const numOrUndef = (v: any) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const toISOorUndef = (v: any) => {
    const s = emptyToUndef(v);
    if (!s) return undefined;
    const d = new Date(s);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  };

  const ensureStringArray = (arr: any) =>
    Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];

  const normalizePointFromLngLat = (
    lng?: number,
    lat?: number
  ): { type: "Point"; coordinates: [number, number] } => ({
    type: "Point",
    coordinates:
      typeof lng === "number" &&
      typeof lat === "number" &&
      !isNaN(lng) &&
      !isNaN(lat)
        ? [lng, lat]
        : [0, 0],
  });

  // Build GeoJSON from either [lng,lat] array or {lat,lng} object
  const normalizePointFromInput = (input: any) => {
    if (!input) return normalizePointFromLngLat(undefined, undefined);

    if (Array.isArray(input.coordinates) && input.coordinates.length === 2) {
      const [lng, lat] = input.coordinates.map(Number);
      return normalizePointFromLngLat(lng, lat);
    }

    const lat =
      typeof input.lat === "number"
        ? input.lat
        : typeof input.coordinates?.lat === "number"
        ? input.coordinates.lat
        : undefined;
    const lng =
      typeof input.lng === "number"
        ? input.lng
        : typeof input.coordinates?.lng === "number"
        ? input.coordinates.lng
        : undefined;

    return normalizePointFromLngLat(
      typeof lng === "string" ? Number(lng) : lng,
      typeof lat === "string" ? Number(lat) : lat
    );
  };

  try {
    // ---------- raw body ----------
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
      email,
      address,
      lat,
      lng,
      vaccinated,
      microchipped,
      lostDetails,
      foundDetails,
    } = req.body || {};

    // ---------- required ----------
    const safeName = emptyToUndef(name);
    const safeSpecies = emptyToUndef(species);
    if (!safeName || !safeSpecies) {
      return res
        .status(400)
        .json({ success: false, error: "name and species are required" });
    }

    // ---------- scalars / strings ----------
    const safeBreed = emptyToUndef(breed);
    const safeFur = emptyToUndef(furColor);
    const safeEye = emptyToUndef(eyeColor);
    const safeDesc = emptyToUndef(description);
    const safeEmail = emptyToUndef(email);

    // ---------- numbers / dates ----------
    const safeAge = numOrUndef(age);
    const safeBirthdayISO = toISOorUndef(birthday);
    const safeLat = numOrUndef(lat);
    const safeLng = numOrUndef(lng);

    // ---------- weight ----------
    const safeWeight =
      weight && numOrUndef(weight.value)
        ? {
            value: Number(weight.value),
            unit: emptyToUndef(weight.unit) || "kg",
          }
        : undefined;

    // ---------- arrays ----------
    const safeImages = Array.isArray(images) ? images : [];
    const safePhones = ensureStringArray(phoneNumbers);

    // ---------- flags ----------
    const safeIsLost = Boolean(isLost);
    const safeIsFound = Boolean(isFound);
    const safeVaccinated =
      typeof vaccinated === "boolean" ? vaccinated : undefined;
    const safeMicrochipped =
      typeof microchipped === "boolean" ? microchipped : undefined;

    // ---------- top-level location ----------
    const safeLocation = {
      address: emptyToUndef(address) || "",
      coordinates: normalizePointFromLngLat(safeLng, safeLat),
    };

    // ---------- lostDetails (pass-through if has something) ----------
    const safeLost =
      lostDetails &&
      (lostDetails.dateLost || lostDetails.lastSeen || lostDetails.notes)
        ? {
            dateLost: toISOorUndef(lostDetails.dateLost),
            lastSeen: lostDetails.lastSeen
              ? {
                  address: emptyToUndef(lostDetails.lastSeen.address),
                  coordinates: Array.isArray(lostDetails.lastSeen.coordinates)
                    ? ([
                        Number(lostDetails.lastSeen.coordinates[0]),
                        Number(lostDetails.lastSeen.coordinates[1]),
                      ] as [number, number])
                    : undefined,
                }
              : undefined,
            notes: emptyToUndef(lostDetails.notes),
          }
        : undefined;

    // ---------- foundDetails (normalize location to GeoJSON Point) ----------
    let safeFound: any = undefined;
    if (
      foundDetails &&
      (foundDetails.dateFound || foundDetails.location || foundDetails.notes)
    ) {
      const loc = foundDetails.location || {};
      const point = normalizePointFromInput(loc);

      safeFound = {
        dateFound: toISOorUndef(foundDetails.dateFound),
        notes: emptyToUndef(foundDetails.notes),
        location: {
          address: emptyToUndef(loc.address) || "",
          coordinates: point, // { type: 'Point', coordinates: [lng,lat] }
        },
      };
    }

    // ---------- create ----------
    const pet = await Pet.create({
      ownerId: user._id,
      name: safeName,
      species: safeSpecies,
      breed: safeBreed,
      age: typeof safeAge === "number" ? safeAge : 0,
      birthday: safeBirthdayISO,
      furColor: safeFur,
      eyeColor: safeEye,
      weight: safeWeight || { value: 0, unit: "kg" },
      images: safeImages,
      description: safeDesc,
      isLost: safeIsLost,
      isFound: safeIsFound,
      phoneNumbers: safePhones,
      email: safeEmail,
      location: safeLocation,
      vaccinated: safeVaccinated,
      microchipped: safeMicrochipped,
      lostDetails: safeLost,
      foundDetails: safeFound,
    });

    return res.status(201).json({ success: true, pet });
  } catch (err: any) {
    // Always return a clean 400/500 with message to avoid silent 500s
    console.error("[POST /pets] error:", err);
    const code = err?.name === "ValidationError" ? 400 : 500;
    return res
      .status(code)
      .json({ success: false, error: err?.message || "Server error" });
  }
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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumbers:
 *                 type: array
 *                 items:
 *                   type: string
 *               lostDetails:
 *                 type: object
 *                 properties:
 *                   dateLost:
 *                     type: string
 *                     format: date-time
 *                   lastSeen:
 *                     type: object
 *                     properties:
 *                       address:
 *                         type: string
 *                       coordinates:
 *                         type: array
 *                         items:
 *                           type: number
 *                         description: [lng, lat]
 *                   notes:
 *                     type: string
 *               foundDetails:
 *                 type: object
 *                 properties:
 *                   dateFound:
 *                     type: string
 *                     format: date-time
 *                   location:
 *                     type: object
 *                     properties:
 *                       address:
 *                         type: string
 *                       coordinates:
 *                         type: array
 *                         items:
 *                           type: number
 *                         description: [lng, lat]
 *                   notes:
 *                     type: string
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
    "email",
    "vaccinated",
    "microchipped",
    "isLost",
    "isFound",
    "matchResults",
    "lostDetails",
    "foundDetails",
  ] as const;

  allowedUpdates.forEach((field) => {
    if ((req.body as any)[field] !== undefined) {
      (pet as any)[field] = (req.body as any)[field];
    }
  });

  // Normalize general location if provided via lat/lng
  if (req.body.lat != null && req.body.lng != null) {
    pet.location = {
      address: req.body.address || pet.location?.address || "",
      coordinates: {
        type: "Point",
        coordinates: [Number(req.body.lng), Number(req.body.lat)],
      },
    };
  }

  // Normalize foundDetails.location if provided (supports array or {lat,lng})
  const fd = req.body.foundDetails;
  if (fd) {
    // Ensure foundDetails + location objects exist
    (pet as any).foundDetails ||= {};
    (pet as any).foundDetails.location ||= {
      address: "",
      coordinates: { type: "Point", coordinates: [0, 0] as [number, number] },
    };

    const currentFD = (pet as any).foundDetails;
    const locInput = fd.location || {};

    // Build coords from either [lng,lat] or {lat,lng} (or keep existing)
    let coords: [number, number] | undefined;
    if (
      Array.isArray(locInput.coordinates) &&
      locInput.coordinates.length === 2
    ) {
      const [lng, lat] = locInput.coordinates.map(Number);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) coords = [lng, lat];
    } else {
      const lat =
        typeof locInput.lat === "number"
          ? locInput.lat
          : locInput?.coordinates?.lat;
      const lng =
        typeof locInput.lng === "number"
          ? locInput.lng
          : locInput?.coordinates?.lng;
      if (
        typeof lat === "number" &&
        typeof lng === "number" &&
        !Number.isNaN(lat) &&
        !Number.isNaN(lng)
      ) {
        coords = [lng, lat];
      }
    }

    // Merge all fields
    (pet as any).foundDetails = {
      ...currentFD,
      ...fd,
      location: {
        address: locInput.address ?? currentFD.location.address ?? "",
        coordinates: {
          type: "Point",
          coordinates: coords ??
            (currentFD.location.coordinates?.coordinates as [
              number,
              number
            ]) ?? [0, 0],
        },
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
    .filter((match) => match.score >= 3) // Adjustable threshold
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
router.get("/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet)
      return res.status(404).json({ success: false, error: "Pet not found" });

    // If this endpoint is only for editing, keep it owner-only:
    if (pet.ownerId?.toString() !== (req as any).user._id.toString()) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    return res.json({ success: true, pet });
  } catch (e: any) {
    return res
      .status(400)
      .json({ success: false, error: e?.message || "Invalid id" });
  }
});

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

  // Get all lost pets owned by the user
  const lostPets = await Pet.find({ ownerId: user._id, isLost: true });

  // Get all found pets not owned by the user
  const foundPets = await Pet.find({
    isFound: true,
    isLost: false,
    //ownerId: { $ne: user._id },
  });

  const matches = [];

  for (const lost of lostPets) {
    for (const found of foundPets) {
      const score = computeMatchScore(
        lost.toObject?.() ?? lost,
        found.toObject?.() ?? found
      );
      console.log(
        "lost name:",
        lost.name,
        "\nfound name: ",
        found.name,
        "\n score: ",
        score,
        "\n\n"
      );
      if (score >= 3) {
        matches.push({
          petId: lost._id,
          petName: lost.name,
          matchedPetId: found._id,
          matchedPetName: found.name,
          score,
          matchedAt: new Date().toISOString(),
          foundPet: found.toObject?.() ?? found,
        });
      }
    }
  }

  matches.sort(
    (a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime()
  );

  res.json({ success: true, matches });
});

export default router;
