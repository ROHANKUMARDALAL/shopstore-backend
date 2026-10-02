import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
  },
  { timestamps: true },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    unit: { type: String, required: true, trim: true },
    cp: { type: Number, required: true, min: 0 },
    sp: { type: Number, required: true, min: 0 },
    stockQty: { type: Number, required: true, default: 0, min: 0 },
    reorderLevel: { type: Number, required: true, default: 10, min: 0 },
  },
  { timestamps: true },
);

productSchema.index({ name: 1, category: 1 }, { unique: true });

const purchaseLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    qty: { type: Number, required: true, min: 0 },
    cp: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const purchaseSchema = new mongoose.Schema(
  {
    supplierName: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    lines: {
      type: [purchaseLineSchema],
      validate: {
        validator: (lines) => Array.isArray(lines) && lines.length > 0,
        message: "Add at least one line.",
      },
    },
  },
  { timestamps: true },
);

const saleLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    qty: { type: Number, required: true, min: 0 },
    sp: { type: Number, required: true, min: 0 },
    cpAtSale: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const saleSchema = new mongoose.Schema(
  {
    customerShopName: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    lines: {
      type: [saleLineSchema],
      validate: {
        validator: (lines) => Array.isArray(lines) && lines.length > 0,
        message: "Add at least one line.",
      },
    },
  },
  { timestamps: true },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    passwordHash: { type: String, required: true },
    resetCodeHash: { type: String, default: null },
    resetCodeExpires: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Category =
  mongoose.models.Category || mongoose.model("Category", categorySchema);
export const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);
export const Purchase =
  mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);
export const Sale = mongoose.models.Sale || mongoose.model("Sale", saleSchema);
export const User = mongoose.models.User || mongoose.model("User", userSchema);
