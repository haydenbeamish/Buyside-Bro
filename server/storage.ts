import { db } from "./db";
import { portfolioHoldings, watchlist, marketCache } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { PortfolioHolding, InsertPortfolioHolding, WatchlistItem, InsertWatchlistItem } from "@shared/schema";

export interface IStorage {
  getPortfolioHoldings(): Promise<PortfolioHolding[]>;
  getPortfolioHolding(id: number): Promise<PortfolioHolding | undefined>;
  createPortfolioHolding(holding: InsertPortfolioHolding): Promise<PortfolioHolding>;
  updatePortfolioHolding(id: number, holding: Partial<InsertPortfolioHolding>): Promise<PortfolioHolding | undefined>;
  deletePortfolioHolding(id: number): Promise<void>;
  
  getWatchlist(): Promise<WatchlistItem[]>;
  addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem>;
  removeFromWatchlist(id: number): Promise<void>;
  
  getCachedData(key: string): Promise<unknown | null>;
  setCachedData(key: string, data: unknown, expiresInMinutes: number): Promise<void>;
}

class DatabaseStorage implements IStorage {
  async getPortfolioHoldings(): Promise<PortfolioHolding[]> {
    return db.select().from(portfolioHoldings).orderBy(desc(portfolioHoldings.createdAt));
  }

  async getPortfolioHolding(id: number): Promise<PortfolioHolding | undefined> {
    const [holding] = await db.select().from(portfolioHoldings).where(eq(portfolioHoldings.id, id));
    return holding;
  }

  async createPortfolioHolding(holding: InsertPortfolioHolding): Promise<PortfolioHolding> {
    const [newHolding] = await db.insert(portfolioHoldings).values(holding).returning();
    return newHolding;
  }

  async updatePortfolioHolding(id: number, holding: Partial<InsertPortfolioHolding>): Promise<PortfolioHolding | undefined> {
    const [updated] = await db.update(portfolioHoldings)
      .set({ ...holding, updatedAt: new Date() })
      .where(eq(portfolioHoldings.id, id))
      .returning();
    return updated;
  }

  async deletePortfolioHolding(id: number): Promise<void> {
    await db.delete(portfolioHoldings).where(eq(portfolioHoldings.id, id));
  }

  async getWatchlist(): Promise<WatchlistItem[]> {
    return db.select().from(watchlist).orderBy(desc(watchlist.addedAt));
  }

  async addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const [newItem] = await db.insert(watchlist).values(item).returning();
    return newItem;
  }

  async removeFromWatchlist(id: number): Promise<void> {
    await db.delete(watchlist).where(eq(watchlist.id, id));
  }

  async getCachedData(key: string): Promise<unknown | null> {
    const [cached] = await db.select().from(marketCache).where(eq(marketCache.cacheKey, key));
    if (!cached) return null;
    if (new Date() > cached.expiresAt) {
      await db.delete(marketCache).where(eq(marketCache.cacheKey, key));
      return null;
    }
    return cached.data;
  }

  async setCachedData(key: string, data: unknown, expiresInMinutes: number): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    await db.insert(marketCache)
      .values({ cacheKey: key, data, expiresAt })
      .onConflictDoUpdate({
        target: marketCache.cacheKey,
        set: { data, expiresAt }
      });
  }
}

export const storage = new DatabaseStorage();
