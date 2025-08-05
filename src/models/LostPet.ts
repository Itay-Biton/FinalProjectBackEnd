import { Schema, model, Types } from "mongoose";

const lostPetSchema = new Schema(
  {
    petId: { type: Types.ObjectId, ref: "Pet", required: true },
    reporterId: { type: Types.ObjectId, ref: "User", required: true },
    phoneNumbers: [String],
    location: {
      address: String,
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        coordinates: { type: [Number], default: [0, 0] },
      },
    },
    additionalDetails: String,
    status: {
      type: String,
      enum: ["lost", "found", "closed"],
      default: "lost",
    },
  },
  { timestamps: true }
);

lostPetSchema.index({ petId: 1 });
lostPetSchema.index({ status: 1 });
lostPetSchema.index({ "location.coordinates": "2dsphere" });

export default model("LostPet", lostPetSchema);
