const mongoose = require("mongoose");

async function connectDB() {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGO_URI is missing in .env");
    }

    await mongoose.connect(mongoURI);

    console.log("✅ MongoDB connected");
    console.log("📦 Database:", mongoose.connection.name);

  } catch (error) {
    console.error("❌ MongoDB connection failed:");
    console.error(error.message);

    throw error;
  }
}

module.exports = connectDB;