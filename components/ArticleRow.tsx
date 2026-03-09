"use client";

import { useState } from "react";
import type { Article } from "@/lib/types";

interface ArticleRowProps {
  article: Article;
  onToggleRead: (id: string, read: boolean) => void;
  onDelete: (id: string) => void;
  index?: number;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ArticleRow({ article, onToggleRead, onDelete, index = 0 }: ArticleRowProps) {
  const [hovering, setHovering] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const initial = (article.source || getDomain(article.url))[0].toUpperCase();

  const handleDelete = () => {
    setIsRemoving(true);
    setTimeout(() => onDelete(article.id), 200);
  };

  return (
    <div
      className={`flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg transition-all duration-200 ${
        article.read ? "opacity-35" : ""
      } ${hovering ? "bg-surface" : ""} ${isRemoving ? "opacity-0 translate-x-4" : ""}`}
      style={{ animationDelay: `${index * 50}ms` }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Favicon initial */}
      <div className={`w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-sm font-medium text-text-muted shrink-0 transition-all duration-200 ${
        hovering ? "border-border-hover scale-105" : ""
      }`}>
        {initial}
      </div>

      {/* Title and domain */}
      <div className="flex-1 min-w-0">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-sm text-text-primary hover:underline truncate block transition-colors duration-200 ${
            hovering ? "text-white" : ""
          }`}
        >
          {article.title}
        </a>
        <span className="text-xs text-text-muted">{getDomain(article.url)}</span>
      </div>

      {/* Date or actions */}
      <div className="flex items-center gap-1 shrink-0">
        <div className={`flex items-center gap-1 transition-all duration-200 ${
          hovering ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none"
        }`}>
          <button
            onClick={() => onToggleRead(article.id, !article.read)}
            className={`p-1.5 rounded transition-all duration-200 btn-press ${
              article.read
                ? "text-accent-green hover:bg-accent-green-bg"
                : "text-text-muted hover:bg-border hover:text-accent-green"
            }`}
            title={article.read ? "Mark unread" : "Mark read"}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="transition-transform duration-200 hover:scale-110"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded text-text-muted hover:bg-accent-red-bg hover:text-accent-red transition-all duration-200 btn-press"
            title="Remove"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="transition-transform duration-200 hover:scale-110"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <span className={`text-xs text-text-muted min-w-[60px] text-right transition-all duration-200 ${
          hovering ? "opacity-0 -translate-x-2" : "opacity-100 translate-x-0"
        }`}>
          {formatDate(article.saved_at)}
        </span>
      </div>
    </div>
  );
}
