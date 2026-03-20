"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";

const DEFAULT_TOPICS = [
  "AI agents and autonomous systems",
  "indie hacking and building in public",
  "product design and UX",
  "startup fundraising and growth",
  "economics and monetary policy",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<string[]>(DEFAULT_TOPICS);
  const [newTopic, setNewTopic] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load profile to check if already onboarded
    fetch("/api/profile")
      .then((res) => res.json())
      .then((profile: Profile) => {
        if (profile.topics && profile.topics.length > 0) {
          setTopics(profile.topics);
        }
      })
      .catch(() => {});
  }, []);

  const handleAddTopic = () => {
    const trimmed = newTopic.trim();
    if (trimmed && !topics.includes(trimmed)) {
      setTopics([...topics, trimmed]);
      setNewTopic("");
    }
  };

  const handleRemoveTopic = (topic: string) => {
    setTopics(topics.filter((t) => t !== topic));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTopic();
    }
  };

  const handleStartReading = async () => {
    if (topics.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const profileRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics }),
      });

      if (!profileRes.ok) {
        throw new Error("Failed to save topics");
      }

      // For first-time users, fetch immediately instead of waiting for the 6 AM cron.
      setFetching(true);

      const fetchRes = await fetch("/api/articles/fetch", { method: "POST" });

      if (!fetchRes.ok) {
        throw new Error("Failed to fetch your first articles");
      }

      // Force today's picks to exist before entering the reads screen.
      const todayRes = await fetch("/api/articles/today");

      if (!todayRes.ok) {
        throw new Error("Failed to prepare today's reads");
      }

      router.push("/reads");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setFetching(false);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg animate-fade-up">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src="/icon.svg" alt="My Rundown" width={28} height={28} />
          <span className="text-xl font-semibold text-text-primary">My Rundown</span>
        </div>

        {/* Welcome text */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">
            What do you want to read about?
          </h1>
          <p className="text-text-secondary">
            Add topics you&apos;re interested in. We&apos;ll curate 2 articles for you every day.
          </p>
        </div>

        {/* Topics */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          {/* Topic pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {topics.map((topic) => (
              <button
                key={topic}
                onClick={() => handleRemoveTopic(topic)}
                className="group flex items-center gap-2 px-3 py-1.5 bg-topic-bg border border-topic rounded-full text-sm text-text-secondary hover:border-accent-red hover:text-accent-red transition-colors"
              >
                <span>{topic}</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="opacity-50 group-hover:opacity-100"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ))}
          </div>

          {/* Add topic input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a topic..."
              className="flex-1 px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover transition-colors"
            />
            <button
              onClick={handleAddTopic}
              disabled={!newTopic.trim()}
              className="px-4 py-2.5 bg-surface border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-border-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStartReading}
          disabled={topics.length === 0 || saving}
          className="w-full py-3.5 bg-text-primary text-background font-medium rounded-lg hover:bg-text-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all btn-press"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
              {fetching ? "Fetching your first articles..." : "Saving..."}
            </span>
          ) : (
            "Start Reading"
          )}
        </button>

        {topics.length === 0 && (
          <p className="text-center text-text-muted text-sm mt-3">
            Add at least one topic to continue
          </p>
        )}

        {error && (
          <p className="text-center text-accent-red text-sm mt-3">{error}</p>
        )}
      </div>
    </div>
  );
}
