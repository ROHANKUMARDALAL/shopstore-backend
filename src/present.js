import { round2 } from "./dates.js";

export function presentCategory(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
  };
}

export function presentProduct(doc) {
  const category =
    doc.category && typeof doc.category === "object" ? doc.category : null;
  const marginPerUnit = round2(doc.sp - doc.cp);
  const marginPercent =
    doc.cp > 0 ? round2((marginPerUnit / doc.cp) * 100) : null;
  const stockQty = doc.stockQty;
  const lowStock = stockQty <= doc.reorderLevel;
  let stockStatus = "in_stock";
  if (stockQty <= 0) stockStatus = "out_of_stock";
  else if (lowStock) stockStatus = "low";

  return {
    id: String(doc._id),
    name: doc.name,
    categoryId: String(category ? category._id : doc.category),
    categoryName: category ? category.name : "",
    unit: doc.unit,
    cp: doc.cp,
    sp: doc.sp,
    stockQty,
    reorderLevel: doc.reorderLevel,
    marginPerUnit,
    marginPercent,
    lowStock,
    stockStatus,
  };
}

function productBits(ref) {
  const product = ref && typeof ref === "object" ? ref : null;
  return {
    productId: String(product ? product._id : ref),
    productName: product ? product.name : "Removed product",
    unit: product ? product.unit : "",
  };
}

export function presentPurchase(doc) {
  const lines = doc.lines.map((line) => {
    const bits = productBits(line.product);
    return {
      ...bits,
      qty: line.qty,
      cp: line.cp,
      lineTotal: round2(line.qty * line.cp),
    };
  });
  return {
    id: String(doc._id),
    supplierName: doc.supplierName,
    date: doc.date.toISOString(),
    lines,
    total: round2(lines.reduce((sum, line) => sum + line.lineTotal, 0)),
  };
}

export function presentSale(doc) {
  const lines = doc.lines.map((line) => {
    const bits = productBits(line.product);
    const lineTotal = round2(line.qty * line.sp);
    const margin = round2(line.qty * (line.sp - line.cpAtSale));
    return {
      ...bits,
      qty: line.qty,
      sp: line.sp,
      cpAtSale: line.cpAtSale,
      lineTotal,
      margin,
    };
  });
  return {
    id: String(doc._id),
    customerShopName: doc.customerShopName,
    date: doc.date.toISOString(),
    lines,
    total: round2(lines.reduce((sum, line) => sum + line.lineTotal, 0)),
    margin: round2(lines.reduce((sum, line) => sum + line.margin, 0)),
  };
}
