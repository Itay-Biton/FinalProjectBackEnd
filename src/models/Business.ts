import { Schema, model, Types } from "mongoose";

const workingHourSchema = new Schema(
  {
    day: String,
    isOpen: Boolean,
    openTime: String,
    closeTime: String,
  },
  { _id: false }
);

const businessSchema = new Schema(
  {
    ownerId: { type: Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    serviceType: { type: String, required: true },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    email: String,
    phoneNumbers: [String],
    location: {
      address: { type: String },
      coordinates: {
        type: { type: String, enum: ["Point"], default: "Point" },
        // Store coordinates consistently as [longitude, latitude]
        coordinates: {
          type: [Number],
          validate: {
            validator: function (val: number[]) {
              return (
                val.length === 2 && val.every((num) => typeof num === "number")
              );
            },
            message: "Coordinates must be an array of two numbers [lng, lat]",
          },
          default: [0, 0],
        },
      },
    },
    distance: String,
    workingHours: [workingHourSchema],
    images: [String],
    description: String,
    services: [String],
    isOpen: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

businessSchema.index({ ownerId: 1 });
businessSchema.index({ serviceType: 1 });
businessSchema.index({ "location.coordinates": "2dsphere" });
businessSchema.index({ isVerified: 1 });

export default model("Business", businessSchema);
