require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const mongoConnectionString = process.env.MONGODB_CONNECTION_STRING_3 || process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING || process.env.MONGO_URI;

const Gmailmodel = require("./models/email.model");
const OrderModel = require("./models/order.model");

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  next();
});
let databaseConnectionPromise = null;

async function ensureDatabase() {
  if (mongoose.connection.readyState === 1) return true;
  if (!mongoConnectionString) return false;
  if (!databaseConnectionPromise) {
    databaseConnectionPromise = mongoose.connect(mongoConnectionString, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
      minPoolSize: 0
    })
      .then(() => true)
      .catch((error) => { databaseConnectionPromise = null; console.error('MongoDB request connection failed:', error.message); return false; });
  }
  return databaseConnectionPromise;
}

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.API_KEY_3;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.API_KEY_3_SECRET || process.env.API_SECRET_3 || process.env.API_KEY_4;
  if (!String(keyId || "").trim() || !String(keySecret || "").trim()) return null;
  return new Razorpay({ key_id: String(keyId).trim(), key_secret: String(keySecret).trim() });
}

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use("/assets", express.static(path.join(__dirname, "..", "assets")));
const uploadsDirectory = process.env.VERCEL
  ? path.join("/tmp", "sk-graphics-uploads")
  : path.join(__dirname, "..", "assets", "uploads");
try {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
} catch (error) {
  console.error("UPLOAD DIRECTORY ERROR:", error.message);
}
app.use("/uploads", express.static(uploadsDirectory));

app.post("/api/uploads", (req, res) => {
  try {
    const { data, mimeType } = req.body || {};
    if (typeof data !== "string" || !/^data:(image\/(png|jpeg|webp)|application\/pdf);base64,/.test(data)) {
      return res.status(400).json({ ok: false, message: "Only PNG, JPG, WEBP, or PDF files are supported" });
    }
    const raw = data.split(",")[1];
    const buffer = Buffer.from(raw, "base64");
    if (!buffer.length || buffer.length > 700 * 1024) return res.status(413).json({ ok: false, message: "File is too large after compression" });
    const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${extension}`;
    fs.writeFileSync(path.join(uploadsDirectory, filename), buffer, { flag: "wx" });
    return res.status(201).json({ ok: true, url: `/uploads/${filename}` });
  } catch (error) {
    console.error("UPLOAD ERROR:", error.message);
    return res.status(500).json({ ok: false, message: "Could not save upload" });
  }
});

/* =========================
   EJS SETUP
========================= */

app.set("view engine", "ejs");
const viewsDirectory = path.resolve(__dirname, "..", "views");
app.set("views", viewsDirectory);

/* =========================
   HOME PAGE
========================= */

app.get("/", (req, res, next) => {
  try {
    return res.render("index");
  } catch (error) {
    console.error("HOME PAGE ERROR:", error);
    return next(error);
  }
});

/* =========================
   NEWSLETTER API
   ONLY EMAIL SAVE HOGA
========================= */

app.post("/api/newsletter", async (req, res) => {
  console.log("NEWSLETTER API HIT");
  console.log("NEWSLETTER DATA:", req.body);

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    /* EMAIL VALIDATION */

    if (!email) {
      return res.status(400).json({
        ok: false,
        message: "Email is required"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid email address"
      });
    }

    /* DUPLICATE CHECK */

    if (!(await ensureDatabase())) {
      return res.status(503).json({ ok: false, message: "We are reconnecting the order service. Please try again in a few seconds." });
    }

    if (!Gmailmodel || typeof Gmailmodel.findOne !== "function") {
      throw new Error("Newsletter model is not initialized");
    }

    const existingEmail = await Gmailmodel.findOne({
      email: email
    });

    if (existingEmail) {
      return res.status(200).json({
        ok: true,
        message: "Email already subscribed"
      });
    }

    /* SAVE EMAIL */

    const newEmail = new Gmailmodel({
      email: email
    });

    await newEmail.save();

    console.log("✅ EMAIL SAVED:", email);

    return res.status(201).json({
      ok: true,
      message: "Email saved successfully"
    });

  } catch (error) {

    console.error("❌ NEWSLETTER ERROR:", error);

    return res.status(500).json({
      ok: false,
      message: "Could not save your email"
    });
  }
});

/* =========================
   STANDARD ORDERS
========================= */

app.post("/api/orders", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const customer = body.customer && typeof body.customer === "object" ? body.customer : {};
    const items = Array.isArray(body.items) ? body.items : [];
    const name = String(customer.name || "").trim();
    const phone = String(customer.phone || "").trim();
    const address = String(customer.address || "").trim();
    const notes = String(body.notes || "").trim();
    const paymentMethod = String(body.paymentMethod || "UPI");
    const paymentStatus = String(body.paymentStatus || (paymentMethod === "COD" ? "cod" : "pending"));
    const transactionId = String(body.transactionId || "").trim().slice(0, 120);
    const razorpayOrderId = String(body.razorpayOrderId || "").trim().slice(0, 120);
    const deliveryFee = Number(body.deliveryFee || 0);
    const idempotencyKey = String(body.idempotencyKey || '').trim().slice(0, 100);
    const total = Number(body.total);
    const latitude = Number(customer.location && customer.location.latitude);
    const longitude = Number(customer.location && customer.location.longitude);

    const validItems = items.length <= 50 && items.every((item) => item && typeof item === "object" && String(item.name || "").trim().length <= 160 && Number.isFinite(Number(item.price)) && Number(item.price) >= 0 && Number.isInteger(Number(item.qty)) && Number(item.qty) >= 1 && Number(item.qty) <= 999);
    if (!name || name.length > 120 || !phone || phone.length > 30 || !address || address.length > 500 || !validItems || !Number.isFinite(total) || total < 0 || !["COD", "UPI", "PhonePe", "Razorpay", "GPay", "Paytm", "UPI QR Code"].includes(paymentMethod) || !Number.isFinite(deliveryFee) || deliveryFee < 0) {
      return res.status(400).json({ ok: false, message: "Name, phone, address and cart items are required" });
    }
    if (phone.replace(/\D/g, "").length < 10) {
      return res.status(400).json({ ok: false, message: "Enter a valid phone number" });
    }
    if (!(await ensureDatabase())) {
      return res.status(503).json({ ok: false, message: "We are reconnecting the order service. Please try again in a few seconds." });
    }
    if (idempotencyKey) {
      const existingOrder = await OrderModel.findOne({ idempotencyKey }).lean();
      if (existingOrder) return res.status(200).json({ ok: true, orderId: existingOrder._id, duplicate: true, message: "Order already recorded" });
    }

    let order;
    try {
      order = await OrderModel.create({
      customer: {
        name,
        phone,
        address,
        location: Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined
      },
      items: items.slice(0, 50).map((item) => ({
        name: String(item.name || "").trim().slice(0, 160),
        price: Math.max(0, Number(item.price) || 0),
        quantity: Math.max(1, Math.min(999, Number(item.qty) || 1)),
        customization: item.customization && {
          hasDesign: Boolean(item.customization.hasDesign),
          addExtraAsset: Boolean(item.customization.addExtraAsset),
          fontStyle: String(item.customization.fontStyle || '').slice(0, 80),
          printText: String(item.customization.printText || '').slice(0, 2000),
          designFile: String(item.customization.designFile || '').slice(0, 3000000),
          extraAsset: String(item.customization.extraAsset || '').slice(0, 3000000)
        }
      })),
      total,
      notes,
      paymentMethod,
      paymentStatus: ["pending", "paid", "cod", "failed"].includes(paymentStatus) ? paymentStatus : "pending",
      transactionId: transactionId || undefined,
      razorpayOrderId: razorpayOrderId || undefined,
      deliveryFee,
      idempotencyKey: idempotencyKey || undefined,
      orderType: "standard"
      });
    } catch (saveError) {
      console.error("ORDER SAVE ERROR:", saveError.stack || saveError);
      if (saveError.name === "ValidationError" || saveError.name === "CastError") {
        return res.status(400).json({ ok: false, message: "Order data is invalid", details: saveError.message });
      }
      if (saveError.code === 11000 && idempotencyKey) {
        const duplicate = await OrderModel.findOne({ idempotencyKey }).lean();
        if (duplicate) return res.status(200).json({ ok: true, orderId: duplicate._id, duplicate: true, message: "Order already recorded" });
      }
      return res.status(500).json({ ok: false, message: "Order could not be saved", errorCode: saveError.code || saveError.name || "DATABASE_WRITE_ERROR" });
    }

    return res.status(201).json({ ok: true, orderId: order._id, message: "Order saved successfully" });
  } catch (error) {
    console.error("STANDARD ORDER ERROR:", error.stack || error);
    return res.status(500).json({ ok: false, message: "Order request failed", errorCode: error.code || error.name || "ORDER_REQUEST_ERROR" });
  }
});

/* =========================
   RAZORPAY PAYMENTS
========================= */

app.post(["/api/payments/order", "/api/create-order"], async (req, res) => {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(503).json({ ok: false, message: "Razorpay is not configured on the server" });
    }

    const requestedAmount = Number(req.body && req.body.amount);
    const paymentItems = Array.isArray(req.body && req.body.items) ? req.body.items : [];
    const calculatedAmount = paymentItems.reduce((sum, item) => sum + Math.max(0, Number(item.price) || 0) * Math.max(1, Math.min(999, Number(item.qty) || 1)), 0) * 100;
    const token = String((req.body && req.body.idempotencyKey) || '').trim().slice(0, 100);
    if (!paymentItems.length || calculatedAmount !== requestedAmount || !Number.isInteger(requestedAmount) || requestedAmount < 100 || requestedAmount > 100000000) {
      return res.status(400).json({ ok: false, message: "Invalid payment amount" });
    }
    const amount = requestedAmount;
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: token ? `sk_${token}`.slice(0, 40) : `sk_${Date.now()}`,
      notes: { source: "SK Graphics checkout", idempotencyKey: token || "none" }
    });

    return res.status(201).json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || process.env.API_KEY_3
    });
  } catch (error) {
    console.error("RAZORPAY ORDER ERROR:", error.message);
    return res.status(502).json({ ok: false, message: "Unable to start payment. Please try again." });
  }
});

app.post(["/api/payments/verify", "/api/verify-payment"], async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, message: "Incomplete payment response" });
    }

    const paymentSecret = process.env.RAZORPAY_KEY_SECRET || process.env.API_KEY_3_SECRET || process.env.API_SECRET_3 || process.env.API_KEY_4;
    if (!paymentSecret) return res.status(503).json({ ok: false, message: "Payment verification is not configured on the server" });

    const expectedSignature = crypto
      .createHmac("sha256", paymentSecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(String(razorpay_signature));
    if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return res.status(400).json({ ok: false, message: "Payment signature could not be verified" });
    }

    const razorpay = getRazorpay();
    if (!razorpay) return res.status(503).json({ ok: false, message: "Razorpay is not configured on the server" });
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.order_id !== razorpay_order_id || payment.status !== "captured") {
      return res.status(409).json({ ok: false, message: "Payment is not captured yet", status: payment.status });
    }

    return res.json({ ok: true, confirmed: true, paymentId: payment.id, status: payment.status });
  } catch (error) {
    console.error("RAZORPAY VERIFY ERROR:", error.message);
    return res.status(502).json({ ok: false, message: "Payment received but confirmation failed. Please contact support." });
  }
});

/* =========================
   TEST API
========================= */

app.get("/api/test", (req, res) => {
  res.json({
    ok: true,
    message: "SK GRAPHICS backend is working"
  });
});

app.use((req, res) => {
  return res.status(404).json({ ok: false, message: "Route not found" });
});

app.use((error, req, res, next) => {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("UNHANDLED REQUEST ERROR:");
  console.error(err.stack);
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  return res.status(status).json({
    ok: false,
    error: status < 500 ? err.message : "An unexpected server error occurred. Please try again.",
    errorCode: err.code || err.name || "INTERNAL_REQUEST_ERROR"
  });
});

module.exports = app;
