const mongoose = require("mongoose");

const couponClaimSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    phoneDigits: { type: String, required: true, trim: true, match: /^\d{10,15}$/ },
    reservationId: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, enum: ["reserved", "redeemed"], default: "reserved" },
    expiresAt: { type: Date, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }
  },
  { timestamps: true, collection: "coupon_phone_claims" }
);

couponClaimSchema.index({ code: 1, phoneDigits: 1 }, { unique: true });

module.exports = mongoose.models.CouponClaim || mongoose.model("CouponClaim", couponClaimSchema);
