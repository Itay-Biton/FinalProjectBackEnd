import { Schema, model, Types } from "mongoose";

const reviewSchema = new Schema(
  {
    businessId: { type: Types.ObjectId, ref: "Business", required: true },
    userId: { type: Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: String,
  },
  { timestamps: true }
);

reviewSchema.index({ businessId: 1 });
reviewSchema.index({ userId: 1 });

export default model("Review", reviewSchema);
