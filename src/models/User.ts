import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    firebaseUid: { type: String, unique: true },
    firstName: String,
    lastName: String,
    email: { type: String, unique: true },
    phoneNumber: String,
    profileImage: String,
    role: {
      type: String,
      enum: ["user", "business_owner", "admin"],
      default: "user",
    },
    preferences: {
      language: { type: String, default: "en" },
      notifications: { type: Boolean, default: true },
      locationSharing: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true },
    fcmToken: String,
  },
  { timestamps: true }
);

export default model("User", userSchema);
