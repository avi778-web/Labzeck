require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const { z } = require("zod");
const { cloudinaryConfigured, uploadToCloudinary } = require("./cloudinary");

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
    location: z.object({ latitude: z.coerce.number().finite(), longitude: z.coerce.number().finite() }).nullable().optional()
  }).passthrough(),
  items: z.array(itemSchema).min(1).max(50),
  total: z.coerce.number().finite().nonnegative(),
  deliveryFee: z.coerce.number().finite().nonnegative().optional(),
  couponCode: z.string().trim().max(80).optional(),
  couponCodes: z.array(z.string().trim().max(40)).max(2).optional(),
  couponApplied: z.object({ codes: z.array(z.string().trim().max(40)).max(2).optional(), code: z.string().trim().max(80).optional(), discountAmount: z.coerce.number().nonnegative() }).optional(),
  paymentMethod: z.enum(["COD", "UPI", "Netbanking", "PhonePe", "Razorpay", "GPay", "Paytm", "UPI QR Code"]).optional(),
  paymentStatus: z.enum(["pending", "paid", "cod", "failed"]).optional()
}).passthrough();
const COUPON_DATABASE = [
  { code: 'SK@150#VIP!', discount: 150 }, { code: 'SURAJ?150#MAX', discount: 150 }, { code: 'AVI$150,SUPER', discount: 150 }, { code: 'LABZECK!150?PRO', discount: 150 }, { code: 'SK_GRAPHICS#150?', discount: 150 },
  { code: 'SK@100#MEGA!', discount: 100 }, { code: 'SURAJ$100?DEAL', discount: 100 }, { code: 'AVI#100!BONUS', discount: 100 }, { code: 'LABZECK,100@GOLD', discount: 100 }, { code: 'PRINT?100#SAVE$', discount: 100 },
  { code: 'SK@30#SAVE!', discount: 30 }, { code: 'SURAJ?30$OFF', discount: 30 }, { code: 'AVI!30,PRINT#', discount: 30 }, { code: 'LABZECK#30?DEAL', discount: 30 }, { code: 'SK$30@CARD!', discount: 30 }, { code: 'SURAJ,30#FLYER?', discount: 30 }, { code: 'AVI?30!BANNER$', discount: 30 }, { code: 'LABZECK@30#MUG,', discount: 30 }, { code: 'SK!30?TSHIRT#', discount: 30 }, { code: 'SURAJ#30$ORDER!', discount: 30 }, { code: 'AVI,30@CUT?', discount: 30 }, { code: 'LABZECK?30!PRO#', discount: 30 }, { code: 'SK#30$GIFT,', discount: 30 }, { code: 'SURAJ!30@BEST?', discount: 30 }, { code: 'AVI@30#NOW!', discount: 30 }, { code: 'LABZECK$30?WIN,', discount: 30 }, { code: 'SK?30,FAST#', discount: 30 }, { code: 'SURAJ!30#LOOT$', discount: 30 }, { code: 'AVI#30?EXTRA!', discount: 30 }, { code: 'LABZECK,30@TOP$', discount: 30 }, { code: 'SK@30!DISCOUNT?', discount: 30 }, { code: 'SURAJ$30#CART,', discount: 30 }, { code: 'AVI?30,PRESS!', discount: 30 }, { code: 'LABZECK!30#SHOP$', discount: 30 }, { code: 'SK#30?EXPRESS,', discount: 30 }, { code: 'SURAJ,30@PLUS!', discount: 30 }, { code: 'AVI!30#SMART?', discount: 30 }, { code: 'LABZECK$30,QUICK!', discount: 30 }, { code: 'SK?30#SUPER$', discount: 30 }, { code: 'SURAJ@30!DEAL?', discount: 30 },
  { code: 'SK@20#MINI!', discount: 20 }, { code: 'SURAJ?20$SAVER', discount: 20 }, { code: 'AVI!20,CASH#', discount: 20 }, { code: 'LABZECK#20?LITE', discount: 20 }, { code: 'SK$20@OFFER!', discount: 20 }, { code: 'SURAJ,20#PACK?', discount: 20 }, { code: 'AVI?20!FLEX$', discount: 20 }, { code: 'LABZECK@20#TINY,', discount: 20 }, { code: 'SK!20?DROP#', discount: 20 }, { code: 'SURAJ#20$FLASH!', discount: 20 }, { code: 'AVI,20@LESS?', discount: 20 }, { code: 'LABZECK?20!EASY#', discount: 20 }, { code: 'SK#20$COIN,', discount: 20 }, { code: 'SURAJ!20@CHIP?', discount: 20 }, { code: 'AVI@20#PASS!', discount: 20 }, { code: 'LABZECK$20?LINK,', discount: 20 }, { code: 'SK?20,ITEM#', discount: 20 }, { code: 'SURAJ!20#TICK$', discount: 20 }, { code: 'AVI#20?SNAP!', discount: 20 }, { code: 'LABZECK,20@SPOT$', discount: 20 }, { code: 'SK@20!FAST?', discount: 20 }, { code: 'SURAJ$20#SAFE,', discount: 20 }, { code: 'AVI?20,COOL!', discount: 20 }, { code: 'LABZECK!20#NICE$', discount: 20 }, { code: 'SK#20?GOOD,', discount: 20 }, { code: 'SURAJ,20@BEST!', discount: 20 }, { code: 'AVI!20#FINE?', discount: 20 }, { code: 'LABZECK$20,SURE!', discount: 20 }, { code: 'SK?20#REAL$', discount: 20 }, { code: 'SURAJ@20!TRUE?', discount: 20 },
  { code: 'SK@10#TOKEN!', discount: 10 }, { code: 'SURAJ?10$TINY', discount: 10 }, { code: 'AVI!10,DISC#', discount: 10 }, { code: 'LABZECK#10?PERK', discount: 10 }, { code: 'SK$10@STAR!', discount: 10 }, { code: 'SURAJ,10#NOTE?', discount: 10 }, { code: 'AVI?10!DOT$', discount: 10 }, { code: 'LABZECK@10#POINT,', discount: 10 }, { code: 'SK!10?MARK#', discount: 10 }, { code: 'SURAJ#10$BIT!', discount: 10 }, { code: 'AVI,10@BYTE?', discount: 10 }, { code: 'LABZECK?10!MICRO#', discount: 10 }, { code: 'SK#10$CENT,', discount: 10 }, { code: 'SURAJ!10@MINI?', discount: 10 }, { code: 'AVI@10#SMALL!', discount: 10 }, { code: 'LABZECK$10?LITTLE,', discount: 10 }, { code: 'SK?10,ONE#', discount: 10 }, { code: 'SURAJ!10#ZERO$', discount: 10 }, { code: 'AVI#10?FIRST!', discount: 10 }, { code: 'LABZECK,10@BASE$', discount: 10 }, { code: 'SK@10!LOW?', discount: 10 }, { code: 'SURAJ$10#SLIM,', discount: 10 }, { code: 'AVI?10,LIGHT!', discount: 10 }, { code: 'LABZECK!10#SOFT$', discount: 10 }, { code: 'SK#10?EASY,', discount: 10 }, { code: 'SURAJ,10@PURE!', discount: 10 }, { code: 'AVI!10#SIMPLE?', discount: 10 }, { code: 'LABZECK$10,PLAIN!', discount: 10 }, { code: 'SK?10#FLAT$', discount: 10 }, { code: 'SURAJ@10!BASIC?', discount: 10 }
];
const couponRegistry = new Map(COUPON_DATABASE.map(({ code, discount }) => [code, discount]));
const normalizeCoupon = (value) => String(value || '').trim().toUpperCase();
const calculateCouponDiscount = (code, subtotal) => Math.min(Math.max(0, subtotal), couponRegistry.get(code) || 0);
const paymentOrderSchema = z.object({
  amount: z.coerce.number().int().min(100).max(100000000),
  items: z.array(itemSchema).min(1).max(50),
  idempotencyKey: z.string().trim().max(100).optional()
}).passthrough();
const qrPaymentSchema = z.object({
  amount: z.coerce.number().int().min(100).max(100000000),
  idempotencyKey: z.string().trim().max(100).optional()
});
const paymentVerificationSchema = z.object({
  razorpay_order_id: z.string().trim().min(1).max(120),
  razorpay_payment_id: z.string().trim().min(1).max(120),
  razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/i)
});
const mongoConnectionString = process.env.MONGODB_CONNECTION_STRING_3 || process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING || process.env.MONGO_URI;
let razorpayClient = null;
function getRazorpayCredentials() {
  const candidates = [
    [process.env.API_KEY, process.env.API_KEY_2],
    [process.env.RAZORPAY_KEY_ID, process.env.RAZORPAY_KEY_SECRET],
    [process.env.API_KEY_3, process.env.API_KEY_4],
    [process.env.API_KEY_3, process.env.API_KEY_3_SECRET || process.env.API_SECRET_3]
  ];
  const [keyId, keySecret] = candidates.find(([id, secret]) => id && secret) || [];
  return keyId && keySecret ? { keyId, keySecret } : null;
}
function getRazorpay() {
  const credentials = getRazorpayCredentials();
  if (!credentials) return null;
  if (!razorpayClient) razorpayClient = new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret });
  return razorpayClient;
}

const connectDB = require("./db/db");
const Gmailmodel = require("./models/email.model");
const OrderModel = require("./models/order.model");
const CouponClaimModel = require("./models/coupon-claim.model");

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
  if (!databaseConnectionPromise) databaseConnectionPromise = connectDB().then(() => true).catch(() => false).finally(() => { databaseConnectionPromise = null; });
  return databaseConnectionPromise;
}
const rateLimitState = new Map();
function sensitiveRouteRateLimit(req, res, next) {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  if (rateLimitState.size > 5000) for (const [entryKey, entry] of rateLimitState) if (now - entry.startedAt >= 60_000) rateLimitState.delete(entryKey);
  const current = rateLimitState.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    rateLimitState.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= 30) return res.status(429).json({ ok: false, message: "Too many requests. Please try again shortly." });
  current.count += 1;
  return next();
}
function supportOrderLookupRateLimit(req, res, next) {
  res.set("Cache-Control", "no-store");
  const key = `support-order-lookup:${req.ip}`;
  const now = Date.now();
  const current = rateLimitState.get(key);
  if (!current || now - current.startedAt >= 10 * 60_000) {
    rateLimitState.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= 8) return res.status(429).json({ ok: false, message: "For your privacy, order lookups are limited. Please try again later or call our team." });
  current.count += 1;
  return next();
}
app.use(["/api/newsletter", "/api/uploads", "/api/create-order", "/api/payments/order", "/api/payments/qr", "/api/verify-payment", "/api/payments/verify"], sensitiveRouteRateLimit);

app.use(express.json({ limit: "70mb" }));
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

app.post("/api/uploads", async (req, res) => {
  try {
    const { data, mimeType } = req.body || {};
    if (typeof data !== "string" || !/^data:(image\/(png|jpeg)|application\/pdf|application\/postscript|application\/illustrator|application\/x-photoshop|image\/vnd\.adobe\.photoshop);base64,/.test(data)) {
      return res.status(400).json({ ok: false, message: "Only PNG, JPG, PDF, AI, or PSD files are supported" });
    }
    const raw = data.split(",")[1];
    const buffer = Buffer.from(raw, "base64");
    if (!buffer.length || buffer.length > 15 * 1024 * 1024) return res.status(413).json({ ok: false, message: "File is too large. Maximum upload size is 50MB." });
    if (cloudinaryConfigured()) {
      const upload = await uploadToCloudinary(data, { folder: "sk-graphics/artwork" });
      return res.status(201).json({ ok: true, url: upload.secureUrl, imageUrl: upload.secureUrl, publicId: upload.publicId, storage: "cloudinary" });
    }
    const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${extension}`;
    fs.writeFileSync(path.join(uploadsDirectory, filename), buffer, { flag: "wx" });
    return res.status(201).json({ ok: true, url: `/uploads/${filename}`, imageUrl: `/uploads/${filename}`, storage: "local-fallback" });
  } catch (error) {
    console.error("UPLOAD ERROR:", error.message);
    const status = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    return res.status(status).json({ ok: false, message: error.message || "Could not save upload" });
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

app.get('/configurator', (req, res) => res.render('configurator'));

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

    console.log("Newsletter subscription saved");

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

app.post('/api/coupons/validate', sensitiveRouteRateLimit, async (req, res) => {
  const subtotal = Number(req.body?.subtotal);
  const reservationId = String(req.body?.reservationId || '').trim().slice(0, 100);
  const codes = [...new Set((Array.isArray(req.body?.codes) ? req.body.codes : [req.body?.code]).map(normalizeCoupon).filter(Boolean))].slice(0, 2);
  if (!codes.length || !reservationId || !Number.isFinite(subtotal) || subtotal < 0) return res.status(400).json({ ok: false, message: 'Invalid or Already Used Coupon' });
  if (codes.some(code => !couponRegistry.has(code))) return res.status(400).json({ ok: false, message: 'Invalid or Already Used Coupon' });
  try {
    if (!(await ensureDatabase())) return res.status(503).json({ ok: false, message: 'Coupon service is temporarily unavailable.' });
    const priorOrder = await OrderModel.findOne({ $or: [{ 'couponApplied.codes': { $in: codes } }, { 'couponApplied.code': { $in: codes } }] }).select('_id').lean();
    if (priorOrder) return res.status(409).json({ ok: false, message: 'Invalid or Already Used Coupon' });
    for (const code of codes) {
      const existingClaim = await CouponClaimModel.findOne({ code }).lean();
      if (existingClaim && (existingClaim.reservationId !== reservationId || existingClaim.state !== 'reserved')) return res.status(409).json({ ok: false, message: 'Invalid or Already Used Coupon' });
      if (!existingClaim) {
        try { await CouponClaimModel.create({ code, reservationId }); }
        catch (claimError) { if (claimError.code === 11000) return res.status(409).json({ ok: false, message: 'Invalid or Already Used Coupon' }); throw claimError; }
      }
    }
    let remaining = subtotal;
    const coupons = codes.map(code => { const discountAmount = calculateCouponDiscount(code, remaining); remaining -= discountAmount; return { code, discountAmount }; });
    return res.json({ ok: true, coupons, discountAmount: coupons.reduce((sum, coupon) => sum + coupon.discountAmount, 0), deliveryFee: 0 });
  } catch (error) {
    console.error('COUPON VALIDATION ERROR:', error.message);
    return res.status(503).json({ ok: false, message: 'Coupon service is temporarily unavailable.' });
  }
});

app.post("/api/support/orders", supportOrderLookupRateLimit, async (req, res) => {
  const phoneDigits = String(req.body?.phone || "").replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return res.status(400).json({ ok: false, message: "Enter the phone number used when placing your order." });
  }

  try {
    if (!(await ensureDatabase())) return res.status(503).json({ ok: false, message: "Order status is temporarily unavailable. Please call our team." });
    const lastTenDigits = phoneDigits.slice(-10);
    const phonePattern = new RegExp(lastTenDigits.split("").join("\\D*"));
    const orders = await OrderModel.find({ "customer.phone": { $regex: phonePattern } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select({ _id: 1, status: 1, createdAt: 1, total: 1, "items.name": 1, "items.quantity": 1 })
      .lean();

    return res.json({
      ok: true,
      orders: orders.map((order) => ({
        id: String(order._id).slice(-6).toUpperCase(),
        status: order.status || "received",
        createdAt: order.createdAt || null,
        total: Number(order.total) || 0,
        items: (order.items || []).slice(0, 5).map((item) => ({
          name: String(item.name || "Printed item").slice(0, 100),
          quantity: Math.max(1, Math.min(999, Number(item.quantity) || 1))
        }))
      }))
    });
  } catch (error) {
    console.error("SUPPORT ORDER LOOKUP ERROR:", error.message);
    return res.status(503).json({ ok: false, message: "Order status is temporarily unavailable. Please call our team." });
  }
});

app.post("/api/orders", sensitiveRouteRateLimit, async (req, res) => {
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
    const deliveryFee = 0;
    const total = Number(body.total);
    const calculatedTotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);
    const submittedCouponCodes = [...new Set((Array.isArray(body.couponCodes) ? body.couponCodes : [body.couponCode || body.couponApplied?.code]).map(normalizeCoupon).filter(Boolean))].slice(0, 2);
    const invalidCoupon = submittedCouponCodes.find(code => !couponRegistry.has(code));
    const subtotal = calculatedTotal;
    const bulkDiscount = Math.max(0, Number(body.bulkDiscount) || 0);
    let remainingAfterBulk = Math.max(0, subtotal - bulkDiscount);
    const couponDiscount = submittedCouponCodes.reduce((sum, code) => { const discount = calculateCouponDiscount(code, remainingAfterBulk); remainingAfterBulk -= discount; return sum + discount; }, 0);
    const expectedTotal = remainingAfterBulk;
    const idempotencyKey = String(body.idempotencyKey || '').trim().slice(0, 100);
    const claimToken = String(body.claimToken || idempotencyKey).trim().slice(0, 100);
    const latitude = Number(customer.location && customer.location.latitude);
    const longitude = Number(customer.location && customer.location.longitude);

    const validItems = items.length <= 50 && items.every((item) => item && typeof item === "object" && String(item.name || "").trim().length <= 160 && Number.isFinite(Number(item.price)) && Number(item.price) >= 0 && Number.isInteger(Number(item.qty)) && Number(item.qty) >= 1 && Number(item.qty) <= 999);
    if (!name || name.length > 120 || !phone || phone.length > 30 || !address || address.length > 500 || !validItems || !Number.isFinite(total) || total < 0 || !Number.isFinite(calculatedTotal) || !Number.isFinite(bulkDiscount) || bulkDiscount > subtotal || Math.abs(total - expectedTotal) > 0.01 || invalidCoupon || submittedCouponCodes.length > 2 || !["COD", "UPI", "Netbanking", "PhonePe", "Razorpay", "GPay", "Paytm", "UPI QR Code"].includes(paymentMethod) || !Number.isFinite(deliveryFee) || deliveryFee < 0) {
      return res.status(400).json({ ok: false, message: "Order total or cart items are invalid. Please refresh your cart and try again." });
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
    if (submittedCouponCodes.length) {
      const priorCouponOrder = await OrderModel.findOne({ $or: [{ 'couponApplied.codes': { $in: submittedCouponCodes } }, { 'couponApplied.code': { $in: submittedCouponCodes } }] }).select('_id').lean();
      const reservations = await CouponClaimModel.find({ code: { $in: submittedCouponCodes }, reservationId: claimToken, state: 'reserved' }).select('code').lean();
      if (priorCouponOrder || reservations.length !== submittedCouponCodes.length) return res.status(409).json({ ok: false, message: 'Invalid or Already Used Coupon' });
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
          imageUrl: String(item.customization.imageUrl || item.customization.designFile || '').slice(0, 3000000),
          imageLink: String(item.customization.imageLink || item.customization.designFile || '').slice(0, 3000000),
          extraAsset: String(item.customization.extraAsset || '').slice(0, 3000000),
          options: item.customization.options && typeof item.customization.options === 'object' ? item.customization.options : undefined
        }
      })),
      subtotal,
      bulkDiscount,
      total: expectedTotal,
      couponApplied: submittedCouponCodes.length ? { code: submittedCouponCodes[0], codes: submittedCouponCodes, discountAmount: couponDiscount } : undefined,
      isPrepaid: paymentStatus === 'paid' || ['UPI', 'PhonePe', 'Razorpay', 'GPay', 'Paytm', 'UPI QR Code'].includes(paymentMethod) && paymentStatus === 'paid',
      uploadedDesignUrl: String(body.uploadedDesignUrl || '').trim().slice(0, 2000) || undefined,
      uploadedPhotoUrl: String(body.uploadedPhotoUrl || '').trim().slice(0, 2000) || undefined,
      notes,
      paymentMethod,
      paymentStatus: ["pending", "paid", "cod", "failed"].includes(paymentStatus) ? paymentStatus : "pending",
      transactionId: transactionId || undefined,
      razorpayOrderId: razorpayOrderId || undefined,
      deliveryFee,
      idempotencyKey: idempotencyKey || undefined,
      orderType: "standard"
      });
      if (submittedCouponCodes.length) await CouponClaimModel.updateMany({ code: { $in: submittedCouponCodes }, reservationId: claimToken, state: 'reserved' }, { $set: { state: 'redeemed', orderId: order._id } });
    } catch (saveError) {
      console.error("ORDER SAVE ERROR:", saveError.stack || saveError);
      if (saveError.name === "ValidationError" || saveError.name === "CastError") {
        return res.status(400).json({ ok: false, message: "Order data is invalid" });
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
    const parsed = paymentOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid payment request", issues: parsed.error.issues.map((issue) => issue.path.join(".")).slice(0, 10) });
    const requestedAmount = parsed.data.amount;
    const paymentItems = parsed.data.items;
    const subtotalAmount = paymentItems.reduce((sum, item) => sum + Math.max(0, Number(item.price) || 0) * Math.max(1, Math.min(999, Number(item.qty) || 1)), 0);
    const paymentCouponCodes = [...new Set((Array.isArray(parsed.data.couponCodes) ? parsed.data.couponCodes : [parsed.data.couponCode]).map(normalizeCoupon).filter(Boolean))].slice(0, 2);
    const bulkDiscount = Math.max(0, Number(parsed.data.bulkDiscount) || 0);
    const claimToken = String(parsed.data.claimToken || parsed.data.idempotencyKey || '').trim().slice(0, 100);
    if (bulkDiscount > subtotalAmount || paymentCouponCodes.some(code => !couponRegistry.has(code))) return res.status(400).json({ ok: false, message: 'Invalid payment amount or coupon' });
    if (paymentCouponCodes.length) {
      if (!(await ensureDatabase())) return res.status(503).json({ ok: false, message: 'Coupon service is temporarily unavailable.' });
      const priorOrder = await OrderModel.findOne({ $or: [{ 'couponApplied.codes': { $in: paymentCouponCodes } }, { 'couponApplied.code': { $in: paymentCouponCodes } }] }).select('_id').lean();
      const reservations = await CouponClaimModel.find({ code: { $in: paymentCouponCodes }, reservationId: claimToken, state: 'reserved' }).select('code').lean();
      if (priorOrder || reservations.length !== paymentCouponCodes.length) return res.status(409).json({ ok: false, message: 'Invalid or Already Used Coupon' });
    }
    let payable = Math.max(0, subtotalAmount - bulkDiscount);
    const couponDiscount = paymentCouponCodes.reduce((sum, code) => { const discount = calculateCouponDiscount(code, payable); payable -= discount; return sum + discount; }, 0);
    const calculatedAmount = Math.round(payable * 100);
    const token = String((req.body && req.body.idempotencyKey) || '').trim().slice(0, 100);
    if (!paymentItems.length || calculatedAmount !== requestedAmount || !Number.isInteger(requestedAmount) || requestedAmount < 100 || requestedAmount > 100000000) {
      return res.status(400).json({ ok: false, message: "Invalid payment amount" });
    }
    const razorpay = getRazorpay();
    if (!razorpay) return res.status(201).json({ ok: true, simulated: true, orderId: `sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`, amount: requestedAmount, currency: 'INR', keyId: 'simulated' });
    const amount = requestedAmount;
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: token ? `sk${token}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40) : `sk${Date.now()}`,
      notes: { source: "SK Graphics checkout", idempotencyKey: token || "none" }
    });

    return res.status(201).json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayCredentials().keyId
    });
  } catch (error) {
    const paymentError = error?.error?.description || error?.response?.description || error?.message || "Razorpay request failed";
    console.error("RAZORPAY ORDER ERROR:", paymentError);
    return res.status(502).json({ ok: false, message: paymentError === "Authentication failed" ? "Razorpay credentials are invalid. Please use the active Razorpay test/live keys." : "Unable to start payment. Please try again." });
  }
});

app.post("/api/payments/qr", async (req, res) => {
  try {
    const parsed = qrPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Invalid QR payment amount" });
    const razorpay = getRazorpay();
    if (!razorpay) return res.status(503).json({ ok: false, message: "Razorpay is not configured on the server" });
    if (!razorpay.qrCode?.create) return res.status(503).json({ ok: false, message: "Razorpay QR payments are not enabled for this account. Use the Razorpay checkout QR option." });
    const qr = await razorpay.qrCode.create({ type: "upi", name: "SK Graphics", usage: "single_use", fixed_amount: true, payment_amount: parsed.data.amount, description: "SK Graphics order", close_by: Math.floor(Date.now() / 1000) + 1800, notes: { idempotencyKey: parsed.data.idempotencyKey || "none" } });
    return res.status(201).json({ ok: true, qrId: qr.id, imageUrl: qr.image_url, amount: parsed.data.amount });
  } catch (error) {
    console.error("RAZORPAY QR ERROR:", error?.error?.description || error?.message || error);
    return res.status(502).json({ ok: false, message: "Unable to create Razorpay QR. Please try UPI App payment." });
  }
});

app.post(["/api/payments/verify", "/api/verify-payment"], async (req, res) => {
  try {
    const parsed = paymentVerificationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, message: "Incomplete or invalid payment response" });
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
    if (String(razorpay_order_id).startsWith('sim_') && String(razorpay_payment_id).startsWith('sim_')) return res.json({ ok: true, confirmed: true, paymentId: razorpay_payment_id, status: 'captured', simulated: true });

    const credentials = getRazorpayCredentials();
    const paymentSecret = credentials?.keySecret;
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
