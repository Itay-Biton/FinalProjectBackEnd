// models/Pet.ts
import { Schema, model, Types } from "mongoose";

const pointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
  },
  { _id: false }
);

const petSchema = new Schema(
  {
    ownerId: { type: Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    species: { type: String, required: true },
    breed: String,
    age: String,
    birthday: Date,
    furColor: String,
    eyeColor: String,
    weight: { value: Number, unit: String },
    images: [String],
    description: String,

    // Contact
    phoneNumbers: [String], // ← back on root
    email: String, // ← NEW optional

    // Flags
    isLost: { type: Boolean, default: false },
    isFound: { type: Boolean, default: false },

    // Lost details (no phones here)
    lostDetails: {
      dateLost: Date,
      lastSeen: {
        address: String,
        coordinates: pointSchema,
      },
      notes: String,
    },

    // Found details (with initialized location)
    foundDetails: {
      dateFound: Date,
      location: {
        address: { type: String, default: "" },
        coordinates: {
          type: pointSchema,
          default: () => ({ type: "Point", coordinates: [0, 0] }),
        },
      },
      notes: String,
    },

    // Current location (general)
    location: {
      address: String,
      coordinates: pointSchema,
    },

    registrationDate: { type: Date, default: Date.now },
    vaccinated: Boolean,
    microchipped: Boolean,
    matchResults: [
      {
        petId: { type: Types.ObjectId, ref: "Pet" },
        score: Number,
        matchedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

petSchema.index({ ownerId: 1 });
petSchema.index({ species: 1 });
petSchema.index({ "location.coordinates": "2dsphere" });
petSchema.index({ "lostDetails.lastSeen.coordinates": "2dsphere" });
petSchema.index({ "foundDetails.location.coordinates": "2dsphere" }); // NEW

export default model("Pet", petSchema);
