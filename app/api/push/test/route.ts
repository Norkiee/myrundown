import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import webpush from "web-push";

export async function POST(request: Request) {
  // Verify with a simple secret (use CRON_SECRET)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  webpush.setVapidDetails(
    "mailto:noreply@myrundown.xyz",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );

  // Get all push subscriptions
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id");

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ message: "No subscriptions found", sent: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify({
          title: "Test Notification",
          body: "Push notifications are working!",
          url: "/reads",
        })
      );
      sent++;
    } catch (err) {
      console.error("Push failed:", err);
      failed++;
      // Remove invalid subscription
      if ((err as { statusCode?: number }).statusCode === 410) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
      }
    }
  }

  return NextResponse.json({ sent, failed, total: subscriptions.length });
}
