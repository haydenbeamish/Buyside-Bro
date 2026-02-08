import apn from "@parse/node-apn";
import { pushStorage } from "./storage";

let provider: apn.Provider | null = null;

function getProvider(): apn.Provider | null {
  if (provider) return provider;

  const key = process.env.APNS_KEY;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!key || !keyId || !teamId) {
    console.warn("[APNs] Missing APNS_KEY, APNS_KEY_ID, or APPLE_TEAM_ID — push notifications disabled");
    return null;
  }

  provider = new apn.Provider({
    token: {
      key: key,
      keyId,
      teamId,
    },
    production: true,
  });

  return provider;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: string;
}

export async function sendNotification(token: string, payload: PushPayload): Promise<boolean> {
  const apnProvider = getProvider();
  if (!apnProvider) return false;

  const notification = new apn.Notification();
  notification.alert = { title: payload.title, body: payload.body };
  notification.sound = payload.sound || "default";
  notification.topic = "com.buysidebro.app";
  if (payload.data) {
    notification.payload = payload.data;
  }

  try {
    const result = await apnProvider.send(notification, token);
    if (result.failed.length > 0) {
      const failure = result.failed[0];
      if (failure.status === 410 || failure.response?.reason === "Unregistered" || failure.response?.reason === "BadDeviceToken") {
        await pushStorage.removeDeviceToken(token);
        console.log(`[APNs] Removed invalid token: ${token.substring(0, 8)}...`);
      } else {
        console.error(`[APNs] Send failed:`, failure.response?.reason || failure.status);
      }
      return false;
    }
    return true;
  } catch (error) {
    console.error("[APNs] Send error:", error);
    return false;
  }
}

export async function sendBulkNotifications(tokens: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const apnProvider = getProvider();
  if (!apnProvider || tokens.length === 0) return { sent: 0, failed: 0 };

  const notification = new apn.Notification();
  notification.alert = { title: payload.title, body: payload.body };
  notification.sound = payload.sound || "default";
  notification.topic = "com.buysidebro.app";
  if (payload.data) {
    notification.payload = payload.data;
  }

  try {
    const result = await apnProvider.send(notification, tokens);
    const invalidTokens: string[] = [];

    for (const failure of result.failed) {
      if (failure.status === 410 || failure.response?.reason === "Unregistered" || failure.response?.reason === "BadDeviceToken") {
        if (failure.device) invalidTokens.push(failure.device);
      }
    }

    if (invalidTokens.length > 0) {
      await pushStorage.removeDeviceTokens(invalidTokens);
      console.log(`[APNs] Removed ${invalidTokens.length} invalid tokens`);
    }

    return {
      sent: result.sent?.length || 0,
      failed: result.failed.length,
    };
  } catch (error) {
    console.error("[APNs] Bulk send error:", error);
    return { sent: 0, failed: tokens.length };
  }
}

export function shutdownApns(): void {
  if (provider) {
    provider.shutdown();
    provider = null;
    console.log("[APNs] Provider shut down");
  }
}
