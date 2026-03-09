"use client";

import { useState } from "react";
import type { ArticleWithDigest } from "@/lib/types";
import { DigestSection } from "./DigestSection";

interface ArticleCarouselProps {
  articles: ArticleWithDigest[];
  onMarkRead: (id: string) => void;
  loading?: boolean;
}

export function ArticleCarousel({ articles, onMarkRead, loading }: ArticleCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);

  // Reset index if out of bounds
  const safeIndex = Math.min(currentIndex, Math.max(0, articles.length - 1));

  if (articles.length === 0) {
    return null;
  }

  const article = articles[safeIndex];

  if (!article) {
    return null;
  }
  const hasMultiple = articles.length > 1;

  const goNext = () => {
    setDirection("right");
    setCurrentIndex((prev) => (prev + 1) % articles.length);
  };

  const goPrev = () => {
    setDirection("left");
    setCurrentIndex((prev) => (prev - 1 + articles.length) % articles.length);
  };

  const animationClass = direction === "right"
    ? "animate-slide-in-right"
    : direction === "left"
    ? "animate-slide-in-left"
    : "animate-fade-up";

  return (
    <div className="relative">
      {/* Navigation dots */}
      {hasMultiple && (
        <div className="flex items-center justify-center gap-2 mb-4">
          {articles.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setDirection(index > currentIndex ? "right" : "left");
                setCurrentIndex(index);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? "bg-text-primary scale-125"
                  : "bg-border hover:bg-border-hover hover:scale-110"
              }`}
            />
          ))}
        </div>
      )}

      {/* Card */}
      <article
        key={article.id}
        className={`p-6 bg-surface border border-border rounded-xl card-hover ${animationClass}`}
      >
        {/* Meta row */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-text-muted">
            {article.source}
          </span>
          {article.topic && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-border text-text-secondary transition-colors hover:bg-border-hover">
              {article.topic}
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-text-primary mb-4">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline decoration-text-muted underline-offset-4 transition-colors hover:text-white"
          >
            {article.title}
          </a>
        </h2>

        {/* Digest section */}
        {article.digest ? (
          <div className="animate-fade-in">
            <DigestSection digest={article.digest} />
          </div>
        ) : (
          <div className="mt-4 p-4 bg-surface-dark rounded-xl border border-border">
            <div className="flex items-center gap-3 text-text-muted">
              <div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
              <span className="text-sm animate-pulse-soft">Reading and summarizing article...</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-text-primary text-background font-medium rounded-lg hover:bg-text-secondary transition-all duration-200 text-sm btn-press hover-lift flex items-center gap-2"
          >
            Read Full Article
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </a>
          <button
            onClick={() => onMarkRead(article.id)}
            className="px-4 py-2 text-text-muted hover:text-accent-green hover:bg-accent-green-bg rounded-lg transition-all duration-200 text-sm flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Done Reading
          </button>
        </div>

      </article>

      {/* Navigation with arrows and counter */}
      {hasMultiple && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={goPrev}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:border-border-hover hover:bg-border transition-all duration-200 btn-press group"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-text-muted transition-transform duration-200 group-hover:-translate-x-0.5"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="text-sm text-text-muted">
            <span className="text-text-secondary">{currentIndex + 1}</span>
            <span className="mx-1">/</span>
            <span>{articles.length}</span>
          </div>
          <button
            onClick={goNext}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:border-border-hover hover:bg-border transition-all duration-200 btn-press group"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-text-muted transition-transform duration-200 group-hover:translate-x-0.5"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
