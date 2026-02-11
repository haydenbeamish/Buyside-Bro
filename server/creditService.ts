import { db } from "./db";
import { users, usageLogs, newsFeed } from "@shared/schema";
import { eq, desc, sql, and, gte, count } from "drizzle-orm";
import type { User, InsertUsageLog, UsageLog, NewsFeedItem, InsertNewsFeedItem } from "@shared/schema";

const KIMI_INPUT_COST_PER_1K = 0.0006; // $0.0006 per 1K input tokens
const KIMI_OUTPUT_COST_PER_1K = 0.0024; // $0.0024 per 1K output tokens

export function calculateCostCents(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * KIMI_INPUT_COST_PER_1K;
  const outputCost = (outputTokens / 1000) * KIMI_OUTPUT_COST_PER_1K;
  const totalCost = inputCost + outputCost;
  return Math.ceil(totalCost * 100);
}

export async function recordUsage(
  userId: string,
  feature: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  const costCents = calculateCostCents(inputTokens, outputTokens);

  await db.insert(usageLogs).values({
    userId,
    feature,
    model,
    inputTokens,
    outputTokens,
    costCents,
    metadata,
  });
}

export async function getUserUsageHistory(
  userId: string,
  limit = 50
): Promise<UsageLog[]> {
  return db.select()
    .from(usageLogs)
    .where(eq(usageLogs.userId, userId))
    .orderBy(desc(usageLogs.createdAt))
    .limit(limit);
}

export async function getNewsFeed(limit = 20): Promise<NewsFeedItem[]> {
  return db.select()
    .from(newsFeed)
    .orderBy(desc(newsFeed.publishedAt))
    .limit(limit);
}

export async function addNewsFeedItem(item: InsertNewsFeedItem): Promise<NewsFeedItem> {
  const [newItem] = await db.insert(newsFeed).values(item).returning();

  try {
    const allItems = await db.select({ id: newsFeed.id })
      .from(newsFeed)
      .orderBy(desc(newsFeed.publishedAt), desc(newsFeed.id));

    if (allItems.length > 100) {
      const idsToDelete = allItems.slice(100).map(r => r.id);
      for (const id of idsToDelete) {
        await db.delete(newsFeed).where(eq(newsFeed.id, id));
      }
    }
  } catch (e) {
    console.error("Error pruning old newsfeed items:", e);
  }

  return newItem;
}

export const MARKET_SCHEDULES = {
  ASX: {
    timezone: 'Australia/Sydney',
    openHour: 10, openMinute: 0,
    closeHour: 16, closeMinute: 0,
    updateOffsetMinutes: 20,
  },
  USA: {
    timezone: 'America/New_York',
    openHour: 9, openMinute: 30,
    closeHour: 16, closeMinute: 0,
    updateOffsetMinutes: 20,
  },
  Europe: {
    timezone: 'Europe/London',
    openHour: 8, openMinute: 0,
    closeHour: 16, closeMinute: 30,
    updateOffsetMinutes: 20,
  },
  Asia: {
    timezone: 'Asia/Hong_Kong',
    openHour: 9, openMinute: 30,
    closeHour: 16, closeMinute: 0,
    updateOffsetMinutes: 20,
  },
};

export function getMarketEventTitle(market: string, eventType: string): string {
  const date = new Date();
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const eventLabels: Record<string, string> = {
    open: 'Market Open Update',
    midday: 'Midday Market Pulse',
    close: 'Market Close Wrap',
  };

  return `${market} ${eventLabels[eventType] || 'Update'} - ${dateStr}`;
}

export async function hasNewsFeedItemForMarketToday(market: string, eventType: string): Promise<boolean> {
  const expectedTitle = getMarketEventTitle(market, eventType);
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago

  const existing = await db.select({ id: newsFeed.id })
    .from(newsFeed)
    .where(
      and(
        eq(newsFeed.market, market),
        eq(newsFeed.eventType, eventType),
        eq(newsFeed.title, expectedTitle),
        gte(newsFeed.publishedAt, cutoff)
      )
    )
    .limit(1);

  return existing.length > 0;
}

// --- Daily Bro query tracking ---

const BRO_FEATURES = [
  'chat', 'chat_conversation', 'stock_analysis',
  'portfolio_analysis', 'portfolio_review',
  'earnings_analysis', 'deep_analysis',
];

const ADMIN_BRO_EMAILS = ['hbeamish1@gmail.com'];

export function isAdminUser(user: User | null | undefined): boolean {
  return ADMIN_BRO_EMAILS.includes(user?.email?.toLowerCase() ?? '');
}

export function isProTier(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return (user as any).subscriptionTier === 'pro';
}

export function isStarterOrAbove(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  const tier = (user as any).subscriptionTier;
  return tier === 'starter' || tier === 'pro';
}

export function getSubscriptionTier(user: User | null | undefined): string {
  if (!user) return 'free';
  if (isAdminUser(user)) return 'pro';
  return (user as any).subscriptionTier || 'free';
}

export function getBroQueryLimit(user: User | null | undefined): number {
  if (!user) return 1;
  if (isAdminUser(user)) return 999;
  const tier = getSubscriptionTier(user);
  if (tier === 'pro') return 50; // monthly
  if (tier === 'starter') return 5; // daily
  return 1; // daily
}

export async function getDailyBroQueryCount(userId: string): Promise<number> {
  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const result = await db
    .select({ count: count() })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.userId, userId),
        gte(usageLogs.createdAt, todayMidnight),
        sql`${usageLogs.feature} IN ('chat','chat_conversation','stock_analysis','portfolio_analysis','portfolio_review','earnings_analysis','deep_analysis')`
      )
    );
  return result[0]?.count ?? 0;
}

export async function getMonthlyBroQueryCount(userId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = await db
    .select({ count: count() })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.userId, userId),
        gte(usageLogs.createdAt, monthStart),
        sql`${usageLogs.feature} IN ('chat','chat_conversation','stock_analysis','portfolio_analysis','portfolio_review','earnings_analysis','deep_analysis')`
      )
    );
  return result[0]?.count ?? 0;
}

export async function getBroStatus(userId: string, user: User | null | undefined): Promise<{
  dailyUsed: number;
  dailyLimit: number;
  isPro: boolean;
  tier: string;
  monthlyUsed?: number;
  monthlyLimit?: number;
}> {
  const tier = getSubscriptionTier(user);
  const dailyUsed = await getDailyBroQueryCount(userId);
  const dailyLimit = tier === 'pro' ? 50 : getBroQueryLimit(user);
  const isPro = tier === 'pro' || isAdminUser(user);

  if (tier === 'pro') {
    const monthlyUsed = await getMonthlyBroQueryCount(userId);
    return { dailyUsed, dailyLimit, isPro, tier, monthlyUsed, monthlyLimit: 50 };
  }

  return { dailyUsed, dailyLimit, isPro, tier };
}

export async function checkBroQueryAllowed(userId: string, user: User | null | undefined): Promise<{
  allowed: boolean;
  message?: string;
  requiresUpgrade?: boolean;
}> {
  const tier = getSubscriptionTier(user);

  if (tier === 'pro') {
    // Pro: 50 queries per month
    const monthlyUsed = await getMonthlyBroQueryCount(userId);
    if (monthlyUsed >= 50 && !isAdminUser(user)) {
      return {
        allowed: false,
        message: "You've used all 50 Bro queries for this month. Your limit resets on the 1st.",
        requiresUpgrade: false,
      };
    }
    return { allowed: true };
  }

  // Free & Starter: daily limits
  const dailyUsed = await getDailyBroQueryCount(userId);
  const dailyLimit = getBroQueryLimit(user);
  if (dailyUsed >= dailyLimit) {
    if (tier === 'starter') {
      return {
        allowed: false,
        message: `You've used all ${dailyLimit} Bro queries for today. Upgrade to Pro for 50 queries per month, or come back tomorrow.`,
        requiresUpgrade: false,
      };
    }
    return {
      allowed: false,
      message: "You've used your free Bro query for today. Upgrade to Starter for 5 queries per day or Pro for 50 per month.",
      requiresUpgrade: true,
    };
  }
  return { allowed: true };
}
