import type { Express, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { fetchWithTimeout, LASER_BEAM_API, LASER_BEAM_HEADERS } from "./shared";

export function registerNewsRoutes(app: Express) {
  app.get("/api/news", isAuthenticated, async (req: any, res: Response) => {
    try {
      const cached = await storage.getCachedData("news");
      if (cached) {
        return res.json(cached);
      }

      let marketNews: any[] = [];
      let portfolioNews: any[] = [];

      // Fetch market news from Laser Beam Capital API
      try {
        const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/news/market`, { headers: LASER_BEAM_HEADERS }, 5000);
        if (response.ok) {
          const data = await response.json() as any;
          const articles = data.articles || data.news || [];
          marketNews = articles.slice(0, 10).map((r: any) => ({
            title: r.title,
            description: r.summary || r.description || "",
            url: r.url || "#",
            source: r.source || "Market News",
            publishedAt: r.publishedAt || r.date || new Date().toISOString(),
            category: "market",
          }));
        }
      } catch (e) {
        console.error("Market news fetch error:", e);
      }

      // Fetch portfolio news from Laser Beam Capital API
      try {
        const response = await fetchWithTimeout(`${LASER_BEAM_API}/api/news/portfolio`, { headers: LASER_BEAM_HEADERS }, 5000);
        if (response.ok) {
          const data = await response.json() as any;
          const articles = data.articles || data.news || [];
          portfolioNews = articles.slice(0, 10).map((r: any) => ({
            title: r.title,
            description: r.summary || r.description || "",
            url: r.url || "#",
            source: r.source || "Portfolio News",
            publishedAt: r.publishedAt || r.date || new Date().toISOString(),
            category: "general",
          }));
        }
      } catch (e) {
        console.error("Portfolio news fetch error:", e);
      }

      if (marketNews.length === 0) {
        marketNews = [
          { title: "Markets rally on tech earnings beat", description: "Major indices pushed higher as tech giants reported strong quarterly results.", url: "#", source: "Financial Times", publishedAt: new Date().toISOString(), category: "market" },
          { title: "Fed signals patience on rate cuts", description: "Central bank officials suggest they're in no rush to lower interest rates.", url: "#", source: "Reuters", publishedAt: new Date(Date.now() - 3600000).toISOString(), category: "market" },
        ];
      }

      if (portfolioNews.length === 0) {
        portfolioNews = [
          { title: "AI adoption accelerates across industries", description: "Companies are rapidly integrating artificial intelligence into their operations.", url: "#", source: "TechCrunch", publishedAt: new Date().toISOString(), category: "general" },
        ];
      }

      const newsData = { market: marketNews, general: portfolioNews };
      await storage.setCachedData("news", newsData, 1440);
      res.json(newsData);
    } catch (error) {
      console.error("News error:", error);
      res.json({
        market: [{ title: "Market update coming soon", description: "Check back for the latest market news.", url: "#", source: "Buy Side Bro", publishedAt: new Date().toISOString(), category: "market" }],
        general: [{ title: "Business news loading", description: "General business news will appear here.", url: "#", source: "Buy Side Bro", publishedAt: new Date().toISOString(), category: "general" }],
      });
    }
  });

  app.get("/api/news/search", isAuthenticated, async (req: any, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const braveUrl = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(query + " stock finance")}&count=10`;
      const response = await fetchWithTimeout(braveUrl, {
        headers: {
          "Accept": "application/json",
          "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY || "",
        },
      }, 10000);

      if (!response.ok) throw new Error("Search failed");

      const data = await response.json() as any;
      const results = (data.results || []).map((r: any) => ({
        title: r.title,
        description: r.description,
        url: r.url,
        source: r.meta_url?.hostname || "News",
        publishedAt: r.age || new Date().toISOString(),
      }));

      res.json(results);
    } catch (error) {
      console.error("News search error:", error);
      res.json([]);
    }
  });
}
