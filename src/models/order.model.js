const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    customer: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      phone: { type: String, required: true, trim: true, maxlength: 30 },
      address: { type: String, required: true, trim: true, maxlength: 500 },
      location: {
        latitude: { type: Number, min: -90, max: 90 },
        longitude: { type: Number, min: -180, max: 180 }
      }
    },
    items: [{ name: String, price: Number, quantity: Number }],
    total: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, maxlength: 1000 },
    paymentMethod: { type: String, enum: ["UPI", "PhonePe", "Razorpay", "GPay", "UPI QR Code"], default: "UPI" },
    deliveryFee: { type: Number, min: 0, default: 0 },
    orderType: { type: String, enum: ["standard"], default: "standard" },
    status: { type: String, enum: ["received", "processing", "completed"], default: "received" }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema, "orders");
