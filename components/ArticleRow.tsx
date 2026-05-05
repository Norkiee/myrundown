"use client";

import { useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/types";

interface ArticleRowProps {
  article: Article;
  onToggleRead: (id: string, read: boolean) => void;
  onDelete: (id: string) => void;
  index?: number;
}

const LONG_PRESS_MS = 500;

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

  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ArticleRow({ article, onToggleRead, onDelete, index = 0 }: ArticleRowProps) {
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const initial = (article.source || getDomain(article.url))[0].toUpperCase();
  const showActions = hovering || pressed;

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = () => {
    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      setPressed(true);
      longPressTimer.current = null;
    }, LONG_PRESS_MS);
  };

  // Auto-dismiss on outside tap
  useEffect(() => {
    if (!pressed) return;
    const dismiss = (e: TouchEvent | MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setPressed(false);
      }
    };
    document.addEventListener("touchstart", dismiss);
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("touchstart", dismiss);
      document.removeEventListener("mousedown", dismiss);
    };
  }, [pressed]);

  // Cleanup any pending timer on unmount
  useEffect(() => {
    return cancelLongPress;
  }, []);

  const handleDelete = () => {
    setPressed(false);
    setIsRemoving(true);
    setTimeout(() => onDelete(article.id), 200);
  };

  const handleToggle = () => {
    setPressed(false);
    onToggleRead(article.id, !article.read);
  };

  return (
    <div
      ref={rowRef}
      className={`flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg transition-all duration-200 select-none ${
        article.read ? "opacity-35" : ""
      } ${hovering || pressed ? "bg-surface" : ""} ${isRemoving ? "opacity-0 translate-x-4" : ""}`}
      style={{ animationDelay: `${index * 50}ms`, WebkitTouchCallout: "none" }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onTouchCancel={cancelLongPress}
      onContextMenu={(e) => {
        if (pressed) e.preventDefault();
      }}
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
        <span className="text-xs text-text-muted">
          {getDomain(article.url)} · {formatDate(article.saved_at)}
        </span>
      </div>

      {/* Actions */}
      <div
        className={`flex items-center gap-1 shrink-0 transition-all duration-200 ${
          showActions
            ? "opacity-100 translate-x-0 pointer-events-auto"
            : "opacity-0 translate-x-2 pointer-events-none"
        }`}
      >
        <button
          onClick={handleToggle}
          className={`p-2.5 rounded transition-all duration-200 btn-press ${
            article.read
              ? "text-accent-green hover:bg-accent-green-bg"
              : "text-text-muted hover:bg-border hover:text-accent-green"
          }`}
          title={article.read ? "Mark unread" : "Mark read"}
          aria-label={article.read ? "Mark unread" : "Mark read"}
        >
          <svg
            width="18"
            height="18"
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
          className="p-2.5 rounded text-text-muted hover:bg-accent-red-bg hover:text-accent-red transition-all duration-200 btn-press"
          title="Remove"
          aria-label="Remove"
        >
          <svg
            width="18"
            height="18"
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
    </div>
  );
}
