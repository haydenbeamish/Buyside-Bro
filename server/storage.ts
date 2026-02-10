import { db } from "./db";
import { portfolioHoldings, watchlist, marketCache } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import type { PortfolioHolding, InsertPortfolioHolding, WatchlistItem, InsertWatchlistItem } from "@shared/schema";
import { memcache } from "./memcache";

export interface IStorage {
  getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]>;
  getPortfolioHolding(userId: string, id: number): Promise<PortfolioHolding | undefined>;
  createPortfolioHolding(userId: string, holding: InsertPortfolioHolding): Promise<PortfolioHolding>;
  updatePortfolioHolding(userId: string, id: number, holding: Partial<InsertPortfolioHolding>): Promise<PortfolioHolding | undefined>;
  deletePortfolioHolding(userId: string, id: number): Promise<void>;
  
  getWatchlist(userId: string): Promise<WatchlistItem[]>;
  addToWatchlist(userId: string, item: InsertWatchlistItem): Promise<WatchlistItem>;
  removeFromWatchlist(userId: string, id: number): Promise<void>;
  updateWatchlistNotes(userId: string, id: number, notes: string): Promise<WatchlistItem | undefined>;
  
  getCachedData(key: string): Promise<unknown | null>;
  setCachedData(key: string, data: unknown, expiresInMinutes: number): Promise<void>;
  deleteCachedData(key: string): Promise<void>;
}

class DatabaseStorage implements IStorage {
  async getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]> {
    return db.select().from(portfolioHoldings).where(eq(portfolioHoldings.userId, userId)).orderBy(desc(portfolioHoldings.createdAt));
  }

  async getPortfolioHolding(userId: string, id: number): Promise<PortfolioHolding | undefined> {
    const [holding] = await db.select().from(portfolioHoldings).where(and(eq(portfolioHoldings.id, id), eq(portfolioHoldings.userId, userId)));
    return holding;
  }

  async createPortfolioHolding(userId: string, holding: InsertPortfolioHolding): Promise<PortfolioHolding> {
    const [newHolding] = await db.insert(portfolioHoldings).values({ ...holding, userId }).returning();
    return newHolding;
  }

  async updatePortfolioHolding(userId: string, id: number, holding: Partial<InsertPortfolioHolding>): Promise<PortfolioHolding | undefined> {
    const [updated] = await db.update(portfolioHoldings)
      .set({ ...holding, updatedAt: new Date() })
      .where(and(eq(portfolioHoldings.id, id), eq(portfolioHoldings.userId, userId)))
      .returning();
    return updated;
  }

  async deletePortfolioHolding(userId: string, id: number): Promise<void> {
    await db.delete(portfolioHoldings).where(and(eq(portfolioHoldings.id, id), eq(portfolioHoldings.userId, userId)));
  }

  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    return db.select().from(watchlist).where(eq(watchlist.userId, userId)).orderBy(desc(watchlist.addedAt));
  }

  async addToWatchlist(userId: string, item: InsertWatchlistItem): Promise<WatchlistItem> {
    const [newItem] = await db.insert(watchlist).values({ ...item, userId }).returning();
    return newItem;
  }

  async removeFromWatchlist(userId: string, id: number): Promise<void> {
    await db.delete(watchlist).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
  }

  async updateWatchlistNotes(userId: string, id: number, notes: string): Promise<WatchlistItem | undefined> {
    const [updated] = await db.update(watchlist)
      .set({ notes })
      .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)))
      .returning();
    return updated;
  }

  async getCachedData(key: string): Promise<unknown | null> {
    // L1: check in-memory cache first (no DB round-trip)
    const memHit = memcache.get(key);
    if (memHit !== null) return memHit;

    // L2: fall through to database
    const [cached] = await db.select().from(marketCache).where(eq(marketCache.cacheKey, key));
    if (!cached) return null;
    if (new Date() > cached.expiresAt) {
      await db.delete(marketCache).where(eq(marketCache.cacheKey, key));
      return null;
    }
    // Promote to L1 for subsequent reads
    const remainingMinutes = Math.max(1, (cached.expiresAt.getTime() - Date.now()) / 60_000);
    memcache.set(key, cached.data, remainingMinutes);
    return cached.data;
  }

  async setCachedData(key: string, data: unknown, expiresInMinutes: number): Promise<void> {
    // Write to both L1 and L2
    memcache.set(key, data, expiresInMinutes);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    await db.insert(marketCache)
      .values({ cacheKey: key, data, expiresAt })
      .onConflictDoUpdate({
        target: marketCache.cacheKey,
        set: { data, expiresAt }
      });
  }

  async deleteCachedData(key: string): Promise<void> {
    memcache.delete(key);
    await db.delete(marketCache).where(eq(marketCache.cacheKey, key));
  }
}

export const storage = new DatabaseStorage();
