import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { selectDailyPicks } from "@/lib/picks";
import {
  anthropic,
  extractText,
  parseJsonResponse,
  DIGEST_SYSTEM_PROMPT,
} from "@/lib/anthropic";
import type { Article, ArticleWithDigest, DigestResult } from "@/lib/types";

async function generateDigests(
  articles: Article[],
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const userPrompt = `Create digests for these articles based on their summaries:

${articles
  .map(
    (a) => `Article ID: ${a.id}
Title: ${a.title}
Source: ${a.source}
Summary: ${a.summary}
---`
  )
  .join("\n")}`;

  try {
    // Use Haiku for cost efficiency - no web search needed
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: DIGEST_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = extractText(response);
    const digestResults = parseJsonResponse<DigestResult[]>(text);

    const digestsToInsert = digestResults.map((d) => ({
      article_id: d.articleId,
      user_id: userId,
      takeaways: d.takeaways,
      why_it_matters: d.whyItMatters,
      verdict: d.verdict,
    }));

    await supabase.from("digests").insert(digestsToInsert);

    return digestResults;
  } catch (error) {
    console.error("Auto-digest error:", error);
    return [];
  }
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's daily pick count preference
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_pick_count")
    .eq("id", user.id)
    .single();

  const pickCount = profile?.daily_pick_count || 2;
  const today = new Date().toISOString().split("T")[0];

  // Check if picks already exist for today
  const { data: existingPicks } = await supabase
    .from("daily_picks")
    .select("article_id")
    .eq("user_id", user.id)
    .eq("pick_date", today);

  let articleIds: string[];
  let isNewPicks = false;

  if (existingPicks && existingPicks.length > 0) {
    articleIds = existingPicks.map((p) => p.article_id);
  } else {
    const { data: unreadArticles } = await supabase
      .from("articles")
      .select("*")
      .eq("user_id", user.id)
      .eq("read", false)
      .order("score", { ascending: false });

    if (!unreadArticles || unreadArticles.length === 0) {
      return NextResponse.json([]);
    }

    const picks = selectDailyPicks(
      unreadArticles as Article[],
      pickCount,
      today
    );
    articleIds = picks.map((a) => a.id);
    isNewPicks = true;

    if (articleIds.length > 0) {
      await supabase.from("daily_picks").insert(
        articleIds.map((articleId) => ({
          user_id: user.id,
          article_id: articleId,
          pick_date: today,
        }))
      );
    }
  }

  if (articleIds.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch articles
  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .in("id", articleIds);

  if (!articles || articles.length === 0) {
    return NextResponse.json([]);
  }

  // Check for existing digests
  const { data: existingDigests } = await supabase
    .from("digests")
    .select("*")
    .in("article_id", articleIds);

  // Find articles without digests
  const digestedIds = new Set(existingDigests?.map((d) => d.article_id) || []);
  const articlesNeedingDigest = articles.filter((a) => !digestedIds.has(a.id));

  // Auto-generate digests in background (non-blocking)
  if (articlesNeedingDigest.length > 0) {
    generateDigests(articlesNeedingDigest, user.id, supabase).catch(console.error);
  }

  // Combine articles with existing digests (new ones will load on refresh)
  const articlesWithDigests: ArticleWithDigest[] = articles.map((article) => ({
    ...article,
    digest: existingDigests?.find((d) => d.article_id === article.id) || null,
  }));

  // Sort by score descending
  articlesWithDigests.sort((a, b) => b.score - a.score);

  return NextResponse.json(articlesWithDigests);
}
