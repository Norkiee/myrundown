"use client";

import { useState } from "react";
import { SettingsPanel } from "./SettingsPanel";
import type { Profile } from "@/lib/types";

interface HeaderProps {
  profile: Profile | null;
  onProfileUpdate: (profile: Profile) => void;
}

export function Header({ profile, onProfileUpdate }: HeaderProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between py-4 mb-6">
        <div className="flex items-center gap-2 group cursor-default">
          <img
            src="/icon.svg"
            alt="My Rundown"
            width={24}
            height={24}
            className="transition-transform duration-300 group-hover:scale-110"
          />
          <span className="font-semibold text-text-primary">My Rundown</span>
        </div>

        <button
          onClick={() => profile && setShowSettings(!showSettings)}
          disabled={!profile}
          className={`p-2 rounded-lg transition-all duration-200 btn-press ${
            showSettings
              ? "bg-surface text-text-primary"
              : "hover:bg-surface text-text-muted hover:text-text-secondary"
          } ${!profile ? "opacity-50 cursor-not-allowed" : ""}`}
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

      {showSettings && profile && (
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
