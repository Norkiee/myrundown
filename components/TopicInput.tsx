"use client";

import { useState, useEffect, useMemo, useRef, KeyboardEvent } from "react";
import fuzzysort from "fuzzysort";
import { normalizeTopic, MAX_TOPIC_LENGTH } from "@/lib/normalize-topic";
import type { TopicPoolEntry } from "@/lib/types";

interface TopicInputProps {
  topics: string[];
  onChange: (topics: string[]) => void;
  placeholder?: string;
}

const SUGGESTION_COUNT = 5;

export function TopicInput({ topics, onChange, placeholder }: TopicInputProps) {
  const [input, setInput] = useState("");
  const [pool, setPool] = useState<TopicPoolEntry[]>([]);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch pool on mount and on focus (cheap revalidation)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/topics")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TopicPoolEntry[]) => {
        if (!cancelled) setPool(data || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const refetchPool = async () => {
    try {
      const res = await fetch("/api/topics");
      if (res.ok) {
        const data = (await res.json()) as TopicPoolEntry[];
        setPool(data || []);
      }
    } catch {
      // best effort
    }
  };

  const suggestions = useMemo<TopicPoolEntry[]>(() => {
    const query = normalizeTopic(input);
    const taken = new Set(topics.map((t) => normalizeTopic(t)));
    const candidates = pool.filter((entry) => !taken.has(entry.normalized));

    if (!query) {
      return [...candidates]
        .sort((a, b) => b.count - a.count)
        .slice(0, SUGGESTION_COUNT);
    }

    const targets = candidates.map((entry) => ({
      ...entry,
      _target: fuzzysort.prepare(entry.normalized),
    }));

    const results = fuzzysort.go(query, targets, {
      key: "_target",
      limit: SUGGESTION_COUNT,
      threshold: -10000,
    });

    return results.map((r) => ({
      normalized: r.obj.normalized,
      display: r.obj.display,
      count: r.obj.count,
    }));
  }, [input, pool, topics]);

  const showDropdown = focused && suggestions.length > 0;

  const persistTopic = async (topic: string) => {
    try {
      await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      void refetchPool();
    } catch {
      // best effort; chip is already added
    }
  };

  const commitFreeText = (raw: string) => {
    const display = raw.trim().replace(/\s+/g, " ");
    if (!display) return;
    if (display.length > MAX_TOPIC_LENGTH) return;
    if (topics.some((t) => normalizeTopic(t) === normalizeTopic(display))) {
      setInput("");
      return;
    }
    onChange([...topics, display]);
    setInput("");
    void persistTopic(display);
  };

  const commitSuggestion = (entry: TopicPoolEntry) => {
    if (topics.some((t) => normalizeTopic(t) === entry.normalized)) {
      setInput("");
      return;
    }
    onChange([...topics, entry.display]);
    setInput("");
    void persistTopic(entry.display);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitFreeText(input);
    } else if (e.key === "Backspace" && input === "" && topics.length > 0) {
      onChange(topics.slice(0, -1));
    }
  };

  const handleInputChange = (value: string) => {
    if (value.includes(",")) {
      const parts = value.split(",");
      parts.forEach((part, i) => {
        if (i < parts.length - 1) {
          commitFreeText(part);
        } else {
          setInput(part);
        }
      });
    } else {
      setInput(value);
    }
  };

  const removeAt = (index: number) => {
    onChange(topics.filter((_, i) => i !== index));
  };

  // Click-outside handler
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="min-h-[100px] p-3 bg-background border border-border rounded-lg focus-within:border-border-hover transition-all duration-200">
        <div className="flex flex-wrap gap-2 mb-2">
          {topics.map((topic, index) => (
            <span
              key={`${topic}-${index}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-full text-sm text-text-primary transition-all duration-200 hover:border-border-hover"
            >
              {topic}
              <button
                onClick={() => removeAt(index)}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-accent-red-bg transition-colors text-text-muted hover:text-accent-red"
                type="button"
                aria-label={`Remove ${topic}`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setFocused(true);
            void refetchPool();
          }}
          onBlur={() => {
            // Delay so click on suggestion can fire first
            setTimeout(() => {
              if (input) commitFreeText(input);
            }, 150);
          }}
          placeholder={placeholder ?? "Add a topic..."}
          className="w-full bg-transparent text-text-primary placeholder:text-text-faint focus:outline-none text-sm"
        />
      </div>

      {showDropdown && (
        <ul
          className="absolute top-full left-0 right-0 mt-1 z-20 bg-surface border border-border rounded-lg shadow-lg overflow-hidden"
          role="listbox"
        >
          {suggestions.map((entry) => (
            <li
              key={entry.normalized}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur from racing
                commitSuggestion(entry);
              }}
              className="px-3 py-2 text-sm text-text-primary hover:bg-background cursor-pointer transition-colors"
              role="option"
              aria-selected={false}
            >
              {entry.display}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
