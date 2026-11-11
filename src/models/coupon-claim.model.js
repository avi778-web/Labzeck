const mongoose = require("mongoose");

const couponClaimSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, maxlength: 40 },
    reservationId: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, enum: ["reserved", "redeemed"], default: "reserved" },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }
  },
  { timestamps: true, collection: "coupon_claims" }
);

module.exports = mongoose.models.CouponClaim || mongoose.model("CouponClaim", couponClaimSchema);
