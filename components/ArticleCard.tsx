"use client";

import type { ArticleWithDigest } from "@/lib/types";
import { DigestSection } from "./DigestSection";

interface ArticleCardProps {
  article: ArticleWithDigest;
  onMarkRead: (id: string) => void;
}

function getScoreColor(score: number) {
  if (score >= 8) return "bg-accent-green-bg text-accent-green";
  if (score >= 5) return "bg-accent-yellow-bg text-accent-yellow";
  return "bg-accent-red-bg text-accent-red";
}

export function ArticleCard({ article, onMarkRead }: ArticleCardProps) {
  return (
    <article className="p-5 bg-surface border border-border rounded-xl animate-fade-up">
      {/* Meta row */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-text-muted">
          {article.source}
        </span>
        {article.topic && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-topic-bg text-topic">
            {article.topic}
          </span>
        )}
        <span
          className={`ml-auto text-xs px-2 py-0.5 rounded-full ${getScoreColor(
            article.score
          )}`}
        >
          {article.score}/10
        </span>
      </div>

      {/* Title */}
      <h2 className="text-lg font-semibold text-text-primary mb-2">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {article.title}
        </a>
      </h2>

      {/* Summary */}
      <p className="text-sm text-text-muted leading-relaxed">
        {article.summary}
      </p>

      {/* Digest section */}
      {article.digest && <DigestSection digest={article.digest} />}

      {/* Actions */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-text-primary text-background font-medium rounded-lg hover:bg-text-secondary transition-colors text-sm"
        >
          Read Full Article →
        </a>
        <button
          onClick={() => onMarkRead(article.id)}
          className="text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          Done Reading
        </button>
      </div>
    </article>
  );
}
