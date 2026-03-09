import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  anthropic,
  extractText,
  parseJsonResponse,
  DIGEST_SYSTEM_PROMPT,
} from "@/lib/anthropic";
import { selectDailyPicks } from "@/lib/picks";
import type { Article, DigestResult } from "@/lib/types";

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

  const today = new Date().toISOString().split("T")[0];

  // Get all users
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, daily_pick_count");

  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const results: { userId: string; picksCreated: number; digestsCreated: number; error?: string }[] = [];

  for (const profile of profiles || []) {
    try {
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

        if (!unreadArticles || unreadArticles.length === 0) {
          results.push({ userId: profile.id, picksCreated: 0, digestsCreated: 0 });
          continue;
        }

        const picks = selectDailyPicks(
          unreadArticles as Article[],
          profile.daily_pick_count || 2,
          today
        );

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

      if (pickArticleIds.length === 0) {
        results.push({ userId: profile.id, picksCreated: 0, digestsCreated: 0 });
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
        results.push({
          userId: profile.id,
          picksCreated: pickArticleIds.length,
          digestsCreated: 0,
        });
        continue;
      }

      // Get article details
      const { data: articles } = await supabase
        .from("articles")
        .select("*")
        .in("id", articlesNeedingDigests);

      if (!articles || articles.length === 0) {
        results.push({
          userId: profile.id,
          picksCreated: pickArticleIds.length,
          digestsCreated: 0,
        });
        continue;
      }

      // Generate digests
      const userPrompt = `Please analyze these articles and create detailed digests:

${articles.map((a) => `- ID: ${a.id}\n  Title: ${a.title}\n  Source: ${a.source}\n  URL: ${a.url}\n  Summary: ${a.summary}`).join("\n\n")}`;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: DIGEST_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      });

      const text = extractText(response);
      const digestResults = parseJsonResponse<DigestResult[]>(text);

      // Insert digests
      const digestsToInsert = digestResults.map((d) => ({
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

      results.push({
        userId: profile.id,
        picksCreated: pickArticleIds.length,
        digestsCreated: insertedDigests?.length || 0,
      });
    } catch (error) {
      console.error(`Error processing user ${profile.id}:`, error);
      results.push({
        userId: profile.id,
        picksCreated: 0,
        digestsCreated: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
