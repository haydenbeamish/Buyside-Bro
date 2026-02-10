import { pushStorage } from "./storage";
import { sendBulkNotifications, type PushPayload } from "./apnsService";
import type { DeviceToken, NotificationPreference } from "@shared/schema";
import type { WatchlistTarget, SummarySubscriber } from "./storage";

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export async function registerDevice(userId: string, token: string, platform: string): Promise<DeviceToken> {
  return pushStorage.upsertDeviceToken(userId, token, platform);
}

export async function unregisterDevice(token: string): Promise<void> {
  return pushStorage.removeDeviceToken(token);
}

export async function getPreferences(userId: string): Promise<NotificationPreference | DefaultPreferences> {
  const prefs = await pushStorage.getPreferences(userId);
  if (prefs) return prefs;
  return {
    watchlistPriceAlerts: true,
    priceAlertThreshold: "0.05",
    usaMarketSummary: true,
    asxMarketSummary: true,
    europeMarketSummary: true,
    asiaMarketSummary: true,
    emailUsaMarketSummary: false,
    emailAsxMarketSummary: false,
    emailEuropeMarketSummary: false,
    emailAsiaMarketSummary: false,
  };
}

interface DefaultPreferences {
  watchlistPriceAlerts: boolean;
  priceAlertThreshold: string;
  usaMarketSummary: boolean;
  asxMarketSummary: boolean;
  europeMarketSummary: boolean;
  asiaMarketSummary: boolean;
  emailUsaMarketSummary: boolean;
  emailAsxMarketSummary: boolean;
  emailEuropeMarketSummary: boolean;
  emailAsiaMarketSummary: boolean;
}

export async function updatePreferences(userId: string, prefs: Partial<NotificationPreference>): Promise<NotificationPreference> {
  return pushStorage.upsertPreferences(userId, prefs);
}

export async function getWatchlistTargets(): Promise<WatchlistTarget[]> {
  return pushStorage.getWatchlistTargets();
}

export async function sendPriceAlert(
  symbol: string,
  price: number,
  prevClose: number,
  changePct: number,
  direction: "up" | "down",
  userIds: string[],
): Promise<{ sent: number; failed: number; skipped: number }> {
  const today = getTodayDate();
  const referenceId = `${symbol}_${direction}`;
  let skipped = 0;
  const eligibleUserIds: string[] = [];

  for (const userId of userIds) {
    const alreadySent = await pushStorage.hasNotificationBeenSent(userId, "price_alert", referenceId, today);
    if (alreadySent) {
      skipped++;
    } else {
      eligibleUserIds.push(userId);
    }
  }

  if (eligibleUserIds.length === 0) {
    return { sent: 0, failed: 0, skipped };
  }

  const tokens = await pushStorage.getDeviceTokensByUserIds(eligibleUserIds);
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, skipped };
  }

  const emoji = direction === "up" ? "📈" : "📉";
  const sign = direction === "up" ? "+" : "";
  const payload: PushPayload = {
    title: `${emoji} ${symbol} ${sign}${changePct.toFixed(1)}%`,
    body: `${symbol} is ${direction === "up" ? "up" : "down"} ${Math.abs(changePct).toFixed(1)}% to $${price.toFixed(2)} (prev close: $${prevClose.toFixed(2)})`,
    data: { type: "price_alert", symbol, direction },
  };

  const tokenStrings = tokens.map((t) => t.deviceToken);
  const result = await sendBulkNotifications(tokenStrings, payload);

  // Log sent notifications per user for dedup
  const userIdsWithTokens = Array.from(new Set(tokens.map((t) => t.userId)));
  for (const userId of userIdsWithTokens) {
    await pushStorage.logNotificationSent(userId, "price_alert", referenceId, today);
  }

  console.log(`[Push] Price alert for ${symbol}: sent=${result.sent}, failed=${result.failed}, skipped=${skipped}`);
  return { ...result, skipped };
}

export async function sendMarketSummaryNotification(
  summaryType: string,
  summaryId: string,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const today = getTodayDate();
  const referenceId = `summary_${summaryType}_${summaryId}`;

  const subscribers = await pushStorage.getSummarySubscribers(summaryType);
  if (subscribers.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  let skipped = 0;
  const eligibleTokens: string[] = [];
  const eligibleUserIds: string[] = [];

  for (const sub of subscribers) {
    const alreadySent = await pushStorage.hasNotificationBeenSent(sub.userId, "market_summary", referenceId, today);
    if (alreadySent) {
      skipped++;
    } else {
      eligibleTokens.push(sub.deviceToken);
      eligibleUserIds.push(sub.userId);
    }
  }

  if (eligibleTokens.length === 0) {
    return { sent: 0, failed: 0, skipped };
  }

  const marketLabels: Record<string, string> = {
    usa: "🇺🇸 US Market",
    asx: "🇦🇺 ASX",
    europe: "🇪🇺 Europe",
    asia: "🌏 Asia",
  };

  const payload: PushPayload = {
    title: `${marketLabels[summaryType] || summaryType} Close Summary`,
    body: "Tap to read today's market wrap-up",
    data: { type: "market_summary", market: summaryType },
  };

  const result = await sendBulkNotifications(eligibleTokens, payload);

  const uniqueUserIds = Array.from(new Set(eligibleUserIds));
  for (const userId of uniqueUserIds) {
    await pushStorage.logNotificationSent(userId, "market_summary", referenceId, today);
  }

  console.log(`[Push] Market summary ${summaryType}: sent=${result.sent}, failed=${result.failed}, skipped=${skipped}`);
  return { ...result, skipped };
}
