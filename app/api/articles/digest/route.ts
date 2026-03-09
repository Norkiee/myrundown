import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  anthropic,
  extractText,
  parseJsonResponse,
  stripCitations,
  DIGEST_SYSTEM_PROMPT,
} from "@/lib/anthropic";
import type { DigestResult, Article } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { articleIds } = await request.json();

  if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
    return NextResponse.json(
      { error: "articleIds array required" },
      { status: 400 }
    );
  }

  // Fetch articles
  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .in("id", articleIds)
    .eq("user_id", user.id);

  if (!articles || articles.length === 0) {
    return NextResponse.json({ error: "No articles found" }, { status: 404 });
  }

  // Check which articles already have digests
  const { data: existingDigests } = await supabase
    .from("digests")
    .select("article_id")
    .in("article_id", articleIds);

  const existingIds = new Set(existingDigests?.map((d) => d.article_id) || []);
  const articlesToDigest = articles.filter((a) => !existingIds.has(a.id));

  if (articlesToDigest.length === 0) {
    // Return existing digests
    const { data: digests } = await supabase
      .from("digests")
      .select("*")
      .in("article_id", articleIds);

    return NextResponse.json({
      message: "Digests already exist",
      digests,
    });
  }

  const userPrompt = `Please read and digest these articles:

${articlesToDigest
  .map(
    (a: Article) => `Article ID: ${a.id}
Title: ${a.title}
Source: ${a.source}
URL: ${a.url}
Summary: ${a.summary}
---`
  )
  .join("\n")}

For each article, use web search to read the full content and produce a detailed digest.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: DIGEST_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    });

    const text = extractText(response);
    const digestResults = parseJsonResponse<DigestResult[]>(text);

    // Prepare digests for insert (strip citation tags from web search)
    const digestsToInsert = digestResults.map((d) => ({
      article_id: d.articleId,
      user_id: user.id,
      takeaways: d.takeaways.map(stripCitations),
      why_it_matters: stripCitations(d.whyItMatters),
      verdict: d.verdict,
    }));

    const { data: inserted, error } = await supabase
      .from("digests")
      .insert(digestsToInsert)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also fetch any existing digests to return complete set
    const { data: allDigests } = await supabase
      .from("digests")
      .select("*")
      .in("article_id", articleIds);

    return NextResponse.json({
      message: `Generated ${inserted?.length || 0} new digests`,
      digests: allDigests,
    });
  } catch (error) {
    console.error("Digest generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate digests" },
      { status: 500 }
    );
  }
}
