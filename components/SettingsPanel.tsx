"use client";

import { useState, KeyboardEvent, useRef, useEffect } from "react";
import type { Profile } from "@/lib/types";

interface SettingsPanelProps {
  profile: Profile;
  onSave: (profile: Profile) => void;
  onCancel: () => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"];

function formatTime12(time24: string): string {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function to24Hour(hour: number, minute: string, period: "AM" | "PM"): string {
  let h = hour;
  if (period === "PM" && hour !== 12) h += 12;
  if (period === "AM" && hour === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${minute}`;
}

export function SettingsPanel({
  profile,
  onSave,
  onCancel,
}: SettingsPanelProps) {
  const [topics, setTopics] = useState<string[]>(profile.topics);
  const [inputValue, setInputValue] = useState("");
  const [notifyTime, setNotifyTime] = useState(profile.notify_time || "08:00");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [newTopicIndex, setNewTopicIndex] = useState<number | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const timePickerRef = useRef<HTMLDivElement>(null);

  // Parse current time
  const [hours24, mins] = notifyTime.split(":").map(Number);
  const currentPeriod: "AM" | "PM" = hours24 >= 12 ? "PM" : "AM";
  const currentHour = hours24 % 12 || 12;
  const currentMinute = mins.toString().padStart(2, "0");

  const [selectedHour, setSelectedHour] = useState(currentHour);
  const [selectedMinute, setSelectedMinute] = useState(currentMinute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(currentPeriod);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) {
        setShowTimePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update time when picker values change
  useEffect(() => {
    const newTime = to24Hour(selectedHour, selectedMinute, selectedPeriod);
    setNotifyTime(newTime);
  }, [selectedHour, selectedMinute, selectedPeriod]);

  const addTopic = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !topics.includes(trimmed)) {
      setTopics([...topics, trimmed]);
      setNewTopicIndex(topics.length);
      setTimeout(() => setNewTopicIndex(null), 300);
    }
    setInputValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTopic(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && topics.length > 0) {
      setTopics(topics.slice(0, -1));
    }
  };

  const handleInputChange = (value: string) => {
    if (value.includes(",")) {
      const parts = value.split(",");
      parts.forEach((part, i) => {
        if (i < parts.length - 1) {
          addTopic(part);
        } else {
          setInputValue(part);
        }
      });
    } else {
      setInputValue(value);
    }
  };

  const removeTopic = (index: number) => {
    setTopics(topics.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics, notifyTime }),
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

      <div className="min-h-[100px] p-3 bg-background border border-border rounded-lg focus-within:border-border-hover transition-all duration-200">
        <div className="flex flex-wrap gap-2 mb-2">
          {topics.map((topic, index) => (
            <span
              key={`${topic}-${index}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-full text-sm text-text-primary transition-all duration-200 hover:border-border-hover group ${
                index === newTopicIndex ? "animate-scale-in" : ""
              }`}
            >
              {topic}
              <button
                onClick={() => removeTopic(index)}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-accent-red-bg transition-all duration-200 text-text-muted hover:text-accent-red btn-press"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="transition-transform duration-200 group-hover:scale-110"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => inputValue && addTopic(inputValue)}
          placeholder={topics.length === 0 ? "e.g., AI agents, indie hacking, product design" : "Add another topic..."}
          className="w-full bg-transparent text-text-primary placeholder:text-text-faint focus:outline-none text-sm"
        />
      </div>

      {/* Notification Time */}
      <div className="mt-6">
        <label className="block text-xs font-medium text-text-primary tracking-wide uppercase mb-2">
          Daily Notification Time
        </label>
        <p className="text-sm text-text-muted mb-3">
          When should we notify you about new articles?
        </p>

        <div className="relative" ref={timePickerRef}>
          <button
            type="button"
            onClick={() => setShowTimePicker(!showTimePicker)}
            className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary hover:border-border-hover transition-all duration-200 text-sm w-full sm:w-auto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {formatTime12(notifyTime)}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted ml-auto">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showTimePicker && (
            <div className="absolute top-full left-0 mt-2 p-3 bg-surface border border-border rounded-xl shadow-lg z-10 animate-scale-in">
              <div className="flex gap-2">
                {/* Hours */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted text-center mb-1">Hour</span>
                  <div className="grid grid-cols-4 gap-1">
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        onClick={() => setSelectedHour(h)}
                        className={`w-8 h-8 rounded-lg text-sm transition-all ${
                          selectedHour === h
                            ? "bg-text-primary text-background"
                            : "text-text-secondary hover:bg-border"
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Minutes */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted text-center mb-1">Min</span>
                  <div className="flex flex-col gap-1">
                    {MINUTES.map((m) => (
                      <button
                        key={m}
                        onClick={() => setSelectedMinute(m)}
                        className={`w-10 h-8 rounded-lg text-sm transition-all ${
                          selectedMinute === m
                            ? "bg-text-primary text-background"
                            : "text-text-secondary hover:bg-border"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AM/PM */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted text-center mb-1">&nbsp;</span>
                  <div className="flex flex-col gap-1">
                    {(["AM", "PM"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setSelectedPeriod(p)}
                        className={`w-10 h-8 rounded-lg text-sm transition-all ${
                          selectedPeriod === p
                            ? "bg-text-primary text-background"
                            : "text-text-secondary hover:bg-border"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowTimePicker(false)}
                className="w-full mt-3 py-2 text-sm text-text-primary bg-border hover:bg-border-hover rounded-lg transition-all"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-text-primary text-background font-medium rounded-lg hover:bg-text-secondary transition-all duration-200 text-sm disabled:opacity-50 btn-press hover-lift flex items-center gap-2"
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
