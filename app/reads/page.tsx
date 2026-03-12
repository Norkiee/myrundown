"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { TabNav } from "@/components/TabNav";
import { ArticleCarousel } from "@/components/ArticleCarousel";
import { ArticleRow } from "@/components/ArticleRow";
import { ArticleCardSkeleton, ArticleRowSkeleton } from "@/components/Skeleton";
import type { Profile, Article, ArticleWithDigest } from "@/lib/types";

type TabType = "today" | "queue" | "all" | "done";

export default function ReadsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("today");
  const [todayArticles, setTodayArticles] = useState<ArticleWithDigest[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayLoading, setTodayLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      console.log("Fetching profile...");
      let res = await fetch("/api/profile");
      console.log("Profile response:", res.status);

      // If profile doesn't exist, try to create it
      if (!res.ok) {
        console.log("Creating profile...");
        const createRes = await fetch("/api/auth/ensure-profile", { method: "POST" });
        console.log("Create profile response:", createRes.status, await createRes.clone().text());
        res = await fetch("/api/profile");
        console.log("Profile refetch response:", res.status);
      }

      if (res.ok) {
        const data = await res.json();
        console.log("Profile loaded:", data?.id);
        setProfile(data);
      } else {
        console.error("Profile failed:", await res.text());
      }
    } catch (err) {
      console.error("Profile load error:", err);
    }
  }, []);

  const loadTodayArticles = useCallback(async () => {
    setTodayLoading(true);
    const res = await fetch("/api/articles/today");
    if (res.ok) {
      const data = await res.json();
      setTodayArticles(data);
    }
    setTodayLoading(false);
  }, []);

  const loadArticles = useCallback(async (view: string) => {
    const res = await fetch(`/api/articles?view=${view}`);
    if (res.ok) {
      const data = await res.json();
      setArticles(data);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadProfile(), loadTodayArticles(), loadArticles("all")]);
      setLoading(false);
    };
    init();
  }, [loadProfile, loadTodayArticles, loadArticles]);

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });

    setTodayArticles((prev) => prev.filter((a) => a.id !== id));
    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
  };

  const handleToggleRead = async (id: string, read: boolean) => {
    await fetch(`/api/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    });

    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read } : a))
    );
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/articles/${id}`, { method: "DELETE" });
    setArticles((prev) => prev.filter((a) => a.id !== id));
    setTodayArticles((prev) => prev.filter((a) => a.id !== id));
  };

  const counts = {
    queue: articles.filter((a) => !a.read).length,
    all: articles.length,
    done: articles.filter((a) => a.read).length,
  };

  const filteredArticles = articles.filter((a) => {
    if (activeTab === "queue") return !a.read;
    if (activeTab === "done") return a.read;
    return true;
  });

  if (loading) {
    return (
      <div className="pb-20 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-surface animate-shimmer bg-gradient-to-r from-surface via-border to-surface bg-[length:200%_100%]" />
            <div className="w-24 h-5 rounded bg-surface animate-shimmer bg-gradient-to-r from-surface via-border to-surface bg-[length:200%_100%]" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 h-4 rounded bg-surface animate-shimmer bg-gradient-to-r from-surface via-border to-surface bg-[length:200%_100%]" />
            <div className="w-28 h-9 rounded-lg bg-surface animate-shimmer bg-gradient-to-r from-surface via-border to-surface bg-[length:200%_100%]" />
          </div>
        </div>

        {/* Decorative bar skeleton */}
        <div className="h-12 rounded-xl border border-border mb-6 animate-shimmer bg-gradient-to-r from-surface via-border to-surface bg-[length:200%_100%]" />

        {/* Tabs skeleton */}
        <div className="flex gap-4 border-b border-border mb-6 pb-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-24 h-4 rounded bg-surface animate-shimmer bg-gradient-to-r from-surface via-border to-surface bg-[length:200%_100%]"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>

        {/* Card skeleton */}
        <div>
          <ArticleCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 animate-fade-in">
      <Header
        profile={profile}
        onProfileUpdate={setProfile}
      />

      <TabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={counts}
      />

      {activeTab === "today" ? (
        <div>
          {todayLoading ? (
            <ArticleCardSkeleton />
          ) : todayArticles.length === 0 ? (
            <div className="py-12 text-center animate-fade-up">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface border border-border flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-accent-green"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-text-primary">Daily reads done!</p>
              {counts.queue > 0 ? (
                <>
                  <p className="text-text-muted text-sm mt-2">You can read more from your queue.</p>
                  <button
                    onClick={() => setActiveTab("queue")}
                    className="mt-4 px-4 py-2 bg-surface border border-border rounded-lg text-text-secondary hover:border-border-hover hover:text-text-primary transition-all text-sm"
                  >
                    View Queue ({counts.queue})
                  </button>
                </>
              ) : (
                <p className="text-text-muted text-sm mt-2">New articles are fetched daily at 6 AM.</p>
              )}
            </div>
          ) : (
            <ArticleCarousel
              articles={todayArticles}
              onMarkRead={handleMarkRead}
            />
          )}
        </div>
      ) : (
        <div className="animate-fade-in">
          {/* List header */}
          <div className="flex items-center justify-between px-2 py-2 text-xs text-text-muted border-b border-border mb-2">
            <span>Title</span>
            <span>Added</span>
          </div>

          {loading ? (
            <div className="space-y-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <ArticleRowSkeleton key={i} />
              ))}
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="py-12 text-center text-text-muted animate-fade-up">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface border border-border flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-text-muted"
                >
                  <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              No articles in this view.
            </div>
          ) : (
            <div>
              {filteredArticles.map((article, index) => (
                <ArticleRow
                  key={article.id}
                  article={article}
                  onToggleRead={handleToggleRead}
                  onDelete={handleDelete}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
