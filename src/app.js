import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import {
  attachUser,
  forgotPassword,
  forgotUserId,
  login,
  requireAuth,
  resetPassword,
  signup,
} from "./auth.js";
import {
  createCategory,
  createProduct,
  createPurchase,
  createSale,
  deletePurchase,
  deleteSale,
  getDashboard,
  listCategories,
  listProducts,
  listPurchases,
  listSales,
} from "./stock.js";
import {
  presentCategory,
  presentProduct,
  presentPurchase,
  presentSale,
} from "./present.js";

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function corsOrigins() {
  const raw =
    process.env.CORS_ORIGIN ||
    "http://127.0.0.1:43123,http://localhost:43123";
  const list = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (list.includes("*")) return "*";
  return list;
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use(cors({ origin: corsOrigins() }));
  app.use(attachUser);

  app.get("/health", (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(200).json({
      ok: true,
      service: "shopstore-backend",
      db: ready ? "connected" : "disconnected",
    });
  });

  app.post(
    "/api/auth/signup",
    asyncHandler(async (req, res) => {
      const result = await signup(req.body ?? {});
      res.status(201).json(result);
    }),
  );

  app.post(
    "/api/auth/login",
    asyncHandler(async (req, res) => {
      const result = await login(req.body ?? {});
      res.json(result);
    }),
  );

  app.post(
    "/api/auth/forgot-userid",
    asyncHandler(async (req, res) => {
      res.json(await forgotUserId(req.body ?? {}));
    }),
  );

  app.post(
    "/api/auth/forgot-password",
    asyncHandler(async (req, res) => {
      res.json(await forgotPassword(req.body ?? {}));
    }),
  );

  app.post(
    "/api/auth/reset-password",
    asyncHandler(async (req, res) => {
      res.json(await resetPassword(req.body ?? {}));
    }),
  );

  app.get(
    "/api/auth/me",
    asyncHandler(async (req, res) => {
      if (!req.user) {
        res.status(401).json({ error: "Sign in to use the stock book." });
        return;
      }
      res.json({ user: req.user });
    }),
  );

  app.use("/api", requireAuth);

  app.get(
    "/api/categories",
    asyncHandler(async (_req, res) => {
      const rows = await listCategories();
      res.json(rows.map(presentCategory));
    }),
  );

  app.post(
    "/api/categories",
    asyncHandler(async (req, res) => {
      const row = await createCategory(req.body ?? {});
      res.status(201).json(presentCategory(row));
    }),
  );

  app.get(
    "/api/products",
    asyncHandler(async (_req, res) => {
      const rows = await listProducts();
      res.json(rows.map(presentProduct));
    }),
  );

  app.post(
    "/api/products",
    asyncHandler(async (req, res) => {
      const row = await createProduct(req.body ?? {});
      res.status(201).json(presentProduct(row));
    }),
  );

  app.get(
    "/api/purchases",
    asyncHandler(async (_req, res) => {
      const rows = await listPurchases();
      res.json(rows.map(presentPurchase));
    }),
  );

  app.post(
    "/api/purchases",
    asyncHandler(async (req, res) => {
      const row = await createPurchase(req.body ?? {});
      await row.populate("lines.product");
      res.status(201).json(presentPurchase(row));
    }),
  );

  app.delete(
    "/api/purchases/:id",
    asyncHandler(async (req, res) => {
      await deletePurchase(req.params.id);
      res.json({ ok: true });
    }),
  );

  app.get(
    "/api/sales",
    asyncHandler(async (_req, res) => {
      const rows = await listSales();
      res.json(rows.map(presentSale));
    }),
  );

  app.post(
    "/api/sales",
    asyncHandler(async (req, res) => {
      const row = await createSale(req.body ?? {});
      await row.populate("lines.product");
      res.status(201).json(presentSale(row));
    }),
  );

  app.delete(
    "/api/sales/:id",
    asyncHandler(async (req, res) => {
      await deleteSale(req.params.id);
      res.json({ ok: true });
    }),
  );

  app.get(
    "/api/dashboard",
    asyncHandler(async (_req, res) => {
      res.json(await getDashboard());
    }),
  );

  app.use((_req, res) => {
    res.status(404).json({ error: "No such route." });
  });

  app.use((err, _req, res, _next) => {
    if (err?.name === "CastError") {
      res.status(400).json({ error: "That id is not valid." });
      return;
    }
    if (err?.name === "ValidationError") {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err?.code === 11000) {
      res.status(409).json({ error: "That name is already on the book." });
      return;
    }
    const status = Number(err?.status) || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      error:
        status >= 500
          ? "The stock book hit an unexpected error."
          : err.message || "Request failed.",
    });
  });

  return app;
}
