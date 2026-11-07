require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const { z } = require("zod");

const newsletterSchema = z.object({ email: z.string().trim().email().max(254) });
const itemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  price: z.coerce.number().finite().nonnegative(),
  qty: z.coerce.number().int().min(1).max(999)
}).passthrough();
const orderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(10).max(30),
    address: z.string().trim().min(1).max(500),
    location: z.object({ latitude: z.coerce.number().finite(), longitude: z.coerce.number().finite() }).optional()
  }).passthrough(),
  items: z.array(itemSchema).min(1).max(50),
  total: z.coerce.number().finite().nonnegative(),
  deliveryFee: z.coerce.number().finite().nonnegative().optional(),
  paymentMethod: z.enum(["COD", "UPI", "PhonePe", "Razorpay", "GPay", "Paytm", "UPI QR Code"]).optional(),
  paymentStatus: z.enum(["pending", "paid", "cod", "failed"]).optional()
}).passthrough();
const paymentOrderSchema = z.object({
  amount: z.coerce.number().int().min(100).max(100000000),
  items: z.array(itemSchema).min(1).max(50),
  idempotencyKey: z.string().trim().max(100).optional()
}).passthrough();
const paymentVerificationSchema = z.object({
  razorpay_order_id: z.string().trim().min(1).max(120),
  razorpay_payment_id: z.string().trim().min(1).max(120),
  razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/i)
});
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
const rateLimitState = new Map();
function sensitiveRouteRateLimit(req, res, next) {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const current = rateLimitState.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    rateLimitState.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= 30) return res.status(429).json({ ok: false, message: "Too many requests. Please try again shortly." });
  current.count += 1;
  return next();
}
app.use(["/api/newsletter", "/api/uploads", "/api/create-order", "/api/payments/order", "/api/verify-payment", "/api/payments/verify"], sensitiveRouteRateLimit);

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
  try {
    const parsed = newsletterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Enter a valid email address" });
    const email = parsed.data.email.toLowerCase();

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
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Order data is invalid", issues: parsed.error.issues.map((issue) => issue.path.join(".")).slice(0, 10) });
    const body = parsed.data;
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

    const parsed = paymentOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid payment request" });
    const requestedAmount = parsed.data.amount;
    const paymentItems = parsed.data.items;
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
    const parsed = paymentVerificationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Incomplete or invalid payment response" });
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

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
