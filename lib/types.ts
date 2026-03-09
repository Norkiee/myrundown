export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  topics: string[];
  daily_pick_count: number;
  notify_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  user_id: string;
  title: string;
  url: string;
  source: string | null;
  summary: string | null;
  score: number;
  topic: string | null;
  read: boolean;
  saved_at: string;
  read_at: string | null;
}

export interface DailyPick {
  id: string;
  user_id: string;
  article_id: string;
  pick_date: string;
}

export interface Digest {
  id: string;
  article_id: string;
  user_id: string;
  takeaways: string[];
  why_it_matters: string;
  verdict: "Must Read" | "Digest Enough";
  created_at: string;
}

export interface ArticleWithDigest extends Article {
  digest?: Digest | null;
}

export interface FetchedArticle {
  title: string;
  url: string;
  source: string;
  summary: string;
  score: number;
  topic: string;
}

export interface DigestResult {
  articleId: string;
  takeaways: string[];
  whyItMatters: string;
  verdict: "Must Read" | "Digest Enough";
}
