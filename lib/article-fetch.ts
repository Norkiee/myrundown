import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anthropic,
  extractText,
  parseJsonResponse,
  FETCH_SYSTEM_PROMPT,
} from "@/lib/anthropic";
import type { FetchedArticle } from "@/lib/types";

interface FetchArticlesForUserInput {
  userId: string;
  topics: string[];
  supabase: SupabaseClient;
}

export async function fetchArticlesForUser({
  userId,
  topics,
  supabase,
}: FetchArticlesForUserInput) {
  if (!topics.length) {
    return { added: 0, articles: [], message: "No topics configured" };
  }

  const userPrompt = `Find recent, high-quality articles on these topics:
${topics.map((topic, index) => `${index + 1}. ${topic}`).join("\n")}

Focus on articles published in the last 48 hours. Return 5-8 articles as JSON. Include detailed summaries.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: FETCH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  });

  const text = extractText(response);
  const articles = parseJsonResponse<FetchedArticle[]>(text);

  const { data: existingArticles, error: existingError } = await supabase
    .from("articles")
    .select("url")
    .eq("user_id", userId);

  if (existingError) {
    throw existingError;
  }

  const existingUrls = new Set(existingArticles?.map((article) => article.url) || []);

  const newArticles = articles
    .filter((article) => article.url && !existingUrls.has(article.url))
    .map((article) => ({
      user_id: userId,
      title: article.title,
      url: article.url,
      source: article.source,
      summary: article.summary,
      score: Math.min(10, Math.max(1, article.score)),
      topic: article.topic,
      read: false,
    }));

  if (!newArticles.length) {
    return { added: 0, articles: [], message: "No new articles found" };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("articles")
    .insert(newArticles)
    .select();

  if (insertError) {
    throw insertError;
  }

  return {
    added: inserted?.length || 0,
    articles: inserted || [],
    message: `Added ${inserted?.length || 0} new articles`,
  };
}
