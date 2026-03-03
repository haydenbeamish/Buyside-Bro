import { describe, it, expect } from "vitest";

/**
 * Unit tests for the NaN guard patterns used in trading route calculations.
 * These test the core parseFloat + isNaN guard logic extracted from
 * server/routes/trading.ts to verify financial calculations never silently
 * produce NaN values.
 */

function computeTradePnL(
  priceStr: string,
  sharesStr: string,
  currentPrice: number,
  action: "buy" | "sell",
): { pnl: number | null; returnPct: number | null } {
  const entryPrice = parseFloat(priceStr);
  const shares = parseFloat(sharesStr);

  if (isNaN(entryPrice) || isNaN(shares)) {
    return { pnl: null, returnPct: null };
  }

  let pnl: number;
  if (action === "buy") {
    pnl = (currentPrice - entryPrice) * shares;
  } else {
    pnl = (entryPrice - currentPrice) * shares;
  }

  const returnPct =
    entryPrice > 0
      ? (((action === "buy" ? currentPrice - entryPrice : entryPrice - currentPrice) / entryPrice) * 100)
      : 0;

  return { pnl, returnPct };
}

function computeTotalValue(sharesStr: string, priceStr: string): number | null {
  const shares = parseFloat(sharesStr);
  const price = parseFloat(priceStr);
  if (isNaN(shares) || isNaN(price)) return null;
  return shares * price;
}

function computeNewAvgCost(
  existingSharesStr: string,
  existingCostStr: string,
  newShares: number,
  newPrice: number,
): { newTotalShares: number; newAvgCost: number } | null {
  const existingShares = parseFloat(existingSharesStr);
  const existingCost = parseFloat(existingCostStr);
  if (isNaN(existingShares) || isNaN(existingCost)) return null;

  const newTotalShares = existingShares + newShares;
  const newAvgCost = ((existingShares * existingCost) + (newShares * newPrice)) / newTotalShares;
  return { newTotalShares, newAvgCost };
}

describe("Trade P&L Calculation Guards", () => {
  it("computes correct P&L for valid buy trade", () => {
    const result = computeTradePnL("100.00", "10", 110, "buy");
    expect(result.pnl).toBe(100);
    expect(result.returnPct).toBe(10);
  });

  it("computes correct P&L for valid sell trade", () => {
    const result = computeTradePnL("100.00", "10", 90, "sell");
    expect(result.pnl).toBe(100);
    expect(result.returnPct).toBe(10);
  });

  it("returns null for NaN price", () => {
    const result = computeTradePnL("invalid", "10", 100, "buy");
    expect(result.pnl).toBeNull();
    expect(result.returnPct).toBeNull();
  });

  it("returns null for NaN shares", () => {
    const result = computeTradePnL("100.00", "abc", 100, "buy");
    expect(result.pnl).toBeNull();
    expect(result.returnPct).toBeNull();
  });

  it("returns null for empty strings", () => {
    const result = computeTradePnL("", "", 100, "buy");
    expect(result.pnl).toBeNull();
    expect(result.returnPct).toBeNull();
  });

  it("handles zero entry price without division error", () => {
    const result = computeTradePnL("0", "10", 50, "buy");
    expect(result.pnl).toBe(500);
    expect(result.returnPct).toBe(0); // Division by zero guarded
  });
});

describe("Total Value Calculation Guards", () => {
  it("computes correct total value", () => {
    expect(computeTotalValue("10", "25.50")).toBe(255);
  });

  it("returns null for NaN shares", () => {
    expect(computeTotalValue("invalid", "25.50")).toBeNull();
  });

  it("returns null for NaN price", () => {
    expect(computeTotalValue("10", "bad")).toBeNull();
  });
});

describe("Average Cost Calculation Guards", () => {
  it("computes correct new average cost", () => {
    const result = computeNewAvgCost("100", "50.00", 100, 60.00);
    expect(result).not.toBeNull();
    expect(result!.newTotalShares).toBe(200);
    expect(result!.newAvgCost).toBe(55);
  });

  it("returns null for NaN existing shares", () => {
    expect(computeNewAvgCost("invalid", "50.00", 100, 60.00)).toBeNull();
  });

  it("returns null for NaN existing cost", () => {
    expect(computeNewAvgCost("100", "bad", 100, 60.00)).toBeNull();
  });
});
