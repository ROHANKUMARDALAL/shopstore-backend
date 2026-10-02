import { round2 } from "./dates.js";

export const GST_RATE_OPTIONS = [0, 5, 12, 18, 28];

export function splitGst(gstRate) {
  const rate = Number(gstRate) || 0;
  const half = round2(rate / 2);
  return {
    gstRate: rate,
    cgstRate: half,
    sgstRate: half,
  };
}

export function lineGst(qty, rate, gstRate) {
  const taxable = round2(qty * rate);
  const { cgstRate, sgstRate } = splitGst(gstRate);
  const cgst = round2((taxable * cgstRate) / 100);
  const sgst = round2((taxable * sgstRate) / 100);
  return {
    taxable,
    cgst,
    sgst,
    lineTotal: round2(taxable + cgst + sgst),
    cgstRate,
    sgstRate,
    gstRate: Number(gstRate) || 0,
  };
}
