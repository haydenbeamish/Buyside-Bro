import { db } from "./db";
import { users, usageLogs, newsFeed } from "@shared/schema";
import { eq, desc, sql, and, gte, count } from "drizzle-orm";
import type { User, InsertUsageLog, UsageLog, NewsFeedItem, InsertNewsFeedItem } from "@shared/schema";

const MONTHLY_CREDIT_LIMIT_CENTS = 500; // $5 included in subscription
const KIMI_INPUT_COST_PER_1K = 0.0006; // $0.0006 per 1K input tokens
const KIMI_OUTPUT_COST_PER_1K = 0.0024; // $0.0024 per 1K output tokens

export function calculateCostCents(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * KIMI_INPUT_COST_PER_1K;
  const outputCost = (outputTokens / 1000) * KIMI_OUTPUT_COST_PER_1K;
  const totalCost = inputCost + outputCost;
  return Math.ceil(totalCost * 100);
}

function shouldResetMonthlyCredits(lastResetAt: Date | null): boolean {
  // If never reset, needs initialization
  if (!lastResetAt) return true;
  
  const now = new Date();
  const resetDate = new Date(lastResetAt);
  
  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  const resetMonth = resetDate.getFullYear() * 12 + resetDate.getMonth();
  
  return currentMonth > resetMonth;
}

export async function getUserCredits(userId: string): Promise<{
  monthlyUsedCents: number;
  monthlyLimitCents: number;
  purchasedCreditsCents: number;
  availableCreditsCents: number;
  isOverLimit: boolean;
}> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  
  if (!user) {
    return {
      monthlyUsedCents: 0,
      monthlyLimitCents: MONTHLY_CREDIT_LIMIT_CENTS,
      purchasedCreditsCents: 0,
      availableCreditsCents: MONTHLY_CREDIT_LIMIT_CENTS,
      isOverLimit: false,
    };
  }

  // Check if we need to reset monthly credits
  if (shouldResetMonthlyCredits(user.monthlyCreditsResetAt)) {
    await db.update(users)
      .set({ 
        monthlyCreditsUsedCents: 0,
        monthlyCreditsResetAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
    
    const purchasedCreditsCents = user.creditBalanceCents || 0;
    return {
      monthlyUsedCents: 0,
      monthlyLimitCents: MONTHLY_CREDIT_LIMIT_CENTS,
      purchasedCreditsCents,
      availableCreditsCents: MONTHLY_CREDIT_LIMIT_CENTS + purchasedCreditsCents,
      isOverLimit: false,
    };
  }

  const monthlyUsedCents = user.monthlyCreditsUsedCents || 0;
  const purchasedCreditsCents = user.creditBalanceCents || 0;
  const monthlyRemainingCents = Math.max(0, MONTHLY_CREDIT_LIMIT_CENTS - monthlyUsedCents);
  const availableCreditsCents = monthlyRemainingCents + purchasedCreditsCents;
  
  return {
    monthlyUsedCents,
    monthlyLimitCents: MONTHLY_CREDIT_LIMIT_CENTS,
    purchasedCreditsCents,
    availableCreditsCents,
    isOverLimit: availableCreditsCents <= 0,
  };
}

export async function checkAndDeductCredits(
  userId: string,
  estimatedCostCents: number
): Promise<{ allowed: boolean; message?: string }> {
  // Atomic check-and-deduct: first try deducting from monthly credits
  const monthlyResult = await db.update(users)
    .set({
      monthlyCreditsUsedCents: sql`${users.monthlyCreditsUsedCents} + ${estimatedCostCents}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, userId),
        sql`(${MONTHLY_CREDIT_LIMIT_CENTS} - COALESCE(${users.monthlyCreditsUsedCents}, 0)) >= ${estimatedCostCents}`
      )
    )
    .returning({ id: users.id });

  if (monthlyResult.length > 0) {
    return { allowed: true };
  }

  // Monthly credits insufficient - try splitting between monthly remainder and purchased
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return {
      allowed: false,
      message: "You've used all your Bro credits for this month. Purchase additional credits to continue using Bro features.",
    };
  }

  const monthlyUsed = user.monthlyCreditsUsedCents || 0;
  const monthlyRemaining = Math.max(0, MONTHLY_CREDIT_LIMIT_CENTS - monthlyUsed);
  const purchasedBalance = user.creditBalanceCents || 0;
  const totalAvailable = monthlyRemaining + purchasedBalance;

  if (totalAvailable < estimatedCostCents) {
    return {
      allowed: false,
      message: "You've used all your Bro credits for this month. Purchase additional credits to continue using Bro features.",
    };
  }

  // Atomically deduct from both monthly and purchased using WHERE to prevent over-deduction
  const fromMonthly = monthlyRemaining;
  const fromPurchased = estimatedCostCents - fromMonthly;

  const splitResult = await db.update(users)
    .set({
      monthlyCreditsUsedCents: sql`${users.monthlyCreditsUsedCents} + ${fromMonthly}`,
      creditBalanceCents: sql`GREATEST(0, ${users.creditBalanceCents} - ${fromPurchased})`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, userId),
        sql`COALESCE(${users.creditBalanceCents}, 0) >= ${fromPurchased}`
      )
    )
    .returning({ id: users.id });

  if (splitResult.length === 0) {
    return {
      allowed: false,
      message: "You've used all your Bro credits for this month. Purchase additional credits to continue using Bro features.",
    };
  }

  return { allowed: true };
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

export async function addPurchasedCredits(userId: string, amountCents: number): Promise<void> {
  await db.update(users)
    .set({ 
      creditBalanceCents: sql`${users.creditBalanceCents} + ${amountCents}`,
      updatedAt: new Date()
    })
    .where(eq(users.id, userId));
}

export async function resetMonthlyCredits(userId: string): Promise<void> {
  await db.update(users)
    .set({ 
      monthlyCreditsUsedCents: 0,
      monthlyCreditsResetAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(users.id, userId));
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

export function getBroQueryLimit(user: User | null | undefined): number {
  if (!user) return 1;
  if (user.subscriptionStatus === 'active') return 5;
  return 1;
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

export async function getBroStatus(userId: string, user: User | null | undefined): Promise<{
  dailyUsed: number;
  dailyLimit: number;
  isPro: boolean;
  credits: number;
}> {
  const dailyUsed = await getDailyBroQueryCount(userId);
  const dailyLimit = getBroQueryLimit(user);
  const isPro = user?.subscriptionStatus === 'active';
  const creditInfo = await getUserCredits(userId);
  return { dailyUsed, dailyLimit, isPro, credits: creditInfo.availableCreditsCents };
}

export async function checkBroQueryAllowed(userId: string, user: User | null | undefined): Promise<{
  allowed: boolean;
  message?: string;
  requiresUpgrade?: boolean;
}> {
  const dailyUsed = await getDailyBroQueryCount(userId);
  const dailyLimit = getBroQueryLimit(user);
  if (dailyUsed >= dailyLimit) {
    const isPro = user?.subscriptionStatus === 'active';
    return {
      allowed: false,
      message: isPro
        ? "You've used all 5 Bro queries for today. Come back tomorrow!"
        : "You've used your free Bro query for today. Upgrade to Pro for 5 queries per day.",
      requiresUpgrade: !isPro,
    };
  }
  return { allowed: true };
}
