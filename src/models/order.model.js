const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 220 },
    productName: { type: String, trim: true, maxlength: 160 },
    size: { type: String, trim: true, maxlength: 120 },
    dimensions: { type: String, trim: true, maxlength: 120 },
    finishType: { type: String, trim: true, maxlength: 120 },
    fontStyle: { type: String, trim: true, maxlength: 80 },
    printText: { type: String, trim: true, maxlength: 2000 },
    quantity: { type: Number, required: true, min: 1, max: 9999 },
    unitPrice: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    customization: {
      hasDesign: Boolean,
      addExtraAsset: Boolean,
      fontStyle: String,
      printText: String,
      designFile: String,
      imageUrl: String,
      imageLink: String,
      extraAsset: String,
      options: { type: mongoose.Schema.Types.Mixed }
    }
  },
  { _id: false }
);

const uploadedImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 2500 },
    name: { type: String, trim: true, maxlength: 160 },
    kind: { type: String, trim: true, maxlength: 40 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30, index: true },
    address: { type: String, required: true, trim: true, maxlength: 500 },
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
    items: { type: [orderItemSchema], required: true, validate: { validator: items => items.length > 0, message: "At least one order item is required" } },
    pricing: {
      itemTotal: { type: Number, required: true, min: 0 },
      bulkDiscount: { type: Number, required: true, min: 0, default: 0 },
      couponDiscount: { type: Number, required: true, min: 0, default: 0 },
      deliveryCharge: { type: Number, required: true, min: 0, default: 0 },
      finalTotal: { type: Number, required: true, min: 0 }
    },
    subtotal: { type: Number, required: true, min: 0 },
    bulkDiscount: { type: Number, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    couponApplied: { code: { type: String, trim: true, maxlength: 80 }, codes: { type: [String], default: undefined }, discountAmount: { type: Number, min: 0 } },
    appliedCoupons: { type: [String], default: [] },
    isPrepaid: { type: Boolean, default: false },
    uploadedImages: { type: [uploadedImageSchema], default: [] },
    artworkLinks: { type: [String], default: [] },
    uploadedDesignUrl: { type: String, trim: true, maxlength: 2500 },
    uploadedPhotoUrl: { type: String, trim: true, maxlength: 2500 },
    notes: { type: String, trim: true, maxlength: 1000 },
    customerNotes: { type: String, trim: true, maxlength: 1000 },
    paymentMethod: { type: String, enum: ["COD", "Online", "UPI", "Netbanking", "PhonePe", "Razorpay", "GPay", "Paytm", "UPI QR Code"], default: "COD" },
    paymentProvider: { type: String, trim: true, maxlength: 40 },
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
