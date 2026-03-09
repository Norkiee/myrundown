import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  anthropic,
  extractText,
  parseJsonResponse,
  FETCH_SYSTEM_PROMPT,
  DIGEST_SYSTEM_PROMPT,
} from "@/lib/anthropic";
import { selectDailyPicks } from "@/lib/picks";
import type { FetchedArticle, Article, DigestResult } from "@/lib/types";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service role client to bypass RLS
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );

  // Get all users with their topics
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, topics")
    .not("topics", "is", null);

  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const results: { userId: string; added: number; error?: string }[] = [];

  for (const profile of profiles || []) {
    if (!profile.topics || profile.topics.length === 0) {
      continue;
    }

    try {
      const userPrompt = `Find recent, high-quality articles on these topics:
${profile.topics.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}

Focus on articles published in the last 48 hours. Return 8-12 articles as JSON.`;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: FETCH_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      });

      const text = extractText(response);
      const articles = parseJsonResponse<FetchedArticle[]>(text);

      // Get existing URLs to deduplicate
      const { data: existingArticles } = await supabase
        .from("articles")
        .select("url")
        .eq("user_id", profile.id);

      const existingUrls = new Set(existingArticles?.map((a) => a.url) || []);

      // Filter out duplicates and prepare for insert
      const newArticles = articles
        .filter((a) => !existingUrls.has(a.url))
        .map((a) => ({
          user_id: profile.id,
          title: a.title,
          url: a.url,
          source: a.source,
          summary: a.summary,
          score: Math.min(10, Math.max(1, a.score)),
          topic: a.topic,
          read: false,
        }));

      if (newArticles.length > 0) {
        const { data: inserted } = await supabase
          .from("articles")
          .insert(newArticles)
          .select();

        results.push({
          userId: profile.id,
          added: inserted?.length || 0,
        });
      } else {
        results.push({ userId: profile.id, added: 0 });
      }
    } catch (error) {
      console.error(`Error fetching for user ${profile.id}:`, error);
      results.push({
        userId: profile.id,
        added: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Now generate daily picks and digests for each user
  const today = new Date().toISOString().split("T")[0];
  const digestResults: { userId: string; picks: number; digests: number }[] = [];

  for (const profile of profiles || []) {
    try {
      // Get user's daily pick count
      const { data: fullProfile } = await supabase
        .from("profiles")
        .select("daily_pick_count")
        .eq("id", profile.id)
        .single();

      const pickCount = fullProfile?.daily_pick_count || 2;

      // Check if picks already exist for today
      const { data: existingPicks } = await supabase
        .from("daily_picks")
        .select("article_id")
        .eq("user_id", profile.id)
        .eq("pick_date", today);

      let pickArticleIds: string[] = [];

      if (existingPicks && existingPicks.length > 0) {
        pickArticleIds = existingPicks.map((p) => p.article_id);
      } else {
        // Create picks for today
        const { data: unreadArticles } = await supabase
          .from("articles")
          .select("*")
          .eq("user_id", profile.id)
          .eq("read", false)
          .order("score", { ascending: false })
          .limit(20);

        if (unreadArticles && unreadArticles.length > 0) {
          const picks = selectDailyPicks(unreadArticles as Article[], pickCount, today);

          if (picks.length > 0) {
            await supabase.from("daily_picks").insert(
              picks.map((article) => ({
                user_id: profile.id,
                article_id: article.id,
                pick_date: today,
              }))
            );
            pickArticleIds = picks.map((p) => p.id);
          }
        }
      }

      if (pickArticleIds.length === 0) {
        digestResults.push({ userId: profile.id, picks: 0, digests: 0 });
        continue;
      }

      // Check which articles need digests
      const { data: existingDigests } = await supabase
        .from("digests")
        .select("article_id")
        .in("article_id", pickArticleIds);

      const existingDigestIds = new Set(existingDigests?.map((d) => d.article_id) || []);
      const articlesNeedingDigests = pickArticleIds.filter((id) => !existingDigestIds.has(id));

      if (articlesNeedingDigests.length === 0) {
        digestResults.push({ userId: profile.id, picks: pickArticleIds.length, digests: 0 });
        continue;
      }

      // Get article details
      const { data: articles } = await supabase
        .from("articles")
        .select("*")
        .in("id", articlesNeedingDigests);

      if (!articles || articles.length === 0) {
        digestResults.push({ userId: profile.id, picks: pickArticleIds.length, digests: 0 });
        continue;
      }

      // Generate digests using Haiku
      const userPrompt = `Create digests for these articles based on their summaries:

${articles.map((a) => `Article ID: ${a.id}\nTitle: ${a.title}\nSource: ${a.source}\nSummary: ${a.summary}\n---`).join("\n")}`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: DIGEST_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text = extractText(response);
      const digests = parseJsonResponse<DigestResult[]>(text);

      const digestsToInsert = digests.map((d) => ({
        article_id: d.articleId,
        user_id: profile.id,
        takeaways: d.takeaways,
        why_it_matters: d.whyItMatters,
        verdict: d.verdict,
      }));

      const { data: insertedDigests } = await supabase
        .from("digests")
        .insert(digestsToInsert)
        .select();

      digestResults.push({
        userId: profile.id,
        picks: pickArticleIds.length,
        digests: insertedDigests?.length || 0,
      });
    } catch (error) {
      console.error(`Error generating digests for user ${profile.id}:`, error);
      digestResults.push({ userId: profile.id, picks: 0, digests: 0 });
    }
  }

  // Send email notifications to all users with picks
  const emailResults: { userId: string; sent: boolean; error?: string }[] = [];

  for (const profile of profiles || []) {
    try {
      // Get user email
      const { data: fullProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", profile.id)
        .single();

      if (!fullProfile?.email) continue;

      // Get today's picks with article details
      const { data: picks } = await supabase
        .from("daily_picks")
        .select(`
          article_id,
          articles (title, url, source, summary)
        `)
        .eq("user_id", profile.id)
        .eq("pick_date", today);

      if (!picks || picks.length === 0) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const articles = picks.map((p: any) => p.articles).filter(Boolean);

      const emailHtml = `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #080808; padding: 32px; color: #ddd8d0;">
          <h1 style="color: #ddd8d0; margin-bottom: 8px;">Your Rundown</h1>
          <p style="color: #b5b0a8; margin-bottom: 24px;">Here are today's curated articles for you:</p>
          ${articles.map((a: { title: string; url: string; source: string; summary: string }) => `
            <div style="margin: 16px 0; padding: 16px; border: 1px solid #191919; border-radius: 10px; background: #0e0e0e;">
              <p style="color: #888; font-size: 13px; margin: 0 0 8px;">${a.source}</p>
              <h3 style="margin: 0 0 8px;"><a href="${a.url}" style="color: #ddd8d0; text-decoration: none;">${a.title}</a></h3>
              <p style="color: #b5b0a8; font-size: 14px; margin: 0;">${a.summary}</p>
            </div>
          `).join("")}
          <p style="color: #888; font-size: 14px; margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://myrundown.vercel.app"}/reads" style="color: #ddd8d0;">
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
          from: process.env.RESEND_FROM_EMAIL || "My Rundown <noreply@myrundown.com>",
          to: fullProfile.email,
          subject: "Your Rundown is ready",
          html: emailHtml,
        }),
      });

      if (res.ok) {
        emailResults.push({ userId: profile.id, sent: true });
      } else {
        const err = await res.text();
        emailResults.push({ userId: profile.id, sent: false, error: err });
      }
    } catch (error) {
      emailResults.push({
        userId: profile.id,
        sent: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    fetchResults: results,
    digestResults,
    emailResults,
  });
}
