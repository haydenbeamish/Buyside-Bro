import { describe, it, expect } from "vitest";

// Test the shared utility functions from server/routes/shared.ts
// Import the pure functions directly

import { isValidTicker, normalizeTicker } from "../server/routes/shared";

describe("isValidTicker", () => {
  it("accepts simple US tickers", () => {
    expect(isValidTicker("AAPL")).toBe(true);
    expect(isValidTicker("MSFT")).toBe(true);
    expect(isValidTicker("GOOGL")).toBe(true);
    expect(isValidTicker("NVDA")).toBe(true);
  });

  it("accepts ASX tickers with dot notation", () => {
    expect(isValidTicker("CBA.AX")).toBe(true);
    expect(isValidTicker("BHP.AX")).toBe(true);
    expect(isValidTicker("WES.ASX")).toBe(true);
  });

  it("accepts tickers with hyphens", () => {
    expect(isValidTicker("BRK-B")).toBe(true);
    expect(isValidTicker("BF-A")).toBe(true);
  });

  it("accepts numeric tickers", () => {
    expect(isValidTicker("9988")).toBe(true); // Alibaba HK
  });

  it("rejects empty strings", () => {
    expect(isValidTicker("")).toBe(false);
  });

  it("rejects tickers with spaces", () => {
    expect(isValidTicker("AA PL")).toBe(false);
  });

  it("rejects tickers with special characters", () => {
    expect(isValidTicker("AAPL$")).toBe(false);
    expect(isValidTicker("AAPL!")).toBe(false);
    expect(isValidTicker("<script>")).toBe(false);
  });

  it("rejects tickers longer than 20 characters", () => {
    expect(isValidTicker("A".repeat(21))).toBe(false);
  });

  it("accepts tickers up to 20 characters", () => {
    expect(isValidTicker("A".repeat(20))).toBe(true);
  });
});

describe("normalizeTicker", () => {
  it("converts .ASX suffix to .AX", () => {
    expect(normalizeTicker("CBA.ASX")).toBe("CBA.AX");
    expect(normalizeTicker("BHP.ASX")).toBe("BHP.AX");
  });

  it("uppercases the ticker", () => {
    expect(normalizeTicker("aapl")).toBe("AAPL");
    expect(normalizeTicker("msft")).toBe("MSFT");
  });

  it("handles case-insensitive .ASX suffix", () => {
    expect(normalizeTicker("cba.asx")).toBe("CBA.AX");
    expect(normalizeTicker("bhp.Asx")).toBe("BHP.AX");
  });

  it("preserves .AX suffix", () => {
    expect(normalizeTicker("CBA.AX")).toBe("CBA.AX");
  });

  it("handles tickers without ASX suffix", () => {
    expect(normalizeTicker("AAPL")).toBe("AAPL");
    expect(normalizeTicker("TSLA")).toBe("TSLA");
  });
});
