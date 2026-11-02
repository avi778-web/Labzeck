const express = require("express");
const path = require("path");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const Gmailmodel = require("./models/email.model");

const app = express();

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/assets", express.static(path.join(__dirname, "..", "assets")));

/* =========================
   EJS SETUP
========================= */

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, ".."));

/* =========================
   HOME PAGE
========================= */

app.get("/", (req, res) => {
  res.render("index");
});

/* =========================
   NEWSLETTER API
   ONLY EMAIL SAVE HOGA
========================= */

app.post("/api/newsletter", async (req, res) => {
  console.log("📩 NEWSLETTER API HIT");
  console.log("📦 DATA:", req.body);

  try {
    const email = String(req.body.email || "")
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
   RAZORPAY PAYMENTS
========================= */

app.post("/api/payments/order", async (req, res) => {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(503).json({ ok: false, message: "Razorpay is not configured on the server" });
    }

    const amount = 74900;
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `sk_${Date.now()}`,
      notes: { product: "Premium business cards", quantity: "1" }
    });

    return res.status(201).json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error("RAZORPAY ORDER ERROR:", error.message);
    return res.status(502).json({ ok: false, message: "Unable to start payment. Please try again." });
  }
});

app.post("/api/payments/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, message: "Incomplete payment response" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature))) {
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
    message: "Labzeck backend is working"
  });
});

module.exports = app;
