import { Schema, model, Types } from "mongoose";

const healthHistorySchema = new Schema(
  {
    date: String,
    event: String,
    details: String,
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
    isLost: { type: Boolean, default: false },
    isFound: { type: Boolean, default: false },
    phoneNumbers: [String],
    location: {
      address: String,
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] },
      },
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

export default model("Pet", petSchema);
