import { Category, Product, Purchase, Sale } from "./models.js";
import { StockError } from "./errors.js";
import { parseShopDate, round2, roundQty, todayRange } from "./dates.js";
import { GST_RATE_OPTIONS, lineGst } from "./gst.js";
import { presentProduct } from "./present.js";

function requireText(value, label) {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!text) throw new StockError(`${label} is required.`);
  return text;
}

function requireNumber(value, label) {
  if (typeof value === "string" && value.trim() === "") {
    throw new StockError(`${label} must be a number.`);
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new StockError(`${label} must be a number.`);
  return n;
}

function requireQty(value) {
  const qty = roundQty(requireNumber(value, "Quantity"));
  if (qty <= 0) throw new StockError("Quantity must be greater than zero.");
  return qty;
}

function requirePrice(value, label) {
  const price = round2(requireNumber(value, label));
  if (price < 0) throw new StockError(`${label} cannot be negative.`);
  return price;
}

function normalizeLines(lines, rateField) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new StockError("Add at least one line.");
  }
  const rateLabel = rateField === "cp" ? "Cost price" : "Selling price";
  return lines.map((line, index) => {
    const where = `Line ${index + 1}`;
    if (!line || typeof line !== "object") {
      throw new StockError(`${where} is incomplete.`);
    }
    const product = String(line.product ?? "").trim();
    if (!product) throw new StockError(`${where} needs a product.`);
    return {
      product,
      qty: requireQty(line.qty),
      rate: requirePrice(line[rateField], `${where} ${rateLabel.toLowerCase()}`),
    };
  });
}

async function loadProducts(ids) {
  const unique = [...new Set(ids)];
  const products = await Product.find({ _id: { $in: unique } });
  const byId = new Map(products.map((product) => [String(product._id), product]));
  for (const id of unique) {
    if (!byId.has(id)) {
      throw new StockError("One of the lines has a product that is not on the book.", 404);
    }
  }
  return byId;
}

function groupQty(lines) {
  const demand = new Map();
  for (const line of lines) {
    demand.set(line.product, roundQty((demand.get(line.product) || 0) + line.qty));
  }
  return demand;
}

export async function createCategory({ name }) {
  const clean = requireText(name, "Category name");
  const existing = await Category.findOne({ name: clean });
  if (existing) throw new StockError("That category is already on the book.", 409);
  return Category.create({ name: clean });
}

export async function listCategories() {
  return Category.find().sort({ name: 1 });
}

function requireHsn(value) {
  const hsnCode = requireText(value, "HSN code").replace(/\s+/g, "");
  if (!/^\d{4,8}$/.test(hsnCode)) {
    throw new StockError("HSN code must be 4 to 8 digits.");
  }
  return hsnCode;
}

function requireGstRate(value) {
  const gstRate = requireNumber(value ?? 18, "GST rate");
  if (!GST_RATE_OPTIONS.includes(gstRate)) {
    throw new StockError(`GST rate must be one of ${GST_RATE_OPTIONS.join(", ")}.`);
  }
  return gstRate;
}

function ewayFields(body) {
  return {
    ewayBillNo: String(body.ewayBillNo ?? "").trim(),
    vehicleNo: String(body.vehicleNo ?? "").trim(),
    transporterName: String(body.transporterName ?? "").trim(),
  };
}

export async function createProduct(body) {
  const name = requireText(body.name, "Product name");
  const unit = requireText(body.unit, "Unit");
  const hsnCode = requireHsn(body.hsnCode);
  const gstRate = requireGstRate(body.gstRate);
  const categoryId = String(body.category ?? "").trim();
  if (!categoryId) throw new StockError("Category is required.");
  const category = await Category.findById(categoryId);
  if (!category) throw new StockError("Category not found.", 404);
  const cp = requirePrice(body.cp, "Cost price");
  const sp = requirePrice(body.sp, "Selling price");
  const stockQty =
    body.stockQty == null || body.stockQty === ""
      ? 0
      : roundQty(requireNumber(body.stockQty, "Opening stock"));
  if (stockQty < 0) throw new StockError("Opening stock cannot be negative.");
  const reorderLevel =
    body.reorderLevel == null || body.reorderLevel === ""
      ? 10
      : roundQty(requireNumber(body.reorderLevel, "Reorder level"));
  if (reorderLevel < 0) throw new StockError("Reorder level cannot be negative.");
  const duplicate = await Product.findOne({ name, category: category._id });
  if (duplicate) {
    throw new StockError("This product is already in that category.", 409);
  }
  const hsnTaken = await Product.findOne({ hsnCode });
  if (hsnTaken) {
    throw new StockError("That HSN code is already on another product.", 409);
  }
  const product = await Product.create({
    name,
    category: category._id,
    hsnCode,
    gstRate,
    unit,
    cp,
    sp,
    stockQty,
    reorderLevel,
  });
  return Product.findById(product._id).populate("category");
}

export async function listProducts() {
  return Product.find().populate("category").sort({ name: 1 });
}

export async function createPurchase(body) {
  const supplierName = requireText(body.supplierName, "Supplier name");
  const date = parseShopDate(body.date);
  const lines = normalizeLines(body.lines, "cp");
  const products = await loadProducts(lines.map((line) => line.product));
  const eway = ewayFields(body);

  const applied = [];
  try {
    for (const line of lines) {
      const before = await Product.findById(line.product);
      const updated = await Product.findByIdAndUpdate(
        line.product,
        { $inc: { stockQty: line.qty }, $set: { cp: line.rate } },
        { new: true },
      );
      if (!updated) {
        throw new StockError("One of the lines has a product that is not on the book.", 404);
      }
      applied.push({
        id: line.product,
        qty: line.qty,
        cp: before.cp,
      });
    }
    return Purchase.create({
      supplierName,
      date,
      ...eway,
      lines: lines.map((line) => {
        const product = products.get(line.product);
        const gst = lineGst(line.qty, line.rate, product.gstRate);
        return {
          product: line.product,
          qty: line.qty,
          cp: line.rate,
          hsnCode: product.hsnCode,
          gstRate: gst.gstRate,
          taxable: gst.taxable,
          cgst: gst.cgst,
          sgst: gst.sgst,
        };
      }),
    });
  } catch (error) {
    for (const row of applied.reverse()) {
      await Product.findByIdAndUpdate(row.id, {
        $inc: { stockQty: -row.qty },
        $set: { cp: row.cp },
      });
    }
    throw error;
  }
}

export async function listPurchases() {
  return Purchase.find()
    .populate("lines.product")
    .sort({ date: -1, createdAt: -1 });
}

export async function deletePurchase(id) {
  const purchase = await Purchase.findById(id);
  if (!purchase) throw new StockError("Purchase not found.", 404);
  const lines = purchase.lines.map((line) => ({
    product: String(line.product),
    qty: line.qty,
  }));
  const products = await loadProducts(lines.map((line) => line.product));
  const demand = groupQty(lines);
  for (const [productId, qty] of demand) {
    const product = products.get(productId);
    if (product.stockQty < qty) {
      throw new StockError(
        `This purchase cannot be deleted. ${product.name} has ${product.stockQty} ${product.unit} left, but the voucher put ${qty} ${product.unit} in. Those bags have already moved.`,
        409,
      );
    }
  }

  const applied = [];
  try {
    for (const [productId, qty] of demand) {
      const updated = await Product.findOneAndUpdate(
        { _id: productId, stockQty: { $gte: qty } },
        { $inc: { stockQty: -qty } },
        { new: true },
      );
      if (!updated) {
        const current = await Product.findById(productId);
        throw new StockError(
          `This purchase cannot be deleted. ${current?.name || "A product"} no longer has enough stock to reverse the voucher.`,
          409,
        );
      }
      applied.push({ id: productId, qty });
    }
    await Purchase.findByIdAndDelete(id);
  } catch (error) {
    for (const row of applied.reverse()) {
      await Product.findByIdAndUpdate(row.id, { $inc: { stockQty: row.qty } });
    }
    throw error;
  }
}

export async function createSale(body) {
  const customerShopName = requireText(body.customerShopName, "Customer shop name");
  const date = parseShopDate(body.date);
  const lines = normalizeLines(body.lines, "sp");
  const products = await loadProducts(lines.map((line) => line.product));
  const eway = ewayFields(body);
  const demand = groupQty(lines);
  for (const [productId, qty] of demand) {
    const product = products.get(productId);
    if (roundQty(product.stockQty) < qty) {
      throw new StockError(
        `Only ${product.stockQty} ${product.unit} of ${product.name} are in stock. This sale asks for ${qty}.`,
        409,
      );
    }
  }
  const cpAtSale = new Map(
    [...products.entries()].map(([id, product]) => [id, product.cp]),
  );

  const applied = [];
  try {
    for (const line of lines) {
      const before = await Product.findById(line.product);
      if (!before) {
        throw new StockError("One of the lines has a product that is not on the book.", 404);
      }
      const updated = await Product.findOneAndUpdate(
        { _id: line.product, stockQty: { $gte: line.qty } },
        { $inc: { stockQty: -line.qty }, $set: { sp: line.rate } },
        { new: true },
      );
      if (!updated) {
        const current = await Product.findById(line.product);
        throw new StockError(
          `Only ${current?.stockQty ?? 0} ${before.unit} of ${before.name} are in stock. This sale asks for ${line.qty}.`,
          409,
        );
      }
      applied.push({ id: line.product, qty: line.qty, sp: before.sp });
    }
    return Sale.create({
      customerShopName,
      date,
      ...eway,
      lines: lines.map((line) => {
        const product = products.get(line.product);
        const gst = lineGst(line.qty, line.rate, product.gstRate);
        return {
          product: line.product,
          qty: line.qty,
          sp: line.rate,
          cpAtSale: cpAtSale.get(line.product),
          hsnCode: product.hsnCode,
          gstRate: gst.gstRate,
          taxable: gst.taxable,
          cgst: gst.cgst,
          sgst: gst.sgst,
        };
      }),
    });
  } catch (error) {
    for (const row of applied.reverse()) {
      await Product.findByIdAndUpdate(row.id, {
        $inc: { stockQty: row.qty },
        $set: { sp: row.sp },
      });
    }
    throw error;
  }
}

export async function listSales() {
  return Sale.find()
    .populate("lines.product")
    .sort({ date: -1, createdAt: -1 });
}

export async function deleteSale(id) {
  const sale = await Sale.findById(id);
  if (!sale) throw new StockError("Sale not found.", 404);
  const lines = sale.lines.map((line) => ({
    product: String(line.product),
    qty: line.qty,
  }));
  await loadProducts(lines.map((line) => line.product));
  const demand = groupQty(lines);
  const applied = [];
  try {
    for (const [productId, qty] of demand) {
      const updated = await Product.findByIdAndUpdate(
        productId,
        { $inc: { stockQty: qty } },
        { new: true },
      );
      if (!updated) {
        throw new StockError("One of the lines has a product that is not on the book.", 404);
      }
      applied.push({ id: productId, qty });
    }
    await Sale.findByIdAndDelete(id);
  } catch (error) {
    for (const row of applied.reverse()) {
      await Product.findByIdAndUpdate(row.id, { $inc: { stockQty: -row.qty } });
    }
    throw error;
  }
}

export async function getDashboard() {
  const products = await Product.find().populate("category").sort({ name: 1 });
  let stockValueAtCp = 0;
  let stockValueAtSp = 0;
  for (const product of products) {
    stockValueAtCp += product.stockQty * product.cp;
    stockValueAtSp += product.stockQty * product.sp;
  }
  const { start, end } = todayRange();
  const [purchases, sales] = await Promise.all([
    Purchase.find({ date: { $gte: start, $lt: end } }),
    Sale.find({ date: { $gte: start, $lt: end } }),
  ]);
  let todayPurchaseTotal = 0;
  for (const voucher of purchases) {
    for (const line of voucher.lines) todayPurchaseTotal += line.qty * line.cp;
  }
  let todaySalesTotal = 0;
  let grossMargin = 0;
  for (const voucher of sales) {
    for (const line of voucher.lines) {
      todaySalesTotal += line.qty * line.sp;
      grossMargin += line.qty * (line.sp - line.cpAtSale);
    }
  }
  const lowStock = products
    .filter((product) => product.stockQty <= product.reorderLevel)
    .map(presentProduct);
  return {
    stockValueAtCp: round2(stockValueAtCp),
    stockValueAtSp: round2(stockValueAtSp),
    todayPurchaseTotal: round2(todayPurchaseTotal),
    todaySalesTotal: round2(todaySalesTotal),
    grossMargin: round2(grossMargin),
    lowStock,
  };
}
