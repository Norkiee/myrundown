import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Helper to extract text from Claude response
export function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// Helper to strip citation tags from web search responses
export function stripCitations(text: string): string {
  return text
    // Remove <cite index="...">content</cite> - keep content
    .replace(/<cite\s+index="[^"]*">/gi, "")
    .replace(/<\/cite>/gi, "")
    // Remove any other cite variants
    .replace(/<cite[^>]*>([^<]*)<\/cite>/gi, "$1")
    .replace(/<\/?cite[^>]*>/gi, "")
    // Clean up any leftover HTML-like tags
    .replace(/<[^>]+>/g, "")
    .trim();
}

// Helper to parse JSON from Claude response (handles markdown fences)
export function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract array pattern
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse JSON from Claude response");
  }
}

export const FETCH_SYSTEM_PROMPT = `You are an article curation agent. Given a list of topics the user is interested in, search the web for the most interesting, recent, and high-quality articles, blog posts, and Twitter/X threads on those topics.

For each article found, return a JSON array of objects with these fields:
- title: The article title
- url: The URL
- source: The publication or author name (just the domain or author, keep it short)
- summary: A 2-3 sentence summary of the key insight (detailed enough for digest)
- score: A relevance/quality score from 1-10
- topic: Which user topic this matches

Return ONLY valid JSON. No markdown, no backticks, no preamble. Just the JSON array.
Find 5-8 articles total, prioritizing:
1. Recency (last 48 hours preferred)
2. Quality of insight (not clickbait)
3. Diversity across the requested topics
4. Original sources over aggregators`;

// Digest prompt - no web search needed, uses existing summary
export const DIGEST_SYSTEM_PROMPT = `You are a reading digest assistant. You will be given articles with their title, source, and summary. Based on the summary provided, produce a digest.

For EACH article, produce:
1. A list of 3 key takeaways (infer from the summary)
2. A "why it matters" explanation (1 sentence on why this is relevant)
3. A verdict: "Must Read" if it sounds worth reading in full, or "Digest Enough" if the summary covers the essentials

Return ONLY valid JSON. No markdown, no backticks. Format:
[
  {
    "articleId": "the article uuid",
    "takeaways": ["point 1", "point 2", "point 3"],
    "whyItMatters": "explanation",
    "verdict": "Must Read" or "Digest Enough"
  }
]`;
