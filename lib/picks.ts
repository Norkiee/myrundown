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
  count: number = 3,
  dateStr?: string
): Article[] {
  if (unreadArticles.length === 0) return [];

  const seed = dateStr || new Date().toISOString().split("T")[0]; // "2026-03-08"

  const fresh: Article[] = [];
  const older: Article[] = [];
  for (const article of unreadArticles) {
    if (typeof article.saved_at === "string" && article.saved_at.startsWith(seed)) {
      fresh.push(article);
    } else {
      older.push(article);
    }
  }

  fresh.sort((a, b) => b.score - a.score);
  older.sort((a, b) => b.score - a.score);

  let candidates: Article[];
  if (fresh.length >= count) {
    // Enough fresh today: shuffle within today's top-N×3 by score.
    candidates = fresh.slice(0, Math.min(count * 3, fresh.length));
  } else {
    // Not enough fresh today: pad with highest-scored older unread.
    const topUp = older.slice(0, count - fresh.length);
    candidates = [...fresh, ...topUp];
  }

  // Deterministic shuffle using date as seed
  const random = seededRandom(seed);

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, count);
}
