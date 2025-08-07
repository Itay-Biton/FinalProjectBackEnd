import { Schema, model, Types } from "mongoose";

const activityEntrySchema = new Schema(
  {
    ownerId: { type: Types.ObjectId, ref: "User", required: true }, // Link to the user who owns the activity
    date: { type: String, required: true }, // DD/MM/YYYY format for UI compatibility
    time: { type: String, required: true }, // HH:mm format
    activityType: { type: String, required: true }, // feeding, medication, exercise, grooming, etc.
    description: { type: String, required: true }, // Main description field for display in the UI
  },
  { timestamps: true }
);

activityEntrySchema.index({ ownerId: 1 });
activityEntrySchema.index({ date: 1 });

export default model("ActivityEntry", activityEntrySchema);
