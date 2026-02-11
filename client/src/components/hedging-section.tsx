import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ====== Types ======

export interface HedgingHolding {
  ticker: string;
  name?: string | null;
  shares: number | string;
  avgCost: number | string;
  currentPrice?: number | string | null;
  value: number;
  pnlPercent: number;
}

interface HedgingSectionProps {
  holdings: HedgingHolding[];
  totalValue: number;
}

interface AdaptedPosition {
  ticker: string;
  name: string;
  currency: string;
  marketValueAUD: number;
  currentPrice: number;
  costPrice: number;
  pnlPercent: number;
  portfolioWeight: number;
  quantity: number;
  isFutures: boolean;
}

interface Classification {
  type: string;
  commodity: string | null;
  hedgeIndex: string;
}

interface EquityPosition extends AdaptedPosition {
  beta: number;
  betaAdjExposure: number;
  valueUSD: number;
  classification: Classification;
}

interface GenericPosition extends AdaptedPosition {
  valueUSD: number;
  classification: Classification;
}

interface MarketItem {
  name: string;
  ticker: string;
  price: number;
}

interface MarketsFullData {
  futures?: MarketItem[];
  commodities?: MarketItem[];
  [key: string]: unknown;
}

interface CommodityHedge {
  contracts: number;
  futuresSymbol: string | null;
  exposureUSD: number;
  contractValue?: number;
  price?: number;
  hedgeable: boolean;
  hedgePct?: number;
  marginPerContract?: number;
}

// ====== Constants ======

const COMMODITY_TICKERS: Record<string, string[]> = {
  gold: ['NEM', 'GOLD', 'AEM', 'KGC', 'GFI', 'NST', 'EVN', 'NCM', 'WGX', 'GMD', 'RMS', 'SBM', 'PRU',
    'RSG', 'BGL', 'GOR', 'CMM', 'WAF', 'DEG', 'AGG', 'SAR', 'RRL', 'SLR', 'RED', 'TIE', 'PRN', 'AQG', 'SNL'],
  copper: ['FCX', 'SCCO', 'TECK', 'HBM', 'OZL', 'SFR', 'CMCL', 'EDV', 'CU', 'CS', 'IVZ', 'REZ', 'AIS',
    '29M', 'CYM', 'TTM'],
  oil: ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'OXY', 'MPC', 'VLO', 'PSX', 'HES', 'WDS', 'STO', 'BPT', 'KAR',
    'WHC', 'DVN', 'FANG', 'PXD', 'MRO', 'APA'],
  iron_ore: ['BHP', 'RIO', 'FMG', 'CIA', 'MGT', 'GRR', 'MIN', 'CZR', 'DEV', 'ACS'],
  lithium: ['ALB', 'SQM', 'PLS', 'LTR', 'IGO', 'AKE', 'CXO', 'LKE', 'SYA', 'GL1', 'FFX', 'GT1', 'LRS'],
  silver: ['AG', 'PAAS', 'HL', 'CDE', 'MAG', 'FSM', 'SVR', 'EXR'],
  uranium: ['CCJ', 'UEC', 'DNN', 'NXE', 'PDN', 'BMN', 'BOE', 'LOT', 'PEN', 'DYL', 'AGE', 'ERA'],
  natgas: ['EQT', 'AR', 'RRC', 'SWN', 'CNX', 'CHK'],
};

const SP500_HEDGE_STOCKS = [
  "BAC", "JPM", "GS", "MS", "C", "WFC", "AXP",
  "WMT", "PG", "KO", "PEP", "MCD", "NKE", "DIS", "PM",
  "JNJ", "UNH", "ABT", "PFE", "ABBV", "MRK", "TMO",
  "XOM", "CVX",
  "GE", "CAT", "BA", "MMM", "HON", "UPS", "LMT", "RTX",
  "V", "MA", "HD", "LOW", "TOL",
  "T", "VZ",
  "IBM", "ACN",
];

const NASDAQ_CORRELATED_ASX = ["XRO", "WTC", "ALA"];

const KNOWN_BETAS_NASDAQ: Record<string, number> = {
  AAPL: 1.2, MSFT: 1.15, GOOGL: 1.1, GOOG: 1.1, AMZN: 1.2, META: 1.3, NVDA: 1.7, TSLA: 1.8,
  AVGO: 1.3, NFLX: 1.25, COST: 0.75, ADBE: 1.2, CRM: 1.15, AMD: 1.6, INTC: 1.0, QCOM: 1.2,
  TXN: 0.95, CSCO: 0.85, CMCSA: 0.9, PEP: 0.6, AMGN: 0.65, TMUS: 0.55, SBUX: 0.9,
  MDLZ: 0.55, GILD: 0.65, ADP: 0.85, VRTX: 0.5, REGN: 0.45, ISRG: 1.0, LRCX: 1.5,
  KLAC: 1.4, MRVL: 1.5, SNPS: 1.2, CDNS: 1.15, ABNB: 1.5, CRWD: 1.4, PANW: 1.3,
  DDOG: 1.5, ZS: 1.4, NET: 1.5, MDB: 1.6, SNOW: 1.7, PLTR: 1.8, COIN: 2.2,
  MSTR: 2.5, MARA: 2.5, U: 1.8, SE: 1.5, TWLO: 1.5, LMND: 1.8, DOCN: 1.6, RDDT: 1.7,
  HOOD: 1.8, SOFI: 1.6, RIVN: 2.0, LCID: 2.0, ARM: 1.6, SMCI: 2.0, GRAB: 1.3, VIPS: 1.1,
  SHOP: 1.7, PYPL: 1.2, SQ: 1.8, ROKU: 1.9, TTD: 1.5, TEAM: 1.3, ZM: 1.1, OKTA: 1.5,
  BILL: 1.4, HUBS: 1.3, FTNT: 1.1, WDAY: 1.2, VEEV: 0.9, DXCM: 1.1, MRNA: 1.5,
  BNTX: 1.3, PDD: 1.4, JD: 1.2, BIDU: 1.3, NTES: 0.9, BILI: 1.6, MNST: 0.8,
  LULU: 1.2, ROST: 0.9, CPRT: 1.0, FAST: 0.85, ODFL: 1.1, CSGP: 1.0, ANSS: 1.05,
  ON: 1.6, MCHP: 1.3, NXPI: 1.3, SWKS: 1.3, ADI: 1.1, MU: 1.5, AMAT: 1.4,
  ORCL: 1.0, XRO: 1.3, WTC: 1.4, ALA: 1.2,
};

const KNOWN_BETAS_SP500: Record<string, number> = {
  XOM: 0.8, PM: 0.6, BAC: 1.3, JPM: 1.1, WMT: 0.5, JNJ: 0.6, PG: 0.4,
  UNH: 0.8, HD: 1.0, V: 0.9, MA: 1.0, DIS: 1.1, KO: 0.6, MRK: 0.5,
  ABT: 0.7, CVX: 0.9, PFE: 0.6, TMO: 0.8, ABBV: 0.6, NKE: 0.9, MCD: 0.6,
  IBM: 0.8, GE: 1.1, CAT: 1.0, BA: 1.4, MMM: 0.9, AXP: 1.2, GS: 1.3,
  MS: 1.4, C: 1.3, WFC: 1.1, T: 0.7, VZ: 0.4, LMT: 0.5, RTX: 0.7,
  HON: 1.0, UPS: 0.9, LOW: 1.05, TOL: 1.3, BRK: 0.6,
  ORCL: 1.0, ACN: 1.05,
};

const FUTURES_SPECS: Record<string, { name: string; symbol: string; multiplier: number; defaultPrice: number; marginPerContract: number }> = {
  NQ: { name: 'E-mini NASDAQ 100', symbol: 'NQ', multiplier: 20, defaultPrice: 21500, marginPerContract: 18000 },
  ES: { name: 'E-mini S&P 500', symbol: 'ES', multiplier: 50, defaultPrice: 6000, marginPerContract: 13000 },
  GC: { name: 'COMEX Gold', symbol: 'GC', multiplier: 100, defaultPrice: 2900, marginPerContract: 11000 },
  HG: { name: 'COMEX Copper', symbol: 'HG', multiplier: 25000, defaultPrice: 4.50, marginPerContract: 7000 },
  CL: { name: 'WTI Crude Oil', symbol: 'CL', multiplier: 1000, defaultPrice: 72, marginPerContract: 6500 },
  SI: { name: 'COMEX Silver', symbol: 'SI', multiplier: 5000, defaultPrice: 32, marginPerContract: 9500 },
};

const COMMODITY_LABELS: Record<string, { label: string; futures: string | null; color: string }> = {
  gold: { label: 'Gold', futures: 'GC', color: '#fbbf24' },
  copper: { label: 'Copper', futures: 'HG', color: '#f97316' },
  oil: { label: 'Crude Oil', futures: 'CL', color: '#64748b' },
  silver: { label: 'Silver', futures: 'SI', color: '#94a3b8' },
  iron_ore: { label: 'Iron Ore', futures: null, color: '#dc2626' },
  lithium: { label: 'Lithium', futures: null, color: '#22d3ee' },
  uranium: { label: 'Uranium', futures: null, color: '#a3e635' },
  natgas: { label: 'Natural Gas', futures: null, color: '#818cf8' },
};

const AUDUSD = 0.63;

// ====== Utility Functions ======

const formatValue = (value: number | null | undefined): string => {
  if (value == null) return "-";
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number | null | undefined): string => {
  if (value == null) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
};

const formatNumber = (value: number | null | undefined, decimals = 2): string => {
  if (value == null) return "-";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
};

const formatPrice = (value: number | null | undefined): string => {
  if (value == null) return "-";
  const decimals = Math.abs(value) >= 1 ? 2 : 4;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
};

const formatWeight = (value: number | null | undefined): string => {
  if (value == null) return "-";
  return `${value.toFixed(2)}%`;
};

const getValueClass = (value: number | null | undefined): string => {
  if (value == null) return "";
  return value >= 0 ? "text-gain" : "text-loss";
};

// ====== Black-Scholes ======

const normalCDF = (x: number): number => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1 + sign * y);
};

const bsPutPrice = (S: number, K: number, T: number, r: number, sigma: number): number => {
  if (T <= 0 || sigma <= 0 || S <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
};

const bsCallPrice = (S: number, K: number, T: number, r: number, sigma: number): number => {
  if (T <= 0 || sigma <= 0 || S <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
};

// ====== Classification ======

const getHedgeIndex = (ticker: string, currency: string): string => {
  const upper = (ticker || '').toUpperCase().replace(/\.AX$/, '');
  if (currency === 'AUD' && NASDAQ_CORRELATED_ASX.includes(upper)) return 'NASDAQ';
  if (currency === 'AUD') return 'ASX';
  if (currency === 'HKD' || currency === 'CAD') return 'OTHER';
  if (SP500_HEDGE_STOCKS.includes(upper)) return 'SP500';
  return 'NASDAQ';
};

const classifyPosition = (pos: AdaptedPosition): Classification => {
  const ticker = (pos.ticker || '').toUpperCase().replace(/\.AX$/, '');
  const name = (pos.name || '').toLowerCase();
  const hedgeIndex = getHedgeIndex(pos.ticker, pos.currency);

  if (ticker === 'CASH' || pos.isFutures) return { type: 'cash', commodity: null, hedgeIndex };

  for (const [commodity, tickers] of Object.entries(COMMODITY_TICKERS)) {
    if (tickers.includes(ticker)) return { type: 'commodity', commodity, hedgeIndex };
  }

  if (name.includes('gold') && (name.includes('min') || name.includes('corp') || name.includes('resource')))
    return { type: 'commodity', commodity: 'gold', hedgeIndex };
  if (name.includes('copper') || name.includes('cupric'))
    return { type: 'commodity', commodity: 'copper', hedgeIndex };
  if (name.includes('petroleum') || (name.includes('energy') && (name.includes('oil') || name.includes('gas'))))
    return { type: 'commodity', commodity: 'oil', hedgeIndex };
  if (name.includes('lithium') || name.includes('battery mineral'))
    return { type: 'commodity', commodity: 'lithium', hedgeIndex };
  if (name.includes('uranium') || name.includes('nuclear'))
    return { type: 'commodity', commodity: 'uranium', hedgeIndex };
  if (name.includes('iron ore') || (name.includes('iron') && name.includes('min')))
    return { type: 'commodity', commodity: 'iron_ore', hedgeIndex };
  if (name.includes('silver') && (name.includes('min') || name.includes('corp')))
    return { type: 'commodity', commodity: 'silver', hedgeIndex };

  return { type: 'equity', commodity: null, hedgeIndex };
};

const getNasdaqBeta = (ticker: string): number => {
  const upper = (ticker || '').toUpperCase().replace(/\.AX$/, '');
  return KNOWN_BETAS_NASDAQ[upper] ?? 1.15;
};

const getSP500Beta = (ticker: string): number => {
  const upper = (ticker || '').toUpperCase().replace(/\.AX$/, '');
  return KNOWN_BETAS_SP500[upper] ?? 0.95;
};

// ====== Component ======

export function HedgingSection({ holdings, totalValue }: HedgingSectionProps) {
  const [equityHedgePct, setEquityHedgePct] = useState(50);
  const [commodityHedgePcts, setCommodityHedgePcts] = useState<Record<string, number>>({});
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    equityIndex: true,
    commodity: true,
    currency: true,
    risk: false,
    options: false,
    summary: true,
  });

  const togglePanel = (panel: string) => {
    setExpandedPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

  const getCommodityHedgePct = (commodity: string): number => {
    return commodityHedgePcts[commodity] ?? 100;
  };

  const setCommodityHedgePct = (commodity: string, value: number) => {
    setCommodityHedgePcts(prev => ({ ...prev, [commodity]: value }));
  };

  // Adapt holdings to internal position format
  const adaptedPositions: AdaptedPosition[] = useMemo(() => {
    return holdings.map(h => ({
      ticker: h.ticker,
      name: h.name || h.ticker,
      currency: h.ticker.endsWith('.AX') ? 'AUD' : 'USD',
      marketValueAUD: h.value,
      currentPrice: Number(h.currentPrice || h.avgCost),
      costPrice: Number(h.avgCost),
      pnlPercent: h.pnlPercent,
      portfolioWeight: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
      quantity: Number(h.shares),
      isFutures: false,
    }));
  }, [holdings, totalValue]);

  // Fetch markets data for live futures prices
  const { data: marketsData } = useQuery<MarketsFullData>({
    queryKey: ["/api/markets/full"],
  });

  const futuresPrices = useMemo(() => {
    const prices: Record<string, number> = {};
    if (!marketsData) return prices;

    const allItems = [...(marketsData.futures || []), ...(marketsData.commodities || [])];

    for (const item of allItems) {
      const t = (item.ticker || '').toUpperCase();
      const name = (item.name || '').toLowerCase();

      if (t === 'NQ' || t.startsWith('NQ1') || name.includes('nasdaq 100') || name.includes('nasdaq-100'))
        if (!prices.NQ) prices.NQ = item.price;
      if (t === 'ES' || t.startsWith('ES1') || (name.includes('s&p 500') && !name.includes('equal')))
        if (!prices.ES) prices.ES = item.price;
      if (t === 'GC' || t.startsWith('GC1') || (name.includes('gold') && !name.includes('goldman')))
        if (!prices.GC) prices.GC = item.price;
      if (t === 'HG' || t.startsWith('HG1') || name.includes('copper'))
        if (!prices.HG) prices.HG = item.price;
      if (t === 'CL' || t.startsWith('CL1') || name.includes('crude') || name.includes('wti'))
        if (!prices.CL) prices.CL = item.price;
      if (t === 'SI' || t.startsWith('SI1') || (name.includes('silver') && !name.includes('stream')))
        if (!prices.SI) prices.SI = item.price;
      if (t === 'VIX' || t.startsWith('VIX') || name.includes('vix') || name.includes('volatility'))
        if (!prices.VIX) prices.VIX = item.price;
    }
    return prices;
  }, [marketsData]);

  const getFuturesPrice = (symbol: string): number => futuresPrices[symbol] || FUTURES_SPECS[symbol]?.defaultPrice || 0;

  // Core analysis
  const analysis = useMemo(() => {
    if (adaptedPositions.length === 0) return null;

    const positions = adaptedPositions.filter(p => p.ticker !== 'CASH' && !p.isFutures);
    const fum = totalValue;

    const nasdaqPositions: EquityPosition[] = [];
    const nysePositions: EquityPosition[] = [];
    const asxPositions: GenericPosition[] = [];
    const otherPositions: GenericPosition[] = [];
    const commodityExposures: Record<string, { value: number; valueUSD: number; positions: GenericPosition[] }> = {};
    const currencyExposures: Record<string, { value: number; positions: AdaptedPosition[] }> = {};

    positions.forEach(pos => {
      const classification = classifyPosition(pos);
      const valueUSD = pos.currency === 'AUD' ? pos.marketValueAUD * AUDUSD : pos.marketValueAUD;
      const ticker = (pos.ticker || '').toUpperCase().replace(/\.AX$/, '');

      const cur = pos.currency || 'USD';
      if (!currencyExposures[cur]) currencyExposures[cur] = { value: 0, positions: [] };
      currencyExposures[cur].value += pos.marketValueAUD;
      currencyExposures[cur].positions.push(pos);

      if (classification.type === 'commodity') {
        const comm = classification.commodity!;
        if (!commodityExposures[comm]) commodityExposures[comm] = { value: 0, valueUSD: 0, positions: [] };
        commodityExposures[comm].value += pos.marketValueAUD;
        commodityExposures[comm].valueUSD += valueUSD;
        commodityExposures[comm].positions.push({ ...pos, valueUSD, classification });
      } else if (classification.hedgeIndex === 'NASDAQ') {
        const beta = getNasdaqBeta(ticker);
        nasdaqPositions.push({ ...pos, beta, betaAdjExposure: valueUSD * beta, valueUSD, classification });
      } else if (classification.hedgeIndex === 'SP500') {
        const beta = getSP500Beta(ticker);
        nysePositions.push({ ...pos, beta, betaAdjExposure: valueUSD * beta, valueUSD, classification });
      } else if (classification.hedgeIndex === 'ASX') {
        asxPositions.push({ ...pos, valueUSD, classification });
      } else {
        otherPositions.push({ ...pos, valueUSD, classification });
      }
    });

    const totalLongAUD = positions.reduce((sum, p) => sum + (p.marketValueAUD > 0 ? p.marketValueAUD : 0), 0);
    const totalShortAUD = positions.reduce((sum, p) => sum + (p.marketValueAUD < 0 ? Math.abs(p.marketValueAUD) : 0), 0);
    const netExposure = totalLongAUD - totalShortAUD;
    const grossExposure = totalLongAUD + totalShortAUD;

    const totalNasdaqBetaAdj = nasdaqPositions.reduce((sum, p) => sum + p.betaAdjExposure, 0);
    const totalNasdaqNotional = nasdaqPositions.reduce((sum, p) => sum + p.valueUSD, 0);
    const weightedNasdaqBeta = totalNasdaqNotional > 0 ? totalNasdaqBetaAdj / totalNasdaqNotional : 0;

    const totalNYSEBetaAdj = nysePositions.reduce((sum, p) => sum + p.betaAdjExposure, 0);
    const totalNYSENotional = nysePositions.reduce((sum, p) => sum + p.valueUSD, 0);
    const weightedNYSEBeta = totalNYSENotional > 0 ? totalNYSEBetaAdj / totalNYSENotional : 0;

    const totalASXNotional = asxPositions.reduce((sum, p) => sum + p.valueUSD, 0);

    const fumUSD = fum; // portfolio values are primarily USD
    const portfolioBeta = fumUSD > 0
      ? (totalNasdaqBetaAdj + totalNYSEBetaAdj + totalASXNotional * 0.85) / fumUSD
      : 0;

    const dailyVol = portfolioBeta * 0.012;
    const var95_1d = fum * dailyVol * 1.645;
    const var99_1d = fum * dailyVol * 2.326;
    const var95_10d = var95_1d * Math.sqrt(10);

    return {
      positions, fum, nasdaqPositions, nysePositions, asxPositions, otherPositions,
      commodityExposures, currencyExposures,
      totalLongAUD, totalShortAUD, netExposure, grossExposure,
      totalNasdaqBetaAdj, totalNasdaqNotional, weightedNasdaqBeta,
      totalNYSEBetaAdj, totalNYSENotional, weightedNYSEBeta,
      totalASXNotional, portfolioBeta,
      var95_1d, var99_1d, var95_10d, dailyVol,
    };
  }, [adaptedPositions, totalValue]);

  // Hedge calculations
  const hedgeCalcs = useMemo(() => {
    if (!analysis) return null;
    const hedgeFrac = equityHedgePct / 100;

    const nqPrice = getFuturesPrice('NQ');
    const nqContractValue = nqPrice * FUTURES_SPECS.NQ.multiplier;
    const nqExposureToHedge = analysis.totalNasdaqBetaAdj * hedgeFrac;
    const nqContracts = nqContractValue > 0 ? Math.round(nqExposureToHedge / nqContractValue) : 0;

    const esPrice = getFuturesPrice('ES');
    const esContractValue = esPrice * FUTURES_SPECS.ES.multiplier;
    const esExposureToHedge = analysis.totalNYSEBetaAdj * hedgeFrac;
    const esContracts = esContractValue > 0 ? Math.round(esExposureToHedge / esContractValue) : 0;

    const commodityHedges: Record<string, CommodityHedge> = {};
    for (const [comm, data] of Object.entries(analysis.commodityExposures)) {
      const meta = COMMODITY_LABELS[comm];
      if (!meta?.futures) {
        commodityHedges[comm] = { contracts: 0, futuresSymbol: null, exposureUSD: data.valueUSD, hedgeable: false };
        continue;
      }
      const futSymbol = meta.futures;
      const spec = FUTURES_SPECS[futSymbol];
      if (!spec) continue;
      const price = getFuturesPrice(futSymbol);
      const contractValue = price * spec.multiplier;
      const commHedgePct = getCommodityHedgePct(comm) / 100;
      const contracts = contractValue > 0 ? Math.round((data.valueUSD * commHedgePct) / contractValue) : 0;
      commodityHedges[comm] = {
        contracts, futuresSymbol: futSymbol, exposureUSD: data.valueUSD,
        contractValue, price, hedgeable: true,
        hedgePct: commHedgePct, marginPerContract: spec.marginPerContract,
      };
    }

    const totalMargin = (nqContracts * FUTURES_SPECS.NQ.marginPerContract)
      + (esContracts * FUTURES_SPECS.ES.marginPerContract)
      + Object.values(commodityHedges).reduce((s, h) => s + (h.contracts || 0) * (h.marginPerContract || 0), 0);

    const hedgedBeta = analysis.portfolioBeta * (1 - hedgeFrac);

    return {
      nqPrice, nqContractValue, nqExposureToHedge, nqContracts,
      esPrice, esContractValue, esExposureToHedge, esContracts,
      commodityHedges, totalMargin, hedgedBeta,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, equityHedgePct, commodityHedgePcts, futuresPrices]);

  // Loading state
  if (holdings.length === 0) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-500 mb-1">No holdings to analyze</p>
        <p className="text-zinc-600 text-sm">Add positions to your portfolio to see hedging recommendations.</p>
      </div>
    );
  }

  if (!analysis || !hedgeCalcs) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full bg-zinc-800" />
        ))}
      </div>
    );
  }

  const { fum } = analysis;

  // ====== Render Helpers ======

  const renderCollapsiblePanel = (id: string, title: string, badge: string | null, content: React.ReactNode) => (
    <div className="border border-zinc-800 rounded-lg mb-3 overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3.5 bg-zinc-900/50 cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={() => togglePanel(id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanel(id); } }}
        role="button"
        tabIndex={0}
        aria-expanded={expandedPanels[id]}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-zinc-100">{title}</span>
          {badge && <span className="text-[11px] text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded">{badge}</span>}
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${expandedPanels[id] ? 'rotate-180' : ''}`} />
      </div>
      {expandedPanels[id] && <div className="p-4 px-5 border-t border-zinc-800/60">{content}</div>}
    </div>
  );

  const renderExposureCards = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex flex-col gap-1">
        <span className="text-[11px] text-zinc-400 uppercase tracking-wide">Gross Exposure</span>
        <span className="text-xl sm:text-2xl font-semibold text-zinc-100 font-mono">{formatValue(analysis.grossExposure)}</span>
        <span className="text-xs text-zinc-500">{fum > 0 ? `${((analysis.grossExposure / fum) * 100).toFixed(0)}% of portfolio` : ''}</span>
      </div>
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex flex-col gap-1">
        <span className="text-[11px] text-zinc-400 uppercase tracking-wide">Net Exposure</span>
        <span className={`text-xl sm:text-2xl font-semibold font-mono ${getValueClass(analysis.netExposure)}`}>{formatValue(analysis.netExposure)}</span>
        <span className="text-xs text-zinc-500">{fum > 0 ? `${((analysis.netExposure / fum) * 100).toFixed(0)}% of portfolio` : ''}</span>
      </div>
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex flex-col gap-1">
        <span className="text-[11px] text-zinc-400 uppercase tracking-wide">Portfolio Beta</span>
        <span className="text-xl sm:text-2xl font-semibold text-zinc-100 font-mono">{analysis.portfolioBeta.toFixed(2)}</span>
        <span className="text-xs text-zinc-500">
          Hedged: <span className={getValueClass(hedgeCalcs.hedgedBeta < analysis.portfolioBeta ? -1 : 1)}>{hedgeCalcs.hedgedBeta.toFixed(2)}</span>
        </span>
      </div>
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex flex-col gap-1">
        <span className="text-[11px] text-zinc-400 uppercase tracking-wide">VaR (95%, 1D)</span>
        <span className="text-xl sm:text-2xl font-semibold text-loss font-mono">{formatValue(analysis.var95_1d)}</span>
        <span className="text-xs text-zinc-500">{fum > 0 ? `${((analysis.var95_1d / fum) * 100).toFixed(2)}% of portfolio` : ''}</span>
      </div>
    </div>
  );

  const renderEquityIndexPanel = () => {
    const nasdaqRows = [...analysis.nasdaqPositions].sort((a, b) => b.betaAdjExposure - a.betaAdjExposure);
    const nyseRows = [...analysis.nysePositions].sort((a, b) => b.betaAdjExposure - a.betaAdjExposure);

    return (
      <div>
        {/* Hedge slider */}
        <div className="mb-5 p-4 bg-amber-500/5 border border-amber-500/15 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-zinc-300 font-medium">Equity Hedge Ratio</span>
            <span className="text-lg font-bold text-amber-400 font-mono">{equityHedgePct}%</span>
          </div>
          <input
            type="range" min="0" max="100" value={equityHedgePct}
            onChange={(e) => setEquityHedgePct(Number(e.target.value))}
            className="hedge-slider"
          />
          <div className="flex justify-between mt-1 text-[10px] text-zinc-500">
            <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
        </div>

        {/* NASDAQ section */}
        {nasdaqRows.length > 0 && (
          <div className="mb-6 pb-5 border-b border-zinc-800/50">
            <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
              <h4 className="text-sm font-semibold text-zinc-200">NASDAQ 100 Hedge</h4>
              <div className="flex gap-4 text-xs text-zinc-400 flex-wrap">
                <span>Notional: <strong className="text-zinc-200">${formatNumber(analysis.totalNasdaqNotional / 1e6, 2)}M</strong></span>
                <span>Wtd Beta: <strong className="text-zinc-200">{analysis.weightedNasdaqBeta.toFixed(2)}</strong></span>
                <span>Beta-Adj: <strong className="text-zinc-200">${formatNumber(analysis.totalNasdaqBetaAdj / 1e6, 2)}M</strong></span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Ticker</th>
                    <th className="px-3 py-2 text-right font-medium">% Wt</th>
                    <th className="px-3 py-2 text-right font-medium">Price</th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                    <th className="px-3 py-2 text-right font-medium">% P&L</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Value</th>
                    <th className="px-3 py-2 text-right font-medium">Beta</th>
                    <th className="px-3 py-2 text-right font-medium">Beta-Adj</th>
                  </tr>
                </thead>
                <tbody>
                  {nasdaqRows.map((pos, i) => (
                    <tr key={`nq-${pos.ticker}-${i}`} className="border-b border-zinc-800/50 hover:bg-amber-900/10 transition-colors">
                      <td className="px-3 py-2 text-zinc-300 text-xs truncate max-w-[140px]">{pos.name}</td>
                      <td className="px-3 py-2 font-mono text-amber-400 text-xs font-semibold">{pos.ticker}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatWeight(pos.portfolioWeight)}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatPrice(pos.currentPrice)}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-400">{formatPrice(pos.costPrice)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${getValueClass(pos.pnlPercent)}`}>{formatPercent(pos.pnlPercent)}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{pos.quantity?.toLocaleString() || '-'}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatValue(pos.marketValueAUD)}</td>
                      <td className="px-3 py-2 text-right"><span className="inline-block bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded text-xs font-semibold font-mono">{pos.beta.toFixed(2)}</span></td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">${formatNumber(pos.betaAdjExposure / 1000, 0)}k</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-3 px-4 mt-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm font-semibold text-zinc-200">NQ E-mini Futures</span>
                <span className="text-xs text-zinc-400">@ {formatNumber(hedgeCalcs.nqPrice, 0)} x $20 = ${formatNumber(hedgeCalcs.nqContractValue / 1000, 0)}k / contract</span>
              </div>
              <div className="flex justify-between items-center text-sm text-zinc-300">
                <span>Exposure to hedge: <strong>${formatNumber(hedgeCalcs.nqExposureToHedge / 1e6, 2)}M</strong></span>
                <span className="inline-block bg-red-500/15 text-red-400 px-3 py-1 rounded font-bold text-sm font-mono">Short {hedgeCalcs.nqContracts} NQ</span>
              </div>
            </div>
          </div>
        )}

        {/* S&P 500 section */}
        {nyseRows.length > 0 && (
          <div className="mb-6 pb-5 border-b border-zinc-800/50">
            <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
              <h4 className="text-sm font-semibold text-zinc-200">S&P 500 Hedge</h4>
              <div className="flex gap-4 text-xs text-zinc-400 flex-wrap">
                <span>Notional: <strong className="text-zinc-200">${formatNumber(analysis.totalNYSENotional / 1e6, 2)}M</strong></span>
                <span>Wtd Beta: <strong className="text-zinc-200">{analysis.weightedNYSEBeta.toFixed(2)}</strong></span>
                <span>Beta-Adj: <strong className="text-zinc-200">${formatNumber(analysis.totalNYSEBetaAdj / 1e6, 2)}M</strong></span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Ticker</th>
                    <th className="px-3 py-2 text-right font-medium">% Wt</th>
                    <th className="px-3 py-2 text-right font-medium">Price</th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                    <th className="px-3 py-2 text-right font-medium">% P&L</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Value</th>
                    <th className="px-3 py-2 text-right font-medium">Beta</th>
                    <th className="px-3 py-2 text-right font-medium">Beta-Adj</th>
                  </tr>
                </thead>
                <tbody>
                  {nyseRows.map((pos, i) => (
                    <tr key={`nyse-${pos.ticker}-${i}`} className="border-b border-zinc-800/50 hover:bg-amber-900/10 transition-colors">
                      <td className="px-3 py-2 text-zinc-300 text-xs truncate max-w-[140px]">{pos.name}</td>
                      <td className="px-3 py-2 font-mono text-amber-400 text-xs font-semibold">{pos.ticker}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatWeight(pos.portfolioWeight)}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatPrice(pos.currentPrice)}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-400">{formatPrice(pos.costPrice)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${getValueClass(pos.pnlPercent)}`}>{formatPercent(pos.pnlPercent)}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{pos.quantity?.toLocaleString() || '-'}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatValue(pos.marketValueAUD)}</td>
                      <td className="px-3 py-2 text-right"><span className="inline-block bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded text-xs font-semibold font-mono">{pos.beta.toFixed(2)}</span></td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">${formatNumber(pos.betaAdjExposure / 1000, 0)}k</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-3 px-4 mt-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm font-semibold text-zinc-200">ES E-mini Futures</span>
                <span className="text-xs text-zinc-400">@ {formatNumber(hedgeCalcs.esPrice, 0)} x $50 = ${formatNumber(hedgeCalcs.esContractValue / 1000, 0)}k / contract</span>
              </div>
              <div className="flex justify-between items-center text-sm text-zinc-300">
                <span>Exposure to hedge: <strong>${formatNumber(hedgeCalcs.esExposureToHedge / 1e6, 2)}M</strong></span>
                <span className="inline-block bg-red-500/15 text-red-400 px-3 py-1 rounded font-bold text-sm font-mono">Short {hedgeCalcs.esContracts} ES</span>
              </div>
            </div>
          </div>
        )}

        {/* ASX section */}
        {analysis.asxPositions.length > 0 && (
          <div>
            <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
              <h4 className="text-sm font-semibold text-zinc-200">ASX Exposure</h4>
              <div className="flex gap-4 text-xs text-zinc-400 flex-wrap">
                <span>Notional (USD): <strong className="text-zinc-200">${formatNumber(analysis.totalASXNotional / 1e6, 2)}M</strong></span>
                <span className="text-xs text-zinc-500 italic">Hedge via SPI 200 or single-stock</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Ticker</th>
                    <th className="px-3 py-2 text-right font-medium">% Wt</th>
                    <th className="px-3 py-2 text-right font-medium">Price</th>
                    <th className="px-3 py-2 text-right font-medium">% P&L</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Value</th>
                    <th className="px-3 py-2 text-right font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.asxPositions.map((pos, i) => (
                    <tr key={`asx-${pos.ticker}-${i}`} className="border-b border-zinc-800/50 hover:bg-amber-900/10 transition-colors">
                      <td className="px-3 py-2 text-zinc-300 text-xs truncate max-w-[140px]">{pos.name}</td>
                      <td className="px-3 py-2 font-mono text-amber-400 text-xs font-semibold">{pos.ticker}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatWeight(pos.portfolioWeight)}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatPrice(pos.currentPrice)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${getValueClass(pos.pnlPercent)}`}>{formatPercent(pos.pnlPercent)}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{pos.quantity?.toLocaleString() || '-'}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatValue(pos.marketValueAUD)}</td>
                      <td className="px-3 py-2 text-right"><span className="inline-block bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded text-xs capitalize">{pos.classification?.commodity || 'Equity'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCommodityPanel = () => {
    const commodities = Object.entries(analysis.commodityExposures).sort((a, b) => b[1].valueUSD - a[1].valueUSD);
    if (commodities.length === 0) {
      return <div className="text-center py-6 text-zinc-500 text-sm">No direct commodity exposure detected in portfolio.</div>;
    }

    return (
      <div className="flex flex-col gap-3">
        {commodities.map(([comm, data]) => {
          const meta = COMMODITY_LABELS[comm] || { label: comm, color: '#6b7280' };
          const hedge = hedgeCalcs?.commodityHedges[comm];
          const sortedPositions = [...data.positions].sort((a, b) => (b.marketValueAUD || 0) - (a.marketValueAUD || 0));
          return (
            <div key={comm} className="mb-6 pb-5 border-b border-zinc-800/50 last:border-b-0 last:mb-0 last:pb-0">
              <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                <h4 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                  {meta.label} Exposure
                </h4>
                <div className="flex gap-4 text-xs text-zinc-400 flex-wrap">
                  <span>Notional: <strong className="text-zinc-200">${formatNumber(data.valueUSD / 1e6, 2)}M</strong></span>
                  <span>{data.positions.length} positions</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Ticker</th>
                      <th className="px-3 py-2 text-right font-medium">% Wt</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                      <th className="px-3 py-2 text-right font-medium">Cost</th>
                      <th className="px-3 py-2 text-right font-medium">% P&L</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPositions.map((pos, i) => (
                      <tr key={`${comm}-${pos.ticker}-${i}`} className="border-b border-zinc-800/50 hover:bg-amber-900/10 transition-colors">
                        <td className="px-3 py-2 text-zinc-300 text-xs truncate max-w-[140px]">{pos.name}</td>
                        <td className="px-3 py-2 font-mono text-amber-400 text-xs font-semibold">{pos.ticker}</td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatWeight(pos.portfolioWeight)}</td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatPrice(pos.currentPrice)}</td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-400">{formatPrice(pos.costPrice)}</td>
                        <td className={`px-3 py-2 text-right font-mono ${getValueClass(pos.pnlPercent)}`}>{formatPercent(pos.pnlPercent)}</td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-300">{pos.quantity?.toLocaleString() || '-'}</td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-300">{formatValue(pos.marketValueAUD)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hedge?.hedgeable && (
                <>
                  <div className="p-2.5 px-3 bg-amber-500/5 border border-amber-500/15 rounded-lg mt-3 mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-zinc-300 font-medium">Hedge %</span>
                      <span className="text-sm font-bold text-amber-400 font-mono">{getCommodityHedgePct(comm)}%</span>
                    </div>
                    <input
                      type="range" min="0" max="100"
                      value={getCommodityHedgePct(comm)}
                      onChange={(e) => setCommodityHedgePct(comm, Number(e.target.value))}
                      className="hedge-slider"
                    />
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-3 px-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-semibold text-zinc-200">{hedge.futuresSymbol} Futures</span>
                      <span className="text-xs text-zinc-400">@ {formatNumber(hedge.price!, hedge.futuresSymbol === 'HG' ? 2 : 0)} x {FUTURES_SPECS[hedge.futuresSymbol!]?.multiplier?.toLocaleString()} = ${formatNumber(hedge.contractValue! / 1000, 0)}k / contract</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-zinc-300 flex-wrap gap-2">
                      <span>Exposure to hedge: <strong>${formatNumber(data.valueUSD * (getCommodityHedgePct(comm) / 100) / 1e6, 2)}M</strong></span>
                      <span className="inline-block bg-red-500/15 text-red-400 px-3 py-1 rounded font-bold text-sm font-mono">Short {hedge.contracts} {hedge.futuresSymbol}</span>
                    </div>
                  </div>
                </>
              )}
              {!hedge?.hedgeable && hedge && (
                <p className="text-xs text-zinc-500 italic mt-2">No liquid futures contract -- consider ETF/swap hedge</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCurrencyPanel = () => {
    const currencies = Object.entries(analysis.currencyExposures).sort((a, b) => b[1].value - a[1].value);
    const total = currencies.reduce((s, [, d]) => s + d.value, 0);
    const colors: Record<string, string> = { USD: '#3b82f6', AUD: '#10b981', HKD: '#f59e0b', CAD: '#ef4444' };

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {currencies.map(([cur, data]) => {
            const pct = total > 0 ? (data.value / total) * 100 : 0;
            const color = colors[cur] || '#8b5cf6';
            return (
              <div key={cur} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-bold text-sm min-w-[36px]" style={{ color }}>{cur}</span>
                  <span className="text-zinc-200 font-medium">{formatValue(data.value)}</span>
                  <span className="text-zinc-400">{pct.toFixed(1)}%</span>
                  <span className="text-zinc-500 text-xs">{data.positions.length} positions</span>
                </div>
                <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-xs text-zinc-400 leading-relaxed bg-amber-500/5 border border-amber-500/15 rounded-md p-2.5 px-3.5">
          <strong className="text-amber-400">FX Hedging Note:</strong> Non-USD exposure creates implicit currency risk.
          Consider FX forwards or futures for non-USD-denominated holdings if FX view is not intentional.
          Current assumed AUD/USD rate: {AUDUSD.toFixed(2)}
        </div>
      </div>
    );
  };

  const renderRiskPanel = () => (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-3 flex flex-col gap-1">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wide">Daily Volatility (est.)</span>
          <span className="text-lg font-semibold text-zinc-100 font-mono">{(analysis.dailyVol * 100).toFixed(2)}%</span>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-3 flex flex-col gap-1">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wide">VaR 95% (1-Day)</span>
          <span className="text-lg font-semibold text-loss font-mono">{formatValue(analysis.var95_1d)}</span>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-3 flex flex-col gap-1">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wide">VaR 99% (1-Day)</span>
          <span className="text-lg font-semibold text-loss font-mono">{formatValue(analysis.var99_1d)}</span>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-md p-3 flex flex-col gap-1">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wide">VaR 95% (10-Day)</span>
          <span className="text-lg font-semibold text-loss font-mono">{formatValue(analysis.var95_10d)}</span>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-zinc-200 mb-3">Stress Scenarios</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                <th className="px-3 py-2 text-left font-medium">Scenario</th>
                <th className="px-3 py-2 text-right font-medium">Market Move</th>
                <th className="px-3 py-2 text-right font-medium">Est. Impact</th>
                <th className="px-3 py-2 text-right font-medium">Impact %</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'NASDAQ -5% correction', move: '-5%', factor: -0.05 * analysis.portfolioBeta },
                { name: 'NASDAQ -10% selloff', move: '-10%', factor: -0.10 * analysis.portfolioBeta },
                { name: 'NASDAQ -20% bear', move: '-20%', factor: -0.20 * analysis.portfolioBeta },
                { name: 'Gold -10%', move: '-10%', factor: -0.10 * (Object.values(analysis.commodityExposures).reduce((s, d) => s + d.value, 0) / (fum || 1)) },
                { name: 'AUD/USD -5%', move: '-5%', factor: -0.05 * ((analysis.currencyExposures['AUD']?.value || 0) / (fum || 1)) },
                { name: 'Vol spike (VIX +15)', move: '+15 pts', factor: -0.03 * analysis.portfolioBeta },
              ].map((s, i) => {
                const impact = fum * s.factor;
                const impactPct = s.factor * 100;
                return (
                  <tr key={i} className="border-b border-zinc-800/50">
                    <td className="px-3 py-2 text-zinc-300">{s.name}</td>
                    <td className="px-3 py-2 text-right text-zinc-300 font-mono">{s.move}</td>
                    <td className="px-3 py-2 text-right text-loss font-mono">{formatValue(impact)}</td>
                    <td className="px-3 py-2 text-right text-loss font-mono">{impactPct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-zinc-200 mb-3">Concentration Risk</h4>
        <div className="flex flex-col gap-2">
          {analysis.positions
            .sort((a, b) => (b.portfolioWeight || 0) - (a.portfolioWeight || 0))
            .slice(0, 5)
            .map((pos, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-zinc-300 min-w-[120px] sm:min-w-[140px] truncate">{pos.name}</span>
                <div className="flex-1 h-2 bg-zinc-800/60 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded transition-all duration-300"
                    style={{ width: `${Math.min((pos.portfolioWeight || 0) * 2, 100)}%` }}
                  />
                </div>
                <span className="text-sm text-zinc-400 font-semibold min-w-[50px] text-right font-mono">{formatWeight(pos.portfolioWeight)}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );

  const renderOptionsPanel = () => {
    const nqPrice = getFuturesPrice('NQ');
    const vix = futuresPrices.VIX || 18;
    const iv = vix / 100;
    const r = 0.045;
    const nqMult = FUTURES_SPECS.NQ.multiplier;
    const contractsNeeded = nqPrice > 0 ? Math.round(analysis.totalNasdaqBetaAdj / (nqPrice * nqMult)) : 0;

    const expiries = [
      { label: '30-day', T: 30 / 365 },
      { label: '90-day', T: 90 / 365 },
    ];

    const strategies = expiries.map(({ label, T }) => {
      const strike5 = Math.round(nqPrice * 0.95);
      const strike10 = Math.round(nqPrice * 0.90);
      const strike15 = Math.round(nqPrice * 0.85);
      const callStrike10 = Math.round(nqPrice * 1.10);

      const put5 = bsPutPrice(nqPrice, strike5, T, r, iv);
      const put10 = bsPutPrice(nqPrice, strike10, T, r, iv);
      const call10 = bsCallPrice(nqPrice, callStrike10, T, r, iv);
      const put15 = bsPutPrice(nqPrice, strike15, T, r, iv);

      const put5perContract = put5 * nqMult;
      const put10perContract = put10 * nqMult;
      const putSpreadPerContract = (put5 - put15) * nqMult;
      const collarPerContract = (put5 - call10) * nqMult;

      return {
        label, strike5, strike10, strike15, callStrike10,
        put5perContract, put10perContract, putSpreadPerContract, collarPerContract,
        totalPut5: put5perContract * contractsNeeded,
        totalPut10: put10perContract * contractsNeeded,
        totalPutSpread: putSpreadPerContract * contractsNeeded,
        totalCollar: collarPerContract * contractsNeeded,
        put5, put10,
      };
    });

    return (
      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-zinc-200">Options-Based Hedging (Black-Scholes)</h4>
        <div className="text-xs text-zinc-400 leading-relaxed bg-amber-500/5 border border-amber-500/15 rounded-md p-2.5 px-3.5 mb-2">
          Using {futuresPrices.VIX ? 'live' : 'default'} VIX: <strong className="text-amber-400">{vix.toFixed(1)}</strong> | NQ: <strong className="text-amber-400">{formatNumber(nqPrice, 0)}</strong> | Contracts needed: <strong className="text-amber-400">{contractsNeeded}</strong>
        </div>
        {strategies.map(s => (
          <div key={s.label} className="mb-4">
            <h4 className="text-xs font-semibold text-zinc-300 mb-2 uppercase tracking-wide">{s.label} expiry</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3.5 px-4 flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-zinc-200">Protective Puts (5% OTM)</span>
                <span className="text-xs text-zinc-400 leading-relaxed">Strike: {formatNumber(s.strike5, 0)} | Premium: ${formatNumber(s.put5, 1)}/pt (${formatNumber(s.put5perContract, 0)}/contract)</span>
                <span className="text-sm text-zinc-300 mt-1">Total ({contractsNeeded} contracts): <strong className="text-loss">${formatNumber(s.totalPut5, 0)}</strong></span>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3.5 px-4 flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-zinc-200">Protective Puts (10% OTM)</span>
                <span className="text-xs text-zinc-400 leading-relaxed">Strike: {formatNumber(s.strike10, 0)} | Premium: ${formatNumber(s.put10, 1)}/pt (${formatNumber(s.put10perContract, 0)}/contract)</span>
                <span className="text-sm text-zinc-300 mt-1">Total ({contractsNeeded} contracts): <strong className="text-loss">${formatNumber(s.totalPut10, 0)}</strong></span>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3.5 px-4 flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-zinc-200">Collar (Buy 5% Put, Sell 10% Call)</span>
                <span className="text-xs text-zinc-400 leading-relaxed">Put strike: {formatNumber(s.strike5, 0)} | Call strike: {formatNumber(s.callStrike10, 0)}</span>
                <span className="text-sm text-zinc-300 mt-1">
                  Net per contract: <strong className={s.collarPerContract > 0 ? 'text-loss' : 'text-gain'}>${formatNumber(Math.abs(s.collarPerContract), 0)}</strong> {s.collarPerContract > 0 ? 'debit' : 'credit'} | Total: ${formatNumber(Math.abs(s.totalCollar), 0)}
                </span>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3.5 px-4 flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-zinc-200">Put Spread (5%-15% OTM)</span>
                <span className="text-xs text-zinc-400 leading-relaxed">Buy {formatNumber(s.strike5, 0)} put, sell {formatNumber(s.strike15, 0)} put. Protects 5-15% range.</span>
                <span className="text-sm text-zinc-300 mt-1">Total ({contractsNeeded} contracts): <strong className="text-loss">${formatNumber(s.totalPutSpread, 0)}</strong></span>
              </div>
            </div>
          </div>
        ))}
        <div className="text-xs text-zinc-400 leading-relaxed bg-amber-500/5 border border-amber-500/15 rounded-md p-2.5 px-3.5 mt-1">
          <strong className="text-amber-400">Note:</strong> Prices calculated using Black-Scholes with {futuresPrices.VIX ? 'live' : 'estimated'} VIX ({vix.toFixed(1)}%), risk-free rate {(r * 100).toFixed(1)}%.
          Actual premiums may differ due to skew, term structure, and liquidity.
        </div>
      </div>
    );
  };

  const renderSummaryPanel = () => {
    const allHedges: { instrument: string; direction: string; contracts: number; notional: number; margin: number; hedges: string }[] = [];
    if (hedgeCalcs.nqContracts > 0) {
      allHedges.push({
        instrument: 'NQ E-mini', direction: 'Short', contracts: hedgeCalcs.nqContracts,
        notional: hedgeCalcs.nqContracts * hedgeCalcs.nqContractValue,
        margin: hedgeCalcs.nqContracts * FUTURES_SPECS.NQ.marginPerContract,
        hedges: 'NASDAQ equity exposure',
      });
    }
    if (hedgeCalcs.esContracts > 0) {
      allHedges.push({
        instrument: 'ES E-mini', direction: 'Short', contracts: hedgeCalcs.esContracts,
        notional: hedgeCalcs.esContracts * hedgeCalcs.esContractValue,
        margin: hedgeCalcs.esContracts * FUTURES_SPECS.ES.marginPerContract,
        hedges: 'NYSE / S&P 500 exposure',
      });
    }
    for (const [comm, hedge] of Object.entries(hedgeCalcs.commodityHedges)) {
      if (hedge.contracts > 0 && hedge.hedgeable) {
        const spec = FUTURES_SPECS[hedge.futuresSymbol!];
        allHedges.push({
          instrument: `${hedge.futuresSymbol} ${spec?.name?.split(' ').pop() || ''}`,
          direction: 'Short', contracts: hedge.contracts,
          notional: hedge.contracts * hedge.contractValue!,
          margin: hedge.contracts * (hedge.marginPerContract || 0),
          hedges: `${COMMODITY_LABELS[comm]?.label || comm} exposure`,
        });
      }
    }

    const totalNotional = allHedges.reduce((s, h) => s + h.notional, 0);
    const totalMargin = allHedges.reduce((s, h) => s + h.margin, 0);

    if (allHedges.length === 0) {
      return <div className="text-center py-6 text-zinc-500 text-sm">Adjust hedge sliders above to generate hedge recommendations.</div>;
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase">
                <th className="px-3 py-2 text-left font-medium">Instrument</th>
                <th className="px-3 py-2 text-left font-medium">Direction</th>
                <th className="px-3 py-2 text-right font-medium">Contracts</th>
                <th className="px-3 py-2 text-right font-medium">Notional (USD)</th>
                <th className="px-3 py-2 text-right font-medium">Init. Margin</th>
                <th className="px-3 py-2 text-left font-medium">Hedges</th>
              </tr>
            </thead>
            <tbody>
              {allHedges.map((h, i) => (
                <tr key={i} className="border-b border-zinc-800/50">
                  <td className="px-3 py-2 font-semibold text-zinc-200">{h.instrument}</td>
                  <td className="px-3 py-2 text-red-400 font-semibold">{h.direction}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">{h.contracts}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">${formatNumber(h.notional / 1000, 0)}k</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">${formatNumber(h.margin / 1000, 0)}k</td>
                  <td className="px-3 py-2 text-xs text-zinc-500 italic">{h.hedges}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-700">
                <td colSpan={2} className="px-3 py-2 font-semibold text-zinc-200">Total</td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-zinc-200">{allHedges.reduce((s, h) => s + h.contracts, 0)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-zinc-200">${formatNumber(totalNotional / 1e6, 2)}M</td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-zinc-200">${formatNumber(totalMargin / 1000, 0)}k</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex gap-6 flex-wrap">
          <div className="flex flex-col gap-0.5 text-sm text-zinc-400">
            <span>Total Margin Required</span>
            <strong className="text-zinc-200">${formatNumber(totalMargin / 1000, 0)}k ({fum > 0 ? ((totalMargin / fum) * 100).toFixed(1) : 0}% of portfolio)</strong>
          </div>
          <div className="flex flex-col gap-0.5 text-sm text-zinc-400">
            <span>Hedge Notional vs Portfolio</span>
            <strong className="text-zinc-200">{fum > 0 ? ((totalNotional / fum) * 100).toFixed(0) : 0}% coverage</strong>
          </div>
        </div>
      </div>
    );
  };

  // ====== Main Render ======

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Portfolio Hedging</h2>
        <span className="text-xs text-zinc-500 font-mono">AUD/USD: {AUDUSD.toFixed(2)}</span>
      </div>

      {renderExposureCards()}

      {renderCollapsiblePanel(
        'equityIndex',
        'Equity Index Hedging',
        `${analysis.nasdaqPositions.length + analysis.nysePositions.length} positions`,
        renderEquityIndexPanel()
      )}

      {renderCollapsiblePanel(
        'commodity',
        'Commodity Exposure & Hedging',
        `${Object.keys(analysis.commodityExposures).length} commodities`,
        renderCommodityPanel()
      )}

      {renderCollapsiblePanel(
        'currency',
        'Currency Exposure',
        `${Object.keys(analysis.currencyExposures).length} currencies`,
        renderCurrencyPanel()
      )}

      {renderCollapsiblePanel(
        'risk',
        'Risk Metrics & Stress Testing',
        null,
        renderRiskPanel()
      )}

      {renderCollapsiblePanel(
        'options',
        'Options-Based Hedging',
        'Alternatives to futures',
        renderOptionsPanel()
      )}

      {renderCollapsiblePanel(
        'summary',
        'Hedging Order Summary',
        `${Object.values(hedgeCalcs.commodityHedges).reduce((s, h) => s + (h.contracts || 0), 0) + hedgeCalcs.nqContracts + hedgeCalcs.esContracts} contracts`,
        renderSummaryPanel()
      )}
    </div>
  );
}
