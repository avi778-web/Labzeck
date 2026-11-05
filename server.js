require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/db/db");

const PORT = process.env.PORT || 8000;

async function startServer() {
  try {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("SERVER START ERROR:", error);
    process.exitCode = 1;
    return;
  }

  try {
    await connectDB();
    console.log("MONGO STATUS: CONNECTED");
  } catch (error) {
    console.error("MongoDB unavailable; the website will remain available:", error.message);
  }
}

process.on("unhandledRejection", (error) => {
  console.error("UNHANDLED PROMISE REJECTION:", error);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
  process.exitCode = 1;
});

if (require.main === module) {
  startServer().catch((error) => {
    console.error("FATAL STARTUP ERROR:", error);
    process.exitCode = 1;
  });
} else {
  module.exports = app;
}
