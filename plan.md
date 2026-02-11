# Plan: ASX USA Markets Live Section

## Overview

Add a new "ASX USA Markets" section **below** the existing tabbed market data table on the Markets page (`/dashboard`). This section is a standalone area (not another tab) that provides an at-a-glance view of how the US market session is unfolding — designed for Australian investors watching Wall Street overnight.

---

## Architecture

- **Frontend:** New `AsxUsaMarketsSection` component rendered after the `<Tabs>` block in `markets.tsx`
- **Backend:** 2-3 new API routes in `routes.ts` proxying LaserBeam Capital + FMP APIs
- **Charting:** Recharts (already installed) for intraday area/line charts + SVG sparklines
- **Data refresh:** TanStack Query with 60s polling for intraday data, 5min for sector/news

---

## Section Layout (Top to Bottom)

### 1. Session Status Header
- Title: "ASX USA MARKETS — LIVE" with a pulsing green dot when US market is open
- Market status indicator: Pre-market / Open / After-hours / Closed
- Current time in ET and AEST side by side
- Time until next open/close

### 2. Index Overview Cards (3 across)
- **S&P 500 (SPY)**, **Nasdaq 100 (QQQ)**, **Dow Jones (DIA)**
- Each card shows: current price, day change %, mini intraday sparkline chart
- Color-coded border (green/red based on direction)
- Data source: Existing `/api/markets/full` globalMarkets data + new intraday endpoint

### 3. Intraday Performance Chart
- Full-width Recharts `AreaChart` showing today's price movement for SPY/QQQ/DIA
- Toggle buttons to switch between indices or overlay all three
- Time axis: 9:30 AM - 4:00 PM ET
- Gradient fill (green when above open, red when below)
- Data source: New `/api/markets/intraday` endpoint → FMP `historical-chart/5min/{symbol}` API

### 4. Sector Heatmap / Performance Bars
- All 11 S&P 500 sectors shown as horizontal bars sorted by daily performance
- Each bar: sector name, ETF ticker, day change %, colored bar width proportional to change
- Visual split: green bars extend right (gainers), red bars extend left (losers)
- Top 3 and bottom 3 highlighted with badges ("Best" / "Worst")
- Data source: Existing `usaSectors` from `/api/markets/full`

### 5. Top & Bottom Movers Table
- Two side-by-side mini-tables: "Top Performers" and "Bottom Performers"
- Show top/bottom 5 from across all USA categories (sectors, thematics, equal weight)
- Columns: Name, Ticker, Day Change %
- Clickable rows navigate to the stock analysis page
- Data source: Derived from existing `/api/markets/full` data (no new endpoint needed)

### 6. Market Breadth Snapshot
- 4 stat cards in a row:
  - **Advance/Decline Ratio** — % of sectors/ETFs up vs down
  - **Average Sector Move** — mean 1D% across all USA sectors
  - **Best Sector** — name + change
  - **Worst Sector** — name + change
- Data source: Computed client-side from existing `usaSectors` data

### 7. News Headlines Ticker
- Scrolling/stacked list of 5-8 latest US market news headlines
- Each headline: title, source, time ago, clickable link
- "View All" link to expand or navigate to full news page
- Data source: Existing `/api/news` endpoint (market category) — already fetches from LaserBeam `/api/news/market`

### 8. Market Narrative Summary
- AI-generated market summary paragraph (2-3 sentences)
- "What's driving the market today" context
- Subtle card with Bloomberg-terminal styling
- Data source: Existing `/api/markets/summary` endpoint (already fetches from LaserBeam)

---

## Implementation Steps

### Step 1: Backend — Intraday Chart Data Endpoint
**File:** `server/routes.ts`

Add new endpoint `GET /api/markets/intraday?symbols=SPY,QQQ,DIA`:
- Fetch from FMP `historical-chart/5min/{symbol}` for each symbol
- Transform into `{ symbol, data: [{ time, open, high, low, close, volume }] }`
- Cache for 2 minutes (intraday data is more time-sensitive)
- Fallback: If FMP unavailable, try LaserBeam `/api/stock/quick-summary/{ticker}` which returns chart data

### Step 2: Backend — US Market Status Endpoint
**File:** `server/routes.ts`

Add new endpoint `GET /api/markets/us-status`:
- Compute market status based on current time in `America/New_York`:
  - Pre-market: 4:00 AM - 9:30 AM ET
  - Open: 9:30 AM - 4:00 PM ET (weekdays only)
  - After-hours: 4:00 PM - 8:00 PM ET
  - Closed: otherwise / weekends / holidays
- Return: `{ status, currentTimeET, currentTimeAEST, nextEvent, nextEventTime }`
- No external API call needed — pure time computation
- Cache for 30 seconds

### Step 3: Frontend — AsxUsaMarketsSection Component
**File:** `client/src/pages/markets.tsx` (or extract to `client/src/components/asx-usa-markets.tsx` if > 300 lines)

Build the composite section component containing:
- `UsMarketStatusHeader` — session status + clocks
- `IndexOverviewCards` — 3 index cards with sparklines
- `IntradayChart` — full-width Recharts area chart
- `SectorPerformanceBars` — horizontal bar chart of sectors
- `TopBottomMovers` — two mini-tables
- `MarketBreadthCards` — 4 stat cards
- `NewsHeadlines` — news list
- `MarketNarrativeSummary` — AI summary card

### Step 4: Frontend — Data Hooks
**File:** `client/src/pages/markets.tsx`

Add TanStack Query hooks:
- `useQuery(["/api/markets/intraday"])` — 60s refetch for intraday chart
- `useQuery(["/api/markets/us-status"])` — 30s refetch for market status
- Reuse existing `useQuery(["/api/markets/full"])` — already fetched on this page
- `useQuery(["/api/news"])` — for headlines
- `useQuery(["/api/markets/summary"])` — for AI narrative

### Step 5: Frontend — Intraday Chart Component
Recharts `AreaChart` with:
- `ResponsiveContainer` wrapping
- Green gradient fill when above day open, red when below
- Custom tooltip showing exact time + price + change
- Toggle buttons for SPY/QQQ/DIA selection
- Responsive: stacked on mobile, full-width on desktop

### Step 6: Frontend — Sector Performance Bars
Custom component using Tailwind:
- Sorted horizontal bars
- Width calculated as percentage of max absolute change
- Green/red color coding
- "Best"/"Worst" badges on top/bottom 3
- Uses existing `usaSectors` data

### Step 7: Integration & Styling
- Place the section after `</Tabs>` closing tag in `markets.tsx`
- Add section separator (horizontal rule or spacing)
- Match existing Bloomberg gold terminal aesthetic
- Ensure responsive mobile layout
- Add loading skeletons for all async sections

---

## Data Flow Summary

```
LaserBeam API ──→ /api/markets/full ──→ Index cards, Sectors, Movers, Breadth
LaserBeam API ──→ /api/markets/summary ──→ Market Narrative
LaserBeam API ──→ /api/news/market ──→ News Headlines
FMP API ────────→ /api/markets/intraday ──→ Intraday Chart
Server time ────→ /api/markets/us-status ──→ Session Status Header
```

---

## API Endpoints Summary

| Endpoint | New? | Source | Cache |
|----------|------|--------|-------|
| `/api/markets/full` | Existing | LaserBeam | 5 min |
| `/api/markets/summary` | Existing | LaserBeam | 5 min |
| `/api/news` | Existing | LaserBeam | 24 hr |
| `/api/markets/intraday` | **New** | FMP | 2 min |
| `/api/markets/us-status` | **New** | Server time | 30 sec |

---

## Tech Decisions
- **Recharts** for the intraday chart (already in `package.json`, used in earnings + admin pages)
- **SVG sparklines** for index cards (lightweight, same pattern as `MiniChart` in trade-tracker)
- **No new dependencies needed** — everything builds on existing stack
- **Component co-location** — keep in `markets.tsx` unless it exceeds ~300 lines, then extract to dedicated file
