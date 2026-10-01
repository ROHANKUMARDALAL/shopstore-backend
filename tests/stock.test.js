import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { SEED_CATEGORIES, seedIfEmpty } from "../src/seed.js";

let mongod;
let server;
let base;

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { status: response.status, body };
}

async function makeProduct(overrides = {}) {
  const category = await api("/api/categories", {
    method: "POST",
    body: JSON.stringify({ name: overrides.categoryName || "Nitrogen Fertilisers" }),
  });
  assert.equal(category.status, 201);
  const product = await api("/api/products", {
    method: "POST",
    body: JSON.stringify({
      name: overrides.name || "Urea 46% N (Neem Coated)",
      category: category.body.id,
      unit: overrides.unit || "45 kg bag",
      cp: overrides.cp ?? 242,
      sp: overrides.sp ?? 266.5,
      stockQty: overrides.stockQty ?? 0,
      reorderLevel: overrides.reorderLevel ?? 10,
    }),
  });
  assert.equal(product.status, 201);
  return product.body;
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const app = createApp();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

test("purchase increases stock and sets the latest cost price", async () => {
  const product = await makeProduct({ stockQty: 10, cp: 242 });
  const purchase = await api("/api/purchases", {
    method: "POST",
    body: JSON.stringify({
      supplierName: "Krishak Co-op Depot",
      date: "2026-09-15",
      lines: [{ product: product.id, qty: 20, cp: 250 }],
    }),
  });
  assert.equal(purchase.status, 201);
  assert.equal(purchase.body.total, 5000);
  assert.equal(purchase.body.lines[0].cp, 250);

  const products = await api("/api/products");
  assert.equal(products.body[0].stockQty, 30);
  assert.equal(products.body[0].cp, 250);
  assert.equal(products.body[0].sp, 266.5);
});

test("a later purchase replaces cost price and adds quantity", async () => {
  const product = await makeProduct({ stockQty: 0, cp: 200 });
  const first = await api("/api/purchases", {
    method: "POST",
    body: JSON.stringify({
      supplierName: "Morning lorry",
      date: todayKey(),
      lines: [{ product: product.id, qty: 5, cp: 210 }],
    }),
  });
  assert.equal(first.status, 201);
  const second = await api("/api/purchases", {
    method: "POST",
    body: JSON.stringify({
      supplierName: "Afternoon lorry",
      date: todayKey(),
      lines: [
        { product: product.id, qty: 2, cp: 215 },
        { product: product.id, qty: 3, cp: 230 },
      ],
    }),
  });
  assert.equal(second.status, 201);
  const products = await api("/api/products");
  assert.equal(products.body[0].stockQty, 10);
  assert.equal(products.body[0].cp, 230);
});

test("sale decreases stock, sets selling price, and shows margin", async () => {
  const product = await makeProduct({ stockQty: 30, cp: 250, sp: 266.5 });
  const sale = await api("/api/sales", {
    method: "POST",
    body: JSON.stringify({
      customerShopName: "Sharma Krishi Bhandar",
      date: todayKey(),
      lines: [{ product: product.id, qty: 8, sp: 270 }],
    }),
  });
  assert.equal(sale.status, 201);
  assert.equal(sale.body.total, 2160);
  assert.equal(sale.body.margin, 160);
  assert.equal(sale.body.lines[0].cpAtSale, 250);

  const products = await api("/api/products");
  assert.equal(products.body[0].stockQty, 22);
  assert.equal(products.body[0].sp, 270);
  assert.equal(products.body[0].cp, 250);
});

test("cannot sell more than stock, and stock stays put", async () => {
  const product = await makeProduct({ stockQty: 12, sp: 320 });
  const sale = await api("/api/sales", {
    method: "POST",
    body: JSON.stringify({
      customerShopName: "Patel Agro",
      date: todayKey(),
      lines: [{ product: product.id, qty: 20, sp: 330 }],
    }),
  });
  assert.equal(sale.status, 409);
  assert.match(sale.body.error, /Only 12/);

  const products = await api("/api/products");
  assert.equal(products.body[0].stockQty, 12);
  assert.equal(products.body[0].sp, 320);

  const sales = await api("/api/sales");
  assert.deepEqual(sales.body, []);
});

test("lines for the same product are checked together against stock", async () => {
  const product = await makeProduct({ stockQty: 15 });
  const sale = await api("/api/sales", {
    method: "POST",
    body: JSON.stringify({
      customerShopName: "Two slips, one shop",
      lines: [
        { product: product.id, qty: 10, sp: 270 },
        { product: product.id, qty: 10, sp: 275 },
      ],
    }),
  });
  assert.equal(sale.status, 409);
  const products = await api("/api/products");
  assert.equal(products.body[0].stockQty, 15);
  assert.equal(products.body[0].sp, 266.5);
});

test("delete sale restores stock and leaves the selling price as posted", async () => {
  const product = await makeProduct({ stockQty: 22, cp: 250, sp: 266.5 });
  const sale = await api("/api/sales", {
    method: "POST",
    body: JSON.stringify({
      customerShopName: "Wrong shop name",
      lines: [{ product: product.id, qty: 8, sp: 280 }],
    }),
  });
  assert.equal(sale.status, 201);
  const removed = await api(`/api/sales/${sale.body.id}`, { method: "DELETE" });
  assert.equal(removed.status, 200);

  const products = await api("/api/products");
  assert.equal(products.body[0].stockQty, 22);
  assert.equal(products.body[0].sp, 280);
  const sales = await api("/api/sales");
  assert.equal(sales.body.length, 0);
});

test("delete purchase reduces stock when the quantity is still on hand", async () => {
  const product = await makeProduct({ stockQty: 10, cp: 242 });
  const purchase = await api("/api/purchases", {
    method: "POST",
    body: JSON.stringify({
      supplierName: "Wrong bill",
      lines: [{ product: product.id, qty: 20, cp: 255 }],
    }),
  });
  assert.equal(purchase.status, 201);
  const removed = await api(`/api/purchases/${purchase.body.id}`, { method: "DELETE" });
  assert.equal(removed.status, 200);

  const products = await api("/api/products");
  assert.equal(products.body[0].stockQty, 10);
  assert.equal(products.body[0].cp, 255);
  const purchases = await api("/api/purchases");
  assert.equal(purchases.body.length, 0);
});

test("delete purchase is refused when stock has already been sold", async () => {
  const product = await makeProduct({ stockQty: 0, cp: 100, sp: 150 });
  const purchase = await api("/api/purchases", {
    method: "POST",
    body: JSON.stringify({
      supplierName: "Depot",
      lines: [{ product: product.id, qty: 20, cp: 110 }],
    }),
  });
  assert.equal(purchase.status, 201);
  const sale = await api("/api/sales", {
    method: "POST",
    body: JSON.stringify({
      customerShopName: "Village shop",
      lines: [{ product: product.id, qty: 15, sp: 160 }],
    }),
  });
  assert.equal(sale.status, 201);

  const removed = await api(`/api/purchases/${purchase.body.id}`, { method: "DELETE" });
  assert.equal(removed.status, 409);
  assert.match(removed.body.error, /cannot be deleted/);

  const products = await api("/api/products");
  assert.equal(products.body[0].stockQty, 5);
  const purchases = await api("/api/purchases");
  assert.equal(purchases.body.length, 1);
});

test("dashboard reports stock value, today totals, margin, and low stock", async () => {
  const product = await makeProduct({
    stockQty: 0,
    cp: 100,
    sp: 140,
    reorderLevel: 10,
  });
  const purchase = await api("/api/purchases", {
    method: "POST",
    body: JSON.stringify({
      supplierName: "Today's lorry",
      date: todayKey(),
      lines: [{ product: product.id, qty: 10, cp: 100 }],
    }),
  });
  assert.equal(purchase.status, 201);
  const oldPurchase = await api("/api/purchases", {
    method: "POST",
    body: JSON.stringify({
      supplierName: "Last month",
      date: "2026-09-01",
      lines: [{ product: product.id, qty: 1, cp: 90 }],
    }),
  });
  assert.equal(oldPurchase.status, 201);
  const sale = await api("/api/sales", {
    method: "POST",
    body: JSON.stringify({
      customerShopName: "Mehta Seeds & Fertiliser",
      date: todayKey(),
      lines: [{ product: product.id, qty: 4, sp: 150 }],
    }),
  });
  assert.equal(sale.status, 201);

  const dashboard = await api("/api/dashboard");
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.stockValueAtCp, 630);
  assert.equal(dashboard.body.stockValueAtSp, 1050);
  assert.equal(dashboard.body.todayPurchaseTotal, 1000);
  assert.equal(dashboard.body.todaySalesTotal, 600);
  assert.equal(dashboard.body.grossMargin, 240);
  assert.equal(dashboard.body.lowStock.length, 1);
  assert.equal(dashboard.body.lowStock[0].name, "Urea 46% N (Neem Coated)");
});

test("seed loads five fertiliser categories and three products each, once", async () => {
  const first = await seedIfEmpty();
  assert.equal(first.seeded, true);
  const second = await seedIfEmpty();
  assert.equal(second.seeded, false);

  const categories = await api("/api/categories");
  assert.deepEqual(
    categories.body.map((row) => row.name).sort(),
    SEED_CATEGORIES.map((row) => row.name).sort(),
  );
  const products = await api("/api/products");
  assert.equal(products.body.length, 15);
  const low = products.body.filter((row) => row.lowStock);
  assert.ok(low.some((row) => row.name.includes("Imidacloprid")));
  assert.ok(low.some((row) => row.name.includes("Potassium Nitrate")));
  assert.ok(products.body.every((row) => ["in_stock", "low", "out_of_stock"].includes(row.stockStatus)));
});

test("signup and login issue a token that unlocks /api/auth/me", async () => {
  const signup = await api("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      name: "Test Counter",
      email: "test.counter@shop.example",
      password: "shopstore123",
    }),
  });
  assert.equal(signup.status, 201);
  assert.equal(signup.body.user.email, "test.counter@shop.example");
  assert.ok(signup.body.token);

  const me = await api("/api/auth/me", {
    headers: { Authorization: `Bearer ${signup.body.token}` },
  });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.name, "Test Counter");

  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "test.counter@shop.example",
      password: "shopstore123",
    }),
  });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);

  const bad = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "test.counter@shop.example",
      password: "wrong-password",
    }),
  });
  assert.equal(bad.status, 401);
});
