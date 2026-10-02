import { round2 } from "./dates.js";
import { lineGst, splitGst } from "./gst.js";

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
  const gst = splitGst(doc.gstRate ?? 18);

  return {
    id: String(doc._id),
    name: doc.name,
    categoryId: String(category ? category._id : doc.category),
    categoryName: category ? category.name : "",
    hsnCode: doc.hsnCode,
    gstRate: gst.gstRate,
    cgstRate: gst.cgstRate,
    sgstRate: gst.sgstRate,
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
    hsnCode: product ? product.hsnCode : "",
  };
}

function ewayBits(doc) {
  return {
    ewayBillNo: doc.ewayBillNo || "",
    vehicleNo: doc.vehicleNo || "",
    transporterName: doc.transporterName || "",
  };
}

export function presentPurchase(doc) {
  const lines = doc.lines.map((line) => {
    const bits = productBits(line.product);
    const gstRate = line.gstRate ?? 0;
    const computed =
      line.taxable != null
        ? {
            taxable: line.taxable,
            cgst: line.cgst,
            sgst: line.sgst,
            lineTotal: round2(
              (line.taxable || 0) + (line.cgst || 0) + (line.sgst || 0),
            ),
            ...splitGst(gstRate),
          }
        : lineGst(line.qty, line.cp, gstRate);
    return {
      ...bits,
      hsnCode: line.hsnCode || bits.hsnCode,
      qty: line.qty,
      cp: line.cp,
      gstRate: computed.gstRate,
      cgstRate: computed.cgstRate,
      sgstRate: computed.sgstRate,
      taxable: computed.taxable,
      cgst: computed.cgst,
      sgst: computed.sgst,
      lineTotal: computed.lineTotal,
    };
  });
  const taxableTotal = round2(lines.reduce((sum, line) => sum + line.taxable, 0));
  const cgstTotal = round2(lines.reduce((sum, line) => sum + line.cgst, 0));
  const sgstTotal = round2(lines.reduce((sum, line) => sum + line.sgst, 0));
  return {
    id: String(doc._id),
    supplierName: doc.supplierName,
    date: doc.date.toISOString(),
    ...ewayBits(doc),
    lines,
    taxableTotal,
    cgstTotal,
    sgstTotal,
    total: round2(taxableTotal + cgstTotal + sgstTotal),
  };
}

export function presentSale(doc) {
  const lines = doc.lines.map((line) => {
    const bits = productBits(line.product);
    const gstRate = line.gstRate ?? 0;
    const computed =
      line.taxable != null
        ? {
            taxable: line.taxable,
            cgst: line.cgst,
            sgst: line.sgst,
            lineTotal: round2(
              (line.taxable || 0) + (line.cgst || 0) + (line.sgst || 0),
            ),
            ...splitGst(gstRate),
          }
        : lineGst(line.qty, line.sp, gstRate);
    const margin = round2(line.qty * (line.sp - line.cpAtSale));
    return {
      ...bits,
      hsnCode: line.hsnCode || bits.hsnCode,
      qty: line.qty,
      sp: line.sp,
      cpAtSale: line.cpAtSale,
      gstRate: computed.gstRate,
      cgstRate: computed.cgstRate,
      sgstRate: computed.sgstRate,
      taxable: computed.taxable,
      cgst: computed.cgst,
      sgst: computed.sgst,
      lineTotal: computed.lineTotal,
      margin,
    };
  });
  const taxableTotal = round2(lines.reduce((sum, line) => sum + line.taxable, 0));
  const cgstTotal = round2(lines.reduce((sum, line) => sum + line.cgst, 0));
  const sgstTotal = round2(lines.reduce((sum, line) => sum + line.sgst, 0));
  return {
    id: String(doc._id),
    customerShopName: doc.customerShopName,
    date: doc.date.toISOString(),
    ...ewayBits(doc),
    lines,
    taxableTotal,
    cgstTotal,
    sgstTotal,
    total: round2(taxableTotal + cgstTotal + sgstTotal),
    margin: round2(lines.reduce((sum, line) => sum + line.margin, 0)),
  };
}
