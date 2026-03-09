"use client";

import { useState } from "react";
import { SettingsPanel } from "./SettingsPanel";
import type { Profile } from "@/lib/types";

interface HeaderProps {
  profile: Profile;
  onProfileUpdate: (profile: Profile) => void;
}

export function Header({ profile, onProfileUpdate }: HeaderProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between py-4 mb-6">
        <div className="flex items-center gap-2 group cursor-default">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-text-primary transition-transform duration-300 group-hover:scale-110"
          >
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="4"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <line
              x1="7"
              y1="8"
              x2="17"
              y2="8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="origin-left transition-transform duration-300 group-hover:scale-x-90"
            />
            <line
              x1="7"
              y1="12"
              x2="17"
              y2="12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="7"
              y1="16"
              x2="13"
              y2="16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="origin-left transition-transform duration-300 group-hover:scale-x-110"
            />
          </svg>
          <span className="font-semibold text-text-primary">My Rundown</span>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-all duration-200 btn-press ${
            showSettings
              ? "bg-surface text-text-primary"
              : "hover:bg-surface text-text-muted hover:text-text-secondary"
          }`}
          aria-label="Settings"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`transition-transform duration-500 ${
              showSettings ? "rotate-90" : "hover:rotate-45"
            }`}
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      {showSettings && (
        <div className="animate-scale-in">
          <SettingsPanel
            profile={profile}
            onSave={(updated) => {
              onProfileUpdate(updated);
              setShowSettings(false);
            }}
            onCancel={() => setShowSettings(false)}
          />
        </div>
      )}
    </>
  );
}
