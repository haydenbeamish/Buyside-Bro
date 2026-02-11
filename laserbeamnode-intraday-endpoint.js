// ═══════════════════════════════════════════════════════════════════════
// LASERBEAMNODE — New Endpoint: /api/markets/intraday
// ═══════════════════════════════════════════════════════════════════════
//
// Copy this entire block into your laserbeamnode routes file.
// It follows the same patterns as your existing /api/markets endpoint.
//
// Prerequisites:
//   - FMP_API_KEY environment variable set (Financial Modeling Prep)
//   - Your existing auth middleware (X-API-Key header validation)
//   - Your existing cache helper (or use the simple in-memory cache below)
//
// ═══════════════════════════════════════════════════════════════════════


// ─── Simple in-memory cache (skip if you already have a cache layer) ──

const intradayCache = new Map();
const INTRADAY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getCachedIntraday(key) {
  const entry = intradayCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > INTRADAY_CACHE_TTL) {
    intradayCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedIntraday(key, data) {
  intradayCache.set(key, { data, timestamp: Date.now() });
}


// ─── Route handler ────────────────────────────────────────────────────

// GET /api/markets/intraday?symbols=SPY,QQQ,DIA
//
// Returns 5-minute intraday bars for up to 5 symbols.
// Used by Buyside-Bro's "US Markets" section for intraday charts + sparklines.
//
// Response format:
// {
//   "symbols": {
//     "SPY": [
//       { "time": "2026-02-11 09:30:00", "open": 605.12, "high": 605.50, "low": 604.90, "close": 605.30, "volume": 1234567 },
//       { "time": "2026-02-11 09:35:00", ... },
//       ...
//     ],
//     "QQQ": [...],
//     "DIA": [...]
//   },
//   "fetchedAt": "2026-02-11T14:35:00.000Z"
// }

app.get("/api/markets/intraday", authenticateApiKey, async (req, res) => {
  try {
    const symbolsParam = (req.query.symbols || "SPY,QQQ,DIA").toString();
    const symbols = symbolsParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z]{1,10}$/.test(s))
      .slice(0, 5);

    if (symbols.length === 0) {
      return res.status(400).json({ error: "No valid symbols provided" });
    }

    // Check cache
    const cacheKey = `intraday_${symbols.join("_")}`;
    const cached = getCachedIntraday(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const fmpKey = process.env.FMP_API_KEY;
    if (!fmpKey) {
      return res
        .status(503)
        .json({ error: "Intraday data source not configured" });
    }

    const results = {};

    // Fetch all symbols in parallel
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const url = `https://financialmodelingprep.com/api/v3/historical-chart/5min/${encodeURIComponent(symbol)}?apikey=${fmpKey}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);

          if (!response.ok) {
            console.error(
              `FMP intraday ${symbol}: ${response.status} ${response.statusText}`
            );
            results[symbol] = [];
            return;
          }

          const raw = await response.json();

          if (!Array.isArray(raw) || raw.length === 0) {
            results[symbol] = [];
            return;
          }

          // FMP returns newest-first — reverse to chronological order
          const reversed = raw.reverse();

          // Filter to today's trading date only
          // Use the most recent entry's date as "today" (handles timezone edge cases)
          const latestDate = reversed[reversed.length - 1]?.date?.split(" ")[0];
          const todayData = latestDate
            ? reversed.filter((d) => d.date && d.date.startsWith(latestDate))
            : reversed.slice(-78); // fallback: ~78 bars = full 6.5hr session at 5min

          results[symbol] = todayData.map((d) => ({
            time: d.date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume,
          }));
        } catch (err) {
          if (err.name === "AbortError") {
            console.error(`FMP intraday ${symbol}: request timed out`);
          } else {
            console.error(`FMP intraday ${symbol}: ${err.message}`);
          }
          results[symbol] = [];
        }
      })
    );

    const responseData = {
      symbols: results,
      fetchedAt: new Date().toISOString(),
    };

    // Cache the result
    setCachedIntraday(cacheKey, responseData);

    res.json(responseData);
  } catch (error) {
    console.error("Intraday endpoint error:", error);
    res.status(500).json({ error: "Failed to fetch intraday data" });
  }
});


// ═══════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE REFERENCE
// ═══════════════════════════════════════════════════════════════════════
//
// If you don't already have authenticateApiKey, here's the standard pattern:
//
// function authenticateApiKey(req, res, next) {
//   const apiKey = req.headers["x-api-key"];
//   if (!apiKey || apiKey !== process.env.API_KEY) {
//     return res.status(401).json({ error: "Unauthorized" });
//   }
//   next();
// }
//
// ═══════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════
// TESTING
// ═══════════════════════════════════════════════════════════════════════
//
// Once deployed, test with:
//
//   curl -H "X-API-Key: YOUR_KEY" \
//     "https://api.laserbeamcapital.com/api/markets/intraday?symbols=SPY,QQQ,DIA"
//
// Expected: JSON with symbols.SPY[], symbols.QQQ[], symbols.DIA[] arrays
// Each entry: { time, open, high, low, close, volume }
// Entries sorted chronologically (oldest first)
// Only contains today's trading session data
//
// ═══════════════════════════════════════════════════════════════════════
