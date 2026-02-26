/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber } from "ethers";

// Recursively convert BigNumber/BigInt → string
export function serializeBigNumbers(obj: any): any {
  if (obj == null) return obj;

  if (BigNumber.isBigNumber(obj)) {
    return obj.toString(); // ✅ string only
  }
  if (typeof obj === "bigint") {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigNumbers);
  }
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, serializeBigNumbers(v)])
    );
  }
  return obj;
}
