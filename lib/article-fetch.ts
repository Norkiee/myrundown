import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anthropic,
  CHEAP_MODEL,
  extractText,
  parseJsonResponse,
  FETCH_SYSTEM_PROMPT,
} from "@/lib/anthropic";
import { DAILY_ARTICLE_COUNT } from "@/lib/content-limits";
import type { FetchedArticle } from "@/lib/types";

interface FetchArticlesForUserInput {
  userId: string;
  topics: string[];
  supabase: SupabaseClient;
}

const VALID_VERDICTS = new Set(["Must Read", "Digest Enough"]);

export async function fetchArticlesForUser({
  userId,
  topics,
  supabase,
}: FetchArticlesForUserInput) {
  if (!topics.length) {
    return { added: 0, articles: [], digestsAdded: 0, message: "No topics configured" };
  }

  const userPrompt = `Find recent, high-quality articles on these topics:
${topics.map((topic, index) => `${index + 1}. ${topic}`).join("\n")}

Focus on articles published in the last 48 hours. Use at most 2 web searches total. Return exactly ${DAILY_ARTICLE_COUNT} articles as JSON, including takeaways, whyItMatters, and verdict for each.`;

  const response = await anthropic.messages.create({
    model: CHEAP_MODEL,
    max_tokens: 2200,
    system: FETCH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
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

  const candidates = articles
    .filter((article) => article.url && !existingUrls.has(article.url))
    .slice(0, DAILY_ARTICLE_COUNT);

  if (!candidates.length) {
    return { added: 0, articles: [], digestsAdded: 0, message: "No new articles found" };
  }

  const newArticles = candidates.map((article) => ({
    user_id: userId,
    title: article.title,
    url: article.url,
    source: article.source,
    summary: article.summary,
    score: Math.min(10, Math.max(1, article.score)),
    topic: article.topic,
    read: false,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("articles")
    .insert(newArticles)
    .select();

  if (insertError) {
    throw insertError;
  }

  const insertedRows = inserted || [];

  const digestsToInsert = insertedRows
    .map((row) => {
      const source = candidates.find((c) => c.url === row.url);
      if (!source) return null;
      const takeaways = Array.isArray(source.takeaways) ? source.takeaways.slice(0, 3) : null;
      const verdict = source.verdict && VALID_VERDICTS.has(source.verdict) ? source.verdict : null;
      const whyItMatters = source.whyItMatters || null;
      if (!takeaways || takeaways.length !== 3 || !verdict || !whyItMatters) return null;
      return {
        article_id: row.id,
        user_id: userId,
        takeaways,
        why_it_matters: whyItMatters,
        verdict,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  let digestsAdded = 0;
  if (digestsToInsert.length) {
    const { error: digestError } = await supabase
      .from("digests")
      .upsert(digestsToInsert, { onConflict: "article_id" });
    if (digestError) {
      console.error(`Digest upsert failed for user ${userId}:`, digestError);
    } else {
      digestsAdded = digestsToInsert.length;
    }
  }

  return {
    added: insertedRows.length,
    articles: insertedRows,
    digestsAdded,
    message: `Added ${insertedRows.length} new articles, ${digestsAdded} digests`,
  };
}
