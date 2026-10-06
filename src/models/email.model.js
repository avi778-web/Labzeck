const mongoose = require("mongoose");

const gmailSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const Gmailmodel = mongoose.model("Gmail", gmailSchema, "newsletter");

module.exports = Gmailmodel;