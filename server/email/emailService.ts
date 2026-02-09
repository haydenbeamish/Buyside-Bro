import { getResendClient } from "./resendClient";
import { marketWrapEmail, welcomeEmail } from "./templates";
import { db } from "../db";
import { notificationPreferences, notificationLog, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function sendMarketWrapEmails(
  market: string,
  summaryContent: string,
  summaryId: string
): Promise<{ sent: number; failed: number; skipped: number }> {
  const today = getTodayDate();
  const referenceId = `email_summary_${market.toLowerCase()}_${summaryId}`;

  const marketColumn =
    market === "USA"
      ? notificationPreferences.emailUsaMarketSummary
      : market === "ASX"
        ? notificationPreferences.emailAsxMarketSummary
        : notificationPreferences.emailEuropeMarketSummary;

  const subscribers = await db
    .select({
      userId: notificationPreferences.userId,
      email: users.email,
      firstName: users.firstName,
    })
    .from(notificationPreferences)
    .innerJoin(users, eq(notificationPreferences.userId, users.id))
    .where(and(eq(marketColumn, true), eq(users.subscriptionStatus, "active")));

  if (subscribers.length === 0) {
    console.log(`[Email] No subscribers for ${market} market wrap`);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const { subject, html } = marketWrapEmail({
    market,
    summaryContent,
    date: getFormattedDate(),
  });

  let resendClient: Awaited<ReturnType<typeof getResendClient>> | null = null;
  try {
    resendClient = await getResendClient();
  } catch (error) {
    console.error("[Email] Failed to get Resend client:", error);
    return { sent: 0, failed: subscribers.length, skipped: 0 };
  }

  for (const sub of subscribers) {
    if (!sub.email) {
      skipped++;
      continue;
    }

    const alreadySent = await hasEmailBeenSent(sub.userId, referenceId, today);
    if (alreadySent) {
      skipped++;
      continue;
    }

    try {
      await resendClient.client.emails.send({
        from: resendClient.fromEmail,
        to: sub.email,
        subject,
        html,
      });
      await logEmailSent(sub.userId, referenceId, today);
      sent++;
    } catch (error) {
      console.error(`[Email] Failed to send market wrap to ${sub.email}:`, error);
      failed++;
    }
  }

  console.log(`[Email] Market wrap ${market}: sent=${sent}, failed=${failed}, skipped=${skipped}`);
  return { sent, failed, skipped };
}

export async function sendWelcomeEmail(
  userId: string,
  email: string,
  firstName?: string
): Promise<boolean> {
  const referenceId = "welcome";
  const today = getTodayDate();

  const alreadySent = await hasEmailBeenSent(userId, referenceId, today);
  if (alreadySent) {
    return false;
  }

  try {
    const { client, fromEmail } = await getResendClient();
    const { subject, html } = welcomeEmail({ firstName: firstName || undefined });

    await client.emails.send({
      from: fromEmail,
      to: email,
      subject,
      html,
    });

    await logEmailSent(userId, referenceId, today);
    console.log(`[Email] Welcome email sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send welcome email to ${email}:`, error);
    return false;
  }
}

async function hasEmailBeenSent(userId: string, referenceId: string, sentDate: string): Promise<boolean> {
  const [result] = await db
    .select({ id: notificationLog.id })
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.userId, userId),
        eq(notificationLog.notificationType, "email"),
        eq(notificationLog.referenceId, referenceId),
        eq(notificationLog.sentDate, sentDate)
      )
    );
  return !!result;
}

async function logEmailSent(userId: string, referenceId: string, sentDate: string): Promise<void> {
  await db
    .insert(notificationLog)
    .values({ userId, notificationType: "email", referenceId, sentDate })
    .onConflictDoNothing();
}
