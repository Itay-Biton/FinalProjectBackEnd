import { Schema, model, Types } from "mongoose";

const activityEntrySchema = new Schema(
  {
    petId: { type: Types.ObjectId, ref: "Pet", required: true },
    date: String,
    time: String,
    activity: String,
    activityType: String,
    details: String,
    notes: String,
    quantity: String,
    duration: String,
  },
  { timestamps: true }
);

activityEntrySchema.index({ petId: 1 });
activityEntrySchema.index({ date: 1 });

export default model("ActivityEntry", activityEntrySchema);
