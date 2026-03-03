import type { Express, Request, Response } from "express";
import { fetchWithTimeout, LASER_BEAM_API, LASER_BEAM_HEADERS } from "./shared";

export function registerMiscRoutes(app: Express) {
  const SITE_URL = "https://www.buysidebro.com";

  app.get("/robots.txt", (_req: Request, res: Response) => {
    res.type("text/plain").send(
      `User-agent: *\nAllow: /\nAllow: /dashboard\nAllow: /portfolio\nAllow: /watchlist\nAllow: /analysis\nAllow: /earnings\nAllow: /whats-up\nAllow: /chat\nAllow: /preview\nDisallow: /api/\nDisallow: /admin\nDisallow: /subscription\n\nSitemap: ${SITE_URL}/sitemap.xml`
    );
  });

  app.get("/sitemap.xml", (_req: Request, res: Response) => {
    const pages = [
      { loc: "/", priority: "1.0", changefreq: "daily" },
      { loc: "/dashboard", priority: "0.9", changefreq: "hourly" },
      { loc: "/watchlist", priority: "0.8", changefreq: "daily" },
      { loc: "/portfolio", priority: "0.8", changefreq: "daily" },
      { loc: "/analysis", priority: "0.8", changefreq: "daily" },
      { loc: "/earnings", priority: "0.7", changefreq: "daily" },
      { loc: "/whats-up", priority: "0.7", changefreq: "hourly" },
      { loc: "/chat", priority: "0.6", changefreq: "monthly" },
      { loc: "/preview", priority: "0.5", changefreq: "weekly" },
    ];
    const urls = pages
      .map(
        (p) =>
          `  <url>\n    <loc>${SITE_URL}${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
      )
      .join("\n");
    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
    );
  });

  app.get("/api/stocks/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 1) {
        return res.json([]);
      }

      const fmpKey = process.env.FMP_API_KEY;
      const searchFetches: Promise<globalThis.Response>[] = [
        fetchWithTimeout(`${LASER_BEAM_API}/api/ticker-search?q=${encodeURIComponent(query)}`, { headers: LASER_BEAM_HEADERS }, 5000),
      ];

      const shouldSearchASX = !query.includes('.') && query.length >= 1;
      if (shouldSearchASX) {
        searchFetches.push(
          fetchWithTimeout(`${LASER_BEAM_API}/api/ticker-search?q=${encodeURIComponent(query + '.AX')}`, { headers: LASER_BEAM_HEADERS }, 5000),
        );
      }

      const fmpStartIndex = searchFetches.length;
      if (fmpKey) {
        searchFetches.push(
          fetchWithTimeout(`https://financialmodelingprep.com/stable/search-name?query=${encodeURIComponent(query)}&limit=15&apikey=${fmpKey}`, {}, 5000),
          fetchWithTimeout(`https://financialmodelingprep.com/stable/search-ticker?query=${encodeURIComponent(query)}&limit=15&apikey=${fmpKey}`, {}, 5000),
        );
      }

      const responses = await Promise.allSettled(searchFetches);
      const seen = new Set<string>();
      const results: any[] = [];

      for (let i = 0; i < responses.length; i++) {
        const resp = responses[i];
        if (resp.status === 'fulfilled' && resp.value.ok) {
          const data = await resp.value.json() as any;
          const isFmp = i >= fmpStartIndex;

          if (isFmp && Array.isArray(data)) {
            for (const item of data) {
              const sym = item.symbol;
              if (sym && !seen.has(sym)) {
                seen.add(sym);
                results.push({
                  symbol: sym,
                  name: item.name,
                  exchange: item.exchange || '',
                  type: 'stock',
                });
              }
            }
          } else if (!isFmp) {
            for (const item of (data.results || [])) {
              const sym = item.ticker;
              if (sym && !seen.has(sym)) {
                seen.add(sym);
                results.push({
                  symbol: sym,
                  name: item.name,
                  exchange: item.exchange,
                  type: item.type,
                });
              }
            }
          }
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Stock search error:", error);
      res.json([]);
    }
  });
}
