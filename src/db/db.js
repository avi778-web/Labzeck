const mongoose = require("mongoose");

async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_CONNECTION_STRING_3 || process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING || process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGODB_CONNECTION_STRING is missing");
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
