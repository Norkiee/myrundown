"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { PushNotificationToggle } from "./PushNotificationToggle";
import { TopicInput } from "./TopicInput";

interface SettingsPanelProps {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onCancel: () => void;
}

export function SettingsPanel({
  profile,
  onSave,
  onCancel,
}: SettingsPanelProps) {
  const [topics, setTopics] = useState<string[]>(profile.topics);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  // Check if topics have changed
  const hasChanges = JSON.stringify(topics) !== JSON.stringify(profile.topics);

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics }),
      });

      if (res.ok) {
        const updated = await res.json();
        onSave(updated);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to delete all articles?")) return;
    setClearing(true);
    try {
      onCancel();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="mb-6 p-5 bg-surface border border-border rounded-xl">
      {/* Topics Input */}
      <label className="block text-xs font-medium text-text-primary tracking-wide uppercase mb-2">
        Your Interests
      </label>
      <p className="text-sm text-text-muted mb-3">
        Press Enter or comma to add a topic.
      </p>

      <TopicInput
        topics={topics}
        onChange={setTopics}
        placeholder={topics.length === 0 ? "e.g., AI agents, indie hacking, product design" : "Add another topic..."}
      />


      {/* Notifications */}
      <div className="mt-6 pt-4 border-t border-border">
        <PushNotificationToggle />
      </div>

      {/* Account */}
      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
        <div>
          <p className="text-sm text-text-primary">Account</p>
          <p className="text-xs text-text-muted">{profile.email}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors disabled:opacity-50"
        >
          {loggingOut ? "..." : "Log out"}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-2 bg-text-primary text-background font-medium rounded-lg hover:bg-text-secondary transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed btn-press hover-lift flex items-center gap-2"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Save
            </>
          )}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-text-muted hover:text-text-secondary transition-all duration-200 text-sm hover:bg-surface rounded-lg"
        >
          Cancel
        </button>
        <button
          onClick={handleClearAll}
          disabled={clearing}
          className="ml-auto px-4 py-2 text-accent-red hover:bg-accent-red-bg rounded-lg transition-all duration-200 text-sm disabled:opacity-50 btn-press flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          Clear All
        </button>
      </div>
    </div>
  );
}
