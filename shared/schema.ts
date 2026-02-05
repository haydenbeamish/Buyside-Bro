import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, decimal, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models (users, sessions)
export * from "./models/auth";

export const portfolioHoldings = pgTable("portfolio_holdings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  ticker: text("ticker").notNull(),
  shares: decimal("shares", { precision: 18, scale: 8 }).notNull(),
  avgCost: decimal("avg_cost", { precision: 18, scale: 4 }).notNull(),
  currentPrice: decimal("current_price", { precision: 18, scale: 4 }),
  sector: text("sector"),
  name: text("name"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type InsertPortfolioHolding = z.infer<typeof insertPortfolioHoldingSchema>;

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().unique(),
  name: text("name"),
  addedAt: timestamp("added_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  addedAt: true,
});

export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export const marketCache = pgTable("market_cache", {
  id: serial("id").primaryKey(),
  cacheKey: text("cache_key").notNull().unique(),
  data: jsonb("data").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type MarketCache = typeof marketCache.$inferSelect;

// Usage tracking for OpenRouter API calls
export const usageLogs = pgTable("usage_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  feature: text("feature").notNull(), // 'chat', 'analysis', 'deep_analysis'
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  costCents: integer("cost_cents").default(0).notNull(), // Cost in cents
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userIdIdx: index("usage_logs_user_id_idx").on(table.userId),
  createdAtIdx: index("usage_logs_created_at_idx").on(table.createdAt),
}));

export const insertUsageLogSchema = createInsertSchema(usageLogs).omit({
  id: true,
  createdAt: true,
});

export type UsageLog = typeof usageLogs.$inferSelect;
export type InsertUsageLog = z.infer<typeof insertUsageLogSchema>;

// News feed for market summaries and updates
export const newsFeed = pgTable("news_feed", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  market: text("market").notNull(), // 'ASX', 'USA', 'Europe', 'Email'
  eventType: text("event_type").notNull(), // 'open', 'midday', 'close', 'email'
  publishedAt: timestamp("published_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  source: text("source").default("system"), // 'system', 'email', 'manual'
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  publishedAtIdx: index("news_feed_published_at_idx").on(table.publishedAt),
}));

export const insertNewsFeedSchema = createInsertSchema(newsFeed).omit({
  id: true,
  createdAt: true,
});

export type NewsFeedItem = typeof newsFeed.$inferSelect;
export type InsertNewsFeedItem = z.infer<typeof insertNewsFeedSchema>;

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  action: text("action").notNull(),
  path: text("path").notNull(),
  method: text("method").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userIdIdx: index("activity_logs_user_id_idx").on(table.userId),
  createdAtIdx: index("activity_logs_created_at_idx").on(table.createdAt),
  actionIdx: index("activity_logs_action_idx").on(table.action),
}));

export type ActivityLog = typeof activityLogs.$inferSelect;
