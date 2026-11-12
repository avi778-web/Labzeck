const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    customer: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      phone: { type: String, required: true, trim: true, maxlength: 30 },
      address: { type: String, required: true, trim: true, maxlength: 500 },
      organizationName: { type: String, trim: true, maxlength: 160 },
      location: {
        latitude: { type: Number, min: -90, max: 90 },
        longitude: { type: Number, min: -180, max: 180 }
      }
    },
    items: [{ name: String, price: Number, quantity: Number, customization: { hasDesign: Boolean, addExtraAsset: Boolean, fontStyle: String, printText: String, designFile: String, imageUrl: String, imageLink: String, extraAsset: String, options: { type: mongoose.Schema.Types.Mixed } } }],
    subtotal: { type: Number, required: true, min: 0 },
    bulkDiscount: { type: Number, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    couponApplied: { code: { type: String, trim: true, maxlength: 80 }, codes: { type: [String], default: undefined }, discountAmount: { type: Number, min: 0 } },
    isPrepaid: { type: Boolean, default: false },
    uploadedDesignUrl: { type: String, trim: true, maxlength: 2000 },
    uploadedPhotoUrl: { type: String, trim: true, maxlength: 2000 },
    notes: { type: String, trim: true, maxlength: 1000 },
    paymentMethod: { type: String, enum: ["COD", "UPI", "Netbanking", "PhonePe", "Razorpay", "GPay", "Paytm", "UPI QR Code"], default: "UPI" },
    paymentStatus: { type: String, enum: ["pending", "paid", "cod", "failed"], default: "pending" },
    transactionId: { type: String, trim: true, maxlength: 120 },
    razorpayOrderId: { type: String, trim: true, maxlength: 120 },
    deliveryFee: { type: Number, min: 0, default: 0 },
    idempotencyKey: { type: String, trim: true, maxlength: 100, unique: true, sparse: true },
    orderType: { type: String, enum: ["standard", "id_card_lanyard"], default: "standard" },
    status: { type: String, enum: ["received", "processing", "completed"], default: "received" }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema, "orders");
