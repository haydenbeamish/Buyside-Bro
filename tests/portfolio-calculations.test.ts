import { describe, it, expect } from "vitest";

interface Holding {
  shares: number;
  avgCost: number;
  currentPrice: number;
  dayPnL: number;
  value: number;
}

// Mirrors the portfolio stats computation from client/src/pages/portfolio.tsx
function computePortfolioStats(holdings: Holding[]) {
  let totalValue = 0;
  let totalCost = 0;
  let dayChange = 0;
  for (const h of holdings) {
    totalValue += h.value || 0;
    totalCost += h.shares * h.avgCost;
    dayChange += h.dayPnL || 0;
  }
  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const dayChangePercent =
    totalValue > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0;
  return { totalValue, totalGain, totalGainPercent, dayChange, dayChangePercent };
}

describe("Portfolio Stats Computation", () => {
  it("computes total value from holdings", () => {
    const holdings: Holding[] = [
      { shares: 10, avgCost: 100, currentPrice: 110, dayPnL: 20, value: 1100 },
      { shares: 5, avgCost: 200, currentPrice: 210, dayPnL: -10, value: 1050 },
    ];
    const stats = computePortfolioStats(holdings);
    expect(stats.totalValue).toBe(2150);
  });

  it("computes total gain correctly", () => {
    const holdings: Holding[] = [
      { shares: 10, avgCost: 100, currentPrice: 120, dayPnL: 0, value: 1200 },
    ];
    const stats = computePortfolioStats(holdings);
    // Total cost = 10 * 100 = 1000, total value = 1200, gain = 200
    expect(stats.totalGain).toBe(200);
    expect(stats.totalGainPercent).toBe(20);
  });

  it("computes negative gain (loss)", () => {
    const holdings: Holding[] = [
      { shares: 10, avgCost: 100, currentPrice: 80, dayPnL: -50, value: 800 },
    ];
    const stats = computePortfolioStats(holdings);
    expect(stats.totalGain).toBe(-200);
    expect(stats.totalGainPercent).toBe(-20);
  });

  it("computes day change from individual dayPnL values", () => {
    const holdings: Holding[] = [
      { shares: 10, avgCost: 100, currentPrice: 102, dayPnL: 20, value: 1020 },
      { shares: 5, avgCost: 200, currentPrice: 198, dayPnL: -10, value: 990 },
    ];
    const stats = computePortfolioStats(holdings);
    expect(stats.dayChange).toBe(10);
  });

  it("returns zeros for empty portfolio", () => {
    const stats = computePortfolioStats([]);
    expect(stats.totalValue).toBe(0);
    expect(stats.totalGain).toBe(0);
    expect(stats.totalGainPercent).toBe(0);
    expect(stats.dayChange).toBe(0);
    expect(stats.dayChangePercent).toBe(0);
  });

  it("handles single holding with zero cost", () => {
    const holdings: Holding[] = [
      { shares: 10, avgCost: 0, currentPrice: 50, dayPnL: 5, value: 500 },
    ];
    const stats = computePortfolioStats(holdings);
    expect(stats.totalValue).toBe(500);
    expect(stats.totalGainPercent).toBe(0); // 0 cost → 0% gain (div by zero guard)
  });

  it("computes day change percent relative to previous value", () => {
    const holdings: Holding[] = [
      { shares: 100, avgCost: 10, currentPrice: 11, dayPnL: 100, value: 1100 },
    ];
    const stats = computePortfolioStats(holdings);
    // dayChangePercent = 100 / (1100 - 100) * 100 = 10%
    expect(stats.dayChangePercent).toBeCloseTo(10, 1);
  });
});
