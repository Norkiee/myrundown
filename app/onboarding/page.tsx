"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { TopicInput } from "@/components/TopicInput";

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

  const handleStartReading = async () => {
    if (topics.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const profileRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics, completeOnboarding: true }),
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
        <div className="mb-6">
          <TopicInput
            topics={topics}
            onChange={setTopics}
            placeholder="Add a topic..."
          />
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
