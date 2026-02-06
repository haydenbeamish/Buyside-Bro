import { db } from "./db";
import { users, usageLogs, newsFeed } from "@shared/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";
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
  const credits = await getUserCredits(userId);
  
  if (credits.availableCreditsCents < estimatedCostCents) {
    return {
      allowed: false,
      message: "You've used all your AI credits for this month. Purchase additional credits to continue using AI features.",
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
  
  // Single query to get user data and calculate remaining credits
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  
  // Insert usage log (no await needed for this independent operation)
  const logPromise = db.insert(usageLogs).values({
    userId,
    feature,
    model,
    inputTokens,
    outputTokens,
    costCents,
    metadata,
  });

  if (!user) {
    await logPromise;
    return;
  }
  
  // Calculate remaining monthly credits directly from user data
  const monthlyUsed = user.monthlyCreditsUsedCents || 0;
  const monthlyRemaining = Math.max(0, MONTHLY_CREDIT_LIMIT_CENTS - monthlyUsed);
  
  // Determine how to split cost between monthly and purchased credits
  if (monthlyRemaining >= costCents) {
    await Promise.all([
      logPromise,
      db.update(users)
        .set({ 
          monthlyCreditsUsedCents: sql`${users.monthlyCreditsUsedCents} + ${costCents}`,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
    ]);
  } else {
    const fromMonthly = monthlyRemaining;
    const fromPurchased = costCents - fromMonthly;
    
    await Promise.all([
      logPromise,
      db.update(users)
        .set({ 
          monthlyCreditsUsedCents: sql`${users.monthlyCreditsUsedCents} + ${fromMonthly}`,
          creditBalanceCents: sql`GREATEST(0, ${users.creditBalanceCents} - ${fromPurchased})`,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
    ]);
  }
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

    if (allItems.length > 20) {
      const idsToDelete = allItems.slice(20).map(r => r.id);
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
