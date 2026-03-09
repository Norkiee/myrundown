import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { selectDailyPicks } from "@/lib/picks";
import {
  anthropic,
  extractText,
  parseJsonResponse,
  DIGEST_SYSTEM_PROMPT,
} from "@/lib/anthropic";
import type { Article, ArticleWithDigest, DigestResult } from "@/lib/types";

function getAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } }
  );
}

async function generateDigests(
  articles: Article[],
  userId: string,
  adminClient: ReturnType<typeof getAdminClient>
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

    await adminClient.from("digests").insert(digestsToInsert);

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

  const adminClient = getAdminClient();

  // Get user's daily pick count preference
  const { data: profile } = await adminClient
    .from("profiles")
    .select("daily_pick_count")
    .eq("id", user.id)
    .single();

  const pickCount = profile?.daily_pick_count || 2;
  const today = new Date().toISOString().split("T")[0];

  // Check if picks already exist for today
  const { data: existingPicks } = await adminClient
    .from("daily_picks")
    .select("article_id")
    .eq("user_id", user.id)
    .eq("pick_date", today);

  let articleIds: string[];

  if (existingPicks && existingPicks.length > 0) {
    articleIds = existingPicks.map((p) => p.article_id);
  } else {
    const { data: unreadArticles } = await adminClient
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

    if (articleIds.length > 0) {
      await adminClient.from("daily_picks").insert(
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
  const { data: articles } = await adminClient
    .from("articles")
    .select("*")
    .in("id", articleIds);

  if (!articles || articles.length === 0) {
    return NextResponse.json([]);
  }

  // Check for existing digests
  const { data: existingDigests } = await adminClient
    .from("digests")
    .select("*")
    .in("article_id", articleIds);

  // Find articles without digests
  const digestedIds = new Set(existingDigests?.map((d) => d.article_id) || []);
  const articlesNeedingDigest = articles.filter((a) => !digestedIds.has(a.id));

  // Auto-generate digests in background (non-blocking)
  if (articlesNeedingDigest.length > 0) {
    generateDigests(articlesNeedingDigest, user.id, adminClient).catch(console.error);
  }

  // Combine articles with existing digests
  const articlesWithDigests: ArticleWithDigest[] = articles.map((article) => ({
    ...article,
    digest: existingDigests?.find((d) => d.article_id === article.id) || null,
  }));

  // Sort by score descending
  articlesWithDigests.sort((a, b) => b.score - a.score);

  return NextResponse.json(articlesWithDigests);
}
