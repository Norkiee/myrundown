import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/admin";

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret) {
    return true;
  }

  return authorization === `Bearer ${secret}`;
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not configured");
  }

  webpush.setVapidDetails("mailto:noreply@myrundown.xyz", publicKey, privateKey);
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    configureWebPush();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid VAPID configuration" },
      { status: 500 }
    );
  }

  const adminClient = createAdminClient();
  const { data: subscriptions, error } = await adminClient
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = JSON.stringify({
    title: "My Rundown",
    body: "This is a test push notification.",
    url: "/reads",
  });

  let sent = 0;
  const invalidEndpoints: string[] = [];

  for (const subscription of subscriptions || []) {
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
        console.error("Push test send failed:", error);
      }
    }
  }

  if (invalidEndpoints.length > 0) {
    await adminClient
      .from("push_subscriptions")
      .delete()
      .in("endpoint", invalidEndpoints);
  }

  return NextResponse.json({
    ok: true,
    sent,
    removed: invalidEndpoints.length,
  });
}
