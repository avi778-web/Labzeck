require("dotenv").config();

console.log(
  "ENV CHECK:",
  process.env.MONGO_URI ? "FOUND" : "NOT FOUND"
);

const app = require("./src/app");
const connectDB = require("./src/db/db");

const PORT = process.env.PORT || 8000;

async function startServer() {
  try {

    await connectDB();
    console.log("MONGO STATUS: CONNECTED");

    app.listen(PORT, () => {
      console.log(
        `🚀 Server running on http://localhost:${PORT}`
      );
    });

  } catch (error) {

    console.error(
      "❌ Server startup failed:",
      error.message
    );

    process.exit(1);
  }
}

startServer();