import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { Category, Product } from "./models.js";

export const SEED_CATEGORIES = [
  {
    name: "Nitrogen Fertilisers",
    products: [
      {
        name: "Urea 46% N (Neem Coated)",
        unit: "45 kg bag",
        cp: 242,
        sp: 266.5,
        stockQty: 120,
        reorderLevel: 25,
      },
      {
        name: "Ammonium Sulphate 21% N",
        unit: "50 kg bag",
        cp: 780,
        sp: 890,
        stockQty: 40,
        reorderLevel: 10,
      },
      {
        name: "Calcium Ammonium Nitrate",
        unit: "50 kg bag",
        cp: 1080,
        sp: 1240,
        stockQty: 18,
        reorderLevel: 8,
      },
    ],
  },
  {
    name: "Phosphatic Fertilisers",
    products: [
      {
        name: "Single Super Phosphate 16%",
        unit: "50 kg bag",
        cp: 360,
        sp: 430,
        stockQty: 70,
        reorderLevel: 15,
      },
      {
        name: "DAP 18:46:0",
        unit: "50 kg bag",
        cp: 1320,
        sp: 1350,
        stockQty: 85,
        reorderLevel: 20,
      },
      {
        name: "Rock Phosphate Powder",
        unit: "50 kg bag",
        cp: 540,
        sp: 640,
        stockQty: 22,
        reorderLevel: 8,
      },
    ],
  },
  {
    name: "Potassic Fertilisers",
    products: [
      {
        name: "Muriate of Potash 60% K",
        unit: "50 kg bag",
        cp: 1680,
        sp: 1820,
        stockQty: 36,
        reorderLevel: 10,
      },
      {
        name: "Sulphate of Potash",
        unit: "50 kg bag",
        cp: 2650,
        sp: 2980,
        stockQty: 14,
        reorderLevel: 6,
      },
      {
        name: "Potassium Nitrate 13:0:45",
        unit: "25 kg bag",
        cp: 2100,
        sp: 2450,
        stockQty: 6,
        reorderLevel: 8,
      },
    ],
  },
  {
    name: "NPK Complex Fertilisers",
    products: [
      {
        name: "NPK 10:26:26",
        unit: "50 kg bag",
        cp: 1420,
        sp: 1580,
        stockQty: 48,
        reorderLevel: 12,
      },
      {
        name: "NPK 12:32:16",
        unit: "50 kg bag",
        cp: 1475,
        sp: 1640,
        stockQty: 30,
        reorderLevel: 10,
      },
      {
        name: "NPK 20:20:0:13",
        unit: "50 kg bag",
        cp: 1180,
        sp: 1320,
        stockQty: 26,
        reorderLevel: 10,
      },
    ],
  },
  {
    name: "Crop Protection",
    products: [
      {
        name: "Chlorpyrifos 20% EC (insecticide)",
        unit: "1 litre",
        cp: 265,
        sp: 320,
        stockQty: 40,
        reorderLevel: 12,
      },
      {
        name: "Mancozeb 75% WP (fungicide)",
        unit: "1 kg",
        cp: 310,
        sp: 375,
        stockQty: 55,
        reorderLevel: 15,
      },
      {
        name: "Imidacloprid 17.8% SL (insecticide)",
        unit: "250 ml",
        cp: 165,
        sp: 210,
        stockQty: 3,
        reorderLevel: 10,
      },
    ],
  },
];

export async function seedIfEmpty() {
  const count = await Category.countDocuments();
  if (count > 0) return { seeded: false, categories: count };
  for (const group of SEED_CATEGORIES) {
    const category = await Category.create({ name: group.name });
    await Product.insertMany(
      group.products.map((product) => ({
        ...product,
        category: category._id,
      })),
    );
  }
  return { seeded: true, categories: SEED_CATEGORIES.length };
}

async function runCli() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const result = await seedIfEmpty();
  if (result.seeded) {
    console.log(`Seeded ${result.categories} categories.`);
  } else {
    console.log("Database already has categories. Nothing inserted.");
  }
  await mongoose.disconnect();
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  runCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
