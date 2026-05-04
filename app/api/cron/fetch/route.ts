import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/admin";
import { fetchArticlesForUser } from "@/lib/article-fetch";
import { DAILY_PICK_COUNT } from "@/lib/content-limits";
import { selectDailyPicks } from "@/lib/picks";
import type { Article } from "@/lib/types";

interface ProfileRow {
  id: string;
  email: string;
  topics: string[] | null;
}

interface DailyPickArticle {
  title: string;
  url: string;
  source: string | null;
  summary: string | null;
}

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    return request.headers.get("authorization") === `Bearer ${secret}`;
  }

  return request.headers.get("x-vercel-cron") === "1";
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails("mailto:noreply@myrundown.xyz", publicKey, privateKey);
  return true;
}

function isEmailEnabled() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function escapeHtml(value: string | null | undefined) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function getDailyPickArticles(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  today: string
) {
  const { data, error } = await adminClient
    .from("daily_picks")
    .select(`
      articles (
        title,
        url,
        source,
        summary
      )
    `)
    .eq("user_id", userId)
    .eq("pick_date", today);

  if (error) {
    throw error;
  }

  return (data || [])
    .map((pick) => pick.articles)
    .filter(Boolean) as unknown as DailyPickArticle[];
}

function buildDailyEmailHtml(articles: DailyPickArticle[]) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://myrundown.xyz";

  return `
    <div style="font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #080808; color: #f4f4f4;">
      <h1 style="margin: 0 0 8px; font-size: 28px; line-height: 1.15;">Your Rundown</h1>
      <p style="margin: 0 0 24px; color: #a3a3a3;">Today&apos;s ${articles.length} curated read${articles.length === 1 ? "" : "s"} ${articles.length === 1 ? "is" : "are"} ready.</p>
      ${articles
        .map(
          (article) => `
            <div style="padding: 18px 0; border-top: 1px solid #2a2a2a;">
              <h2 style="margin: 0 0 8px; font-size: 18px; line-height: 1.35;">
                <a href="${escapeHtml(article.url)}" style="color: #f4f4f4; text-decoration: none;">${escapeHtml(article.title)}</a>
              </h2>
              <p style="margin: 0 0 10px; color: #8a8a8a; font-size: 13px;">${escapeHtml(article.source)}</p>
              <p style="margin: 0; color: #c7c7c7; font-size: 14px; line-height: 1.55;">${escapeHtml(article.summary)}</p>
            </div>`
        )
        .join("")}
      <div style="padding-top: 24px; border-top: 1px solid #2a2a2a;">
        <a href="${escapeHtml(appUrl)}/reads" style="display: inline-block; padding: 11px 16px; background: #f4f4f4; color: #080808; border-radius: 8px; font-weight: 600; text-decoration: none;">Open My Rundown</a>
      </div>
    </div>
  `;
}

async function sendEmailForUser(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  email: string,
  today: string
) {
  if (!isEmailEnabled()) {
    return { sent: false, skipped: true };
  }

  const articles = await getDailyPickArticles(adminClient, userId, today);

  if (!articles.length) {
    return { sent: false, skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "My Rundown <noreply@myrundown.xyz>",
      to: email,
      subject: "Your Rundown is ready",
      html: buildDailyEmailHtml(articles),
    }),
  });

  if (!response.ok) {
    return {
      sent: false,
      skipped: false,
      error: await response.text(),
    };
  }

  return { sent: true, skipped: false };
}

async function ensureDailyPicks(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  pickCount: number,
  today: string
) {
  const { data: existingPicks, error: existingError } = await adminClient
    .from("daily_picks")
    .select("article_id")
    .eq("user_id", userId)
    .eq("pick_date", today);

  if (existingError) {
    throw existingError;
  }

  if (existingPicks?.length) {
    return existingPicks.map((pick) => pick.article_id);
  }

  const { data: unreadArticles, error: unreadError } = await adminClient
    .from("articles")
    .select("*")
    .eq("user_id", userId)
    .eq("read", false)
    .order("score", { ascending: false });

  if (unreadError) {
    throw unreadError;
  }

  const picks = selectDailyPicks(
    (unreadArticles || []) as Article[],
    pickCount,
    today
  );
  const articleIds = picks.map((article) => article.id);

  if (articleIds.length) {
    const { error: insertError } = await adminClient.from("daily_picks").upsert(
      articleIds.map((articleId) => ({
        user_id: userId,
        article_id: articleId,
        pick_date: today,
      })),
      {
        onConflict: "user_id,article_id,pick_date",
      }
    );

    if (insertError) {
      throw insertError;
    }
  }

  return articleIds;
}

async function sendPushForUser(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  pickCount: number
) {
  const { data: subscriptions, error } = await adminClient
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  if (!subscriptions?.length) {
    return { sent: 0, removed: 0 };
  }

  const payload = JSON.stringify({
    title: "Rundown",
    body:
      pickCount === 1
        ? "Your daily read is ready."
        : `Your ${pickCount} daily reads are ready.`,
    url: "/reads",
  });

  let sent = 0;
  const invalidEndpoints: string[] = [];

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload
      );
      sent += 1;
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number(error.statusCode)
          : undefined;

      if (statusCode === 404 || statusCode === 410) {
        invalidEndpoints.push(subscription.endpoint);
      } else {
        console.error(`Push send failed for user ${userId}:`, error);
      }
    }
  }

  if (invalidEndpoints.length) {
    await adminClient
      .from("push_subscriptions")
      .delete()
      .in("endpoint", invalidEndpoints);
  }

  return { sent, removed: invalidEndpoints.length };
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const pushEnabled = configureWebPush();

  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select("id, email, topics")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{
    userId: string;
    added: number;
    picks: number;
    emailSent: boolean;
    emailSkipped: boolean;
    pushesSent: number;
    invalidPushSubscriptionsRemoved: number;
    error?: string;
    emailError?: string;
  }> = [];

  for (const profile of (profiles || []) as ProfileRow[]) {
    try {
      const topics = profile.topics || [];

      const fetchResult = await fetchArticlesForUser({
        userId: profile.id,
        topics,
        supabase: adminClient,
      });

      const articleIds = await ensureDailyPicks(
        adminClient,
        profile.id,
        DAILY_PICK_COUNT,
        today
      );

      const emailResult = await sendEmailForUser(
        adminClient,
        profile.id,
        profile.email,
        today
      );

      let pushResult = { sent: 0, removed: 0 };
      if (pushEnabled && articleIds.length > 0) {
        pushResult = await sendPushForUser(adminClient, profile.id, articleIds.length);
      }

      results.push({
        userId: profile.id,
        added: fetchResult.added,
        picks: articleIds.length,
        emailSent: emailResult.sent,
        emailSkipped: emailResult.skipped,
        pushesSent: pushResult.sent,
        invalidPushSubscriptionsRemoved: pushResult.removed,
        emailError: emailResult.error,
      });
    } catch (error) {
      console.error(`Cron fetch failed for user ${profile.id}:`, error);
      results.push({
        userId: profile.id,
        added: 0,
        picks: 0,
        emailSent: false,
        emailSkipped: true,
        pushesSent: 0,
        invalidPushSubscriptionsRemoved: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processedUsers: results.length,
    results,
    emailEnabled: isEmailEnabled(),
    pushEnabled,
  });
}
