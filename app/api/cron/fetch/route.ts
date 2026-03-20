import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/admin";
import { fetchArticlesForUser } from "@/lib/article-fetch";
import { selectDailyPicks } from "@/lib/picks";
import type { Article } from "@/lib/types";

interface ProfileRow {
  id: string;
  topics: string[] | null;
  daily_pick_count: number | null;
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
    title: "My Rundown",
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
    .select("id, topics, daily_pick_count")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{
    userId: string;
    added: number;
    picks: number;
    pushesSent: number;
    invalidPushSubscriptionsRemoved: number;
    error?: string;
  }> = [];

  for (const profile of (profiles || []) as ProfileRow[]) {
    try {
      const topics = profile.topics || [];
      const pickCount = profile.daily_pick_count || 2;

      const fetchResult = await fetchArticlesForUser({
        userId: profile.id,
        topics,
        supabase: adminClient,
      });

      const articleIds = await ensureDailyPicks(
        adminClient,
        profile.id,
        pickCount,
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
        pushesSent: pushResult.sent,
        invalidPushSubscriptionsRemoved: pushResult.removed,
      });
    } catch (error) {
      console.error(`Cron fetch failed for user ${profile.id}:`, error);
      results.push({
        userId: profile.id,
        added: 0,
        picks: 0,
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
    pushEnabled,
  });
}
