import { db } from "../db";
import { deviceTokens, notificationPreferences, notificationLog, watchlist } from "@shared/schema";
import type { DeviceToken, NotificationPreference } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export interface IPushStorage {
  // Device tokens
  upsertDeviceToken(userId: string, token: string, platform: string): Promise<DeviceToken>;
  removeDeviceToken(token: string): Promise<void>;
  removeDeviceTokens(tokens: string[]): Promise<void>;
  getDeviceTokensByUserIds(userIds: string[]): Promise<DeviceToken[]>;

  // Notification preferences
  getPreferences(userId: string): Promise<NotificationPreference | null>;
  upsertPreferences(userId: string, prefs: Partial<NotificationPreference>): Promise<NotificationPreference>;

  // Dedup log
  hasNotificationBeenSent(userId: string, notificationType: string, referenceId: string, sentDate: string): Promise<boolean>;
  logNotificationSent(userId: string, notificationType: string, referenceId: string, sentDate: string): Promise<void>;

  // Aggregated queries
  getWatchlistTargets(): Promise<WatchlistTarget[]>;
  getSummarySubscribers(market: string): Promise<SummarySubscriber[]>;
}

export interface WatchlistTarget {
  userId: string;
  ticker: string;
  threshold: string;
  deviceToken: string;
  platform: string;
}

export interface SummarySubscriber {
  userId: string;
  deviceToken: string;
  platform: string;
}

export const pushStorage: IPushStorage = {
  async upsertDeviceToken(userId: string, token: string, platform: string): Promise<DeviceToken> {
    const [result] = await db
      .insert(deviceTokens)
      .values({ userId, deviceToken: token, platform })
      .onConflictDoUpdate({
        target: deviceTokens.deviceToken,
        set: { userId, platform, updatedAt: new Date() },
      })
      .returning();
    return result;
  },

  async removeDeviceToken(token: string): Promise<void> {
    await db.delete(deviceTokens).where(eq(deviceTokens.deviceToken, token));
  },

  async removeDeviceTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await db.delete(deviceTokens).where(inArray(deviceTokens.deviceToken, tokens));
  },

  async getDeviceTokensByUserIds(userIds: string[]): Promise<DeviceToken[]> {
    if (userIds.length === 0) return [];
    return db.select().from(deviceTokens).where(inArray(deviceTokens.userId, userIds));
  },

  async getPreferences(userId: string): Promise<NotificationPreference | null> {
    const [result] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return result || null;
  },

  async upsertPreferences(userId: string, prefs: Partial<NotificationPreference>): Promise<NotificationPreference> {
    const { id: _id, createdAt: _ca, updatedAt: _ua, userId: _uid, ...updateFields } = prefs;
    const [result] = await db
      .insert(notificationPreferences)
      .values({ userId, ...updateFields })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: { ...updateFields, updatedAt: new Date() },
      })
      .returning();
    return result;
  },

  async hasNotificationBeenSent(userId: string, notificationType: string, referenceId: string, sentDate: string): Promise<boolean> {
    const [result] = await db
      .select({ id: notificationLog.id })
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.userId, userId),
          eq(notificationLog.notificationType, notificationType),
          eq(notificationLog.referenceId, referenceId),
          eq(notificationLog.sentDate, sentDate),
        )
      );
    return !!result;
  },

  async logNotificationSent(userId: string, notificationType: string, referenceId: string, sentDate: string): Promise<void> {
    await db
      .insert(notificationLog)
      .values({ userId, notificationType, referenceId, sentDate })
      .onConflictDoNothing();
  },

  async getWatchlistTargets(): Promise<WatchlistTarget[]> {
    const results = await db
      .select({
        userId: watchlist.userId,
        ticker: watchlist.ticker,
        threshold: notificationPreferences.priceAlertThreshold,
        deviceToken: deviceTokens.deviceToken,
        platform: deviceTokens.platform,
      })
      .from(watchlist)
      .innerJoin(deviceTokens, eq(watchlist.userId, deviceTokens.userId))
      .innerJoin(notificationPreferences, eq(watchlist.userId, notificationPreferences.userId))
      .where(eq(notificationPreferences.watchlistPriceAlerts, true));

    return results.map((r) => ({
      ...r,
      threshold: r.threshold ?? "0.05",
    }));
  },

  async getSummarySubscribers(market: string): Promise<SummarySubscriber[]> {
    const marketColumn = market === "usa"
      ? notificationPreferences.usaMarketSummary
      : market === "asx"
        ? notificationPreferences.asxMarketSummary
        : notificationPreferences.europeMarketSummary;

    return db
      .select({
        userId: deviceTokens.userId,
        deviceToken: deviceTokens.deviceToken,
        platform: deviceTokens.platform,
      })
      .from(deviceTokens)
      .innerJoin(notificationPreferences, eq(deviceTokens.userId, notificationPreferences.userId))
      .where(eq(marketColumn, true));
  },
};
