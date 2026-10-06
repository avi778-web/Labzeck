const express = require("express");
const path = require("path");

const Gmailmodel = require("./models/email.model");

const app = express();

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
   TEST API
========================= */

app.get("/api/test", (req, res) => {
  res.json({
    ok: true,
    message: "Labzeck backend is working"
  });
});

module.exports = app;