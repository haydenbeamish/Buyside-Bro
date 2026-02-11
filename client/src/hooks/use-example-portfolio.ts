import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

interface WatchlistDefaultItem {
  ticker: string;
  name: string | null;
  price: number | null;
  dayChangePercent: number;
  marketCap: number | null;
  pe: number | null;
}

interface EnrichedHolding {
  id: number;
  userId: string;
  ticker: string;
  shares: string;
  avgCost: string;
  currentPrice: string | null;
  sector: string | null;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  dayChangePercent: number;
  value: number;
  dayPnL: number;
  totalPnL: number;
  pnlPercent: number;
  marketCap: number | null;
  pe: number | null;
  epsGrowth: number | null;
  nextEarnings: string | null;
}

interface PortfolioStats {
  totalValue: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

const STORAGE_KEY = "portfolio_example_dismissed";

// Indices that simulate a loss (price went up since purchase → cost basis > current would be wrong,
// so we flip: cost basis > current price for these indices)
const LOSS_INDICES = new Set([4, 6, 8]);

function getShares(price: number): number {
  if (price > 500) return 5;
  if (price >= 100) return 20;
  if (price >= 20) return 50;
  return 200;
}

function getCostBasis(price: number, index: number): number {
  return LOSS_INDICES.has(index) ? price * 1.04 : price * 0.92;
}

export function useExamplePortfolio(realHoldings: EnrichedHolding[] | undefined, onAddPosition?: () => void) {
  const [exampleDismissed, setExampleDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "1"
  );

  const shouldShowExample =
    !exampleDismissed &&
    realHoldings !== undefined &&
    realHoldings.length === 0;

  const { data: defaultWatchlist } = useQuery<WatchlistDefaultItem[]>({
    queryKey: ["/api/watchlist/default"],
    enabled: shouldShowExample,
  });

  const exampleHoldings = useMemo<EnrichedHolding[] | null>(() => {
    if (!shouldShowExample || !defaultWatchlist) return null;

    const validItems = defaultWatchlist.filter((item) => item.price && item.price > 0);
    const items = validItems.slice(0, 10);

    if (items.length === 0) return null;

    return items.map((item, index) => {
      const price = item.price!;
      const shares = getShares(price);
      const avgCost = getCostBasis(price, index);
      const value = shares * price;
      const totalCost = shares * avgCost;
      const totalPnL = value - totalCost;
      const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
      const dayPnL = value * (item.dayChangePercent / 100);

      return {
        id: -(index + 1), // negative IDs to distinguish from real holdings
        userId: "example",
        ticker: item.ticker,
        shares: String(shares),
        avgCost: avgCost.toFixed(4),
        currentPrice: price.toFixed(4),
        sector: null,
        name: item.name,
        createdAt: new Date(),
        updatedAt: new Date(),
        dayChangePercent: item.dayChangePercent,
        value,
        dayPnL,
        totalPnL,
        pnlPercent,
        marketCap: item.marketCap,
        pe: item.pe,
        epsGrowth: null,
        nextEarnings: null,
      };
    });
  }, [shouldShowExample, defaultWatchlist]);

  const displayHoldings = useMemo(() => {
    if (exampleHoldings && shouldShowExample) return exampleHoldings;
    return realHoldings;
  }, [exampleHoldings, shouldShowExample, realHoldings]);

  const displayStats = useMemo<PortfolioStats | undefined>(() => {
    if (!displayHoldings || displayHoldings.length === 0) return undefined;

    let totalValue = 0;
    let totalCost = 0;
    let dayChange = 0;
    for (const h of displayHoldings) {
      totalValue += h.value || 0;
      totalCost += Number(h.shares) * Number(h.avgCost);
      dayChange += h.dayPnL || 0;
    }
    const totalGain = totalValue - totalCost;
    const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
    const dayChangePercent = totalValue > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0;
    return { totalValue, totalGain, totalGainPercent, dayChange, dayChangePercent };
  }, [displayHoldings]);

  const isExample = shouldShowExample && exampleHoldings !== null && exampleHoldings.length > 0;

  const dismissExample = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setExampleDismissed(true);
  }, []);

  const clearAndAdd = useCallback(() => {
    dismissExample();
    onAddPosition?.();
  }, [dismissExample, onAddPosition]);

  return {
    displayHoldings,
    displayStats,
    isExample,
    dismissExample,
    clearAndAdd,
  };
}
