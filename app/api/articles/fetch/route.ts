import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  anthropic,
  extractText,
  parseJsonResponse,
  FETCH_SYSTEM_PROMPT,
} from "@/lib/anthropic";
import type { FetchedArticle } from "@/lib/types";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's topics
  const { data: profile } = await supabase
    .from("profiles")
    .select("topics")
    .eq("id", user.id)
    .single();

  if (!profile?.topics || profile.topics.length === 0) {
    return NextResponse.json(
      { error: "No topics configured. Please add topics in settings." },
      { status: 400 }
    );
  }

  const userPrompt = `Find recent, high-quality articles on these topics:
${profile.topics.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}

Focus on articles published in the last 48 hours. Return 5-8 articles as JSON. Include detailed summaries.`;

  try {
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
      .eq("user_id", user.id);

    const existingUrls = new Set(existingArticles?.map((a) => a.url) || []);

    // Filter out duplicates and prepare for insert
    const newArticles = articles
      .filter((a) => !existingUrls.has(a.url))
      .map((a) => ({
        user_id: user.id,
        title: a.title,
        url: a.url,
        source: a.source,
        summary: a.summary,
        score: Math.min(10, Math.max(1, a.score)), // Clamp score 1-10
        topic: a.topic,
        read: false,
      }));

    if (newArticles.length === 0) {
      return NextResponse.json({
        message: "No new articles found",
        added: 0,
      });
    }

    // Insert with on conflict do nothing
    const { data: inserted, error } = await supabase
      .from("articles")
      .insert(newArticles)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Added ${inserted?.length || 0} new articles`,
      added: inserted?.length || 0,
      articles: inserted,
    });
  } catch (error) {
    console.error("Fetch articles error:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles from AI" },
      { status: 500 }
    );
  }
}
