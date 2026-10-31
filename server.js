require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/db/db");

const PORT = process.env.PORT || 8000;

function startServer() {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  connectDB()
    .then(() => console.log("MONGO STATUS: CONNECTED"))
    .catch((error) => {
      console.error("MongoDB unavailable; the website will remain available:", error.message);
    });
}

startServer();
