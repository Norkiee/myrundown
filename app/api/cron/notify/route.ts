import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );

  // Get current time in HH:MM format
  const now = new Date();
  const currentHour = now.getUTCHours().toString().padStart(2, "0");
  const currentMinute = Math.floor(now.getUTCMinutes() / 15) * 15; // Round to 15-min intervals
  const currentTime = `${currentHour}:${currentMinute.toString().padStart(2, "0")}`;

  // Find users whose notify_time matches (within 15 min window)
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, notify_time")
    .not("notify_time", "is", null);

  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const results: { email: string; sent: boolean; error?: string }[] = [];

  for (const profile of profiles || []) {
    // Check if notify_time matches current time window (within 15 mins)
    if (!profile.notify_time) continue;

    const [notifyHour, notifyMinute] = profile.notify_time.split(":").map(Number);
    const [currHour, currMinute] = currentTime.split(":").map(Number);

    const notifyMins = notifyHour * 60 + notifyMinute;
    const currMins = currHour * 60 + currMinute;

    // Skip if not within 15-minute window
    if (Math.abs(notifyMins - currMins) > 15) continue;

    // Get today's picks for this user
    const today = new Date().toISOString().split("T")[0];
    const { data: picks } = await supabase
      .from("daily_picks")
      .select(`
        article_id,
        articles (title, url, source, summary)
      `)
      .eq("user_id", profile.id)
      .eq("pick_date", today);

    if (!picks || picks.length === 0) continue;

    // Send email via Resend
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const articles = picks.map((p: any) => p.articles).filter(Boolean);

      const emailHtml = `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Your Rundown</h1>
          <p style="color: #666;">Here are today's curated articles for you:</p>
          ${articles.map((a: { title: string; url: string; source: string; summary: string }) => `
            <div style="margin: 20px 0; padding: 16px; border: 1px solid #eee; border-radius: 8px;">
              <h3 style="margin: 0 0 8px;"><a href="${a.url}" style="color: #333; text-decoration: none;">${a.title}</a></h3>
              <p style="color: #888; font-size: 14px; margin: 0 0 8px;">${a.source}</p>
              <p style="color: #555; font-size: 14px; margin: 0;">${a.summary}</p>
            </div>
          `).join("")}
          <p style="color: #888; font-size: 14px; margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://dailyreads.app"}/reads" style="color: #333;">
              Read more in the app →
            </a>
          </p>
        </div>
      `;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "My Rundown <noreply@dailyreads.app>",
          to: profile.email,
          subject: "Your Rundown are ready",
          html: emailHtml,
        }),
      });

      if (res.ok) {
        results.push({ email: profile.email, sent: true });
      } else {
        const err = await res.text();
        results.push({ email: profile.email, sent: false, error: err });
      }
    } catch (error) {
      results.push({
        email: profile.email,
        sent: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    time: currentTime,
    notified: results.filter((r) => r.sent).length,
    results,
  });
}
