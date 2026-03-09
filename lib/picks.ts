import type { Article } from "./types";

function seededRandom(seed: string): () => number {
  let s = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function selectDailyPicks(
  unreadArticles: Article[],
  count: number = 2,
  dateStr?: string
): Article[] {
  if (unreadArticles.length === 0) return [];

  // Sort by score descending, take top candidates
  const sorted = [...unreadArticles].sort((a, b) => b.score - a.score);
  const candidates = sorted.slice(0, Math.min(count * 3, sorted.length));

  // Deterministic shuffle using date as seed
  const seed = dateStr || new Date().toISOString().split("T")[0]; // "2026-03-08"
  const random = seededRandom(seed);

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, count);
}
