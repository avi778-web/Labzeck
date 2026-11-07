const mongoose = require("mongoose");

let connectionPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  const mongoURI = process.env.MONGODB_CONNECTION_STRING_3 || process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING || process.env.MONGO_URI;
  if (!mongoURI) throw new Error("MongoDB is not configured");

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
      minPoolSize: 0
    }).then(() => mongoose.connection).catch((error) => {
      connectionPromise = null;
      console.error("MongoDB connection failed:", error.message);
      throw error;
    });
  }

  return connectionPromise;
}

module.exports = connectDB;
