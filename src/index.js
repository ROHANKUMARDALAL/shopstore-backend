import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { seedIfEmpty } from "./seed.js";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. ShopStore API will not start.");
  process.exit(1);
}

const port = Number(process.env.PORT) || 43121;

try {
  await mongoose.connect(uri);
  const seed = await seedIfEmpty();
  if (seed.seeded) {
    console.log("Seeded categories and products into an empty database.");
  }
  const app = createApp();
  app.listen(port, "0.0.0.0", () => {
    console.log(`ShopStore API listening on http://0.0.0.0:${port}`);
  });
} catch (error) {
  console.error("ShopStore API failed to start.", error);
  process.exit(1);
}
