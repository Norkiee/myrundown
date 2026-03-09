"use client";

interface TabNavProps {
  activeTab: "today" | "queue" | "all" | "done";
  onTabChange: (tab: "today" | "queue" | "all" | "done") => void;
  counts: {
    queue: number;
    all: number;
    done: number;
  };
}

export function TabNav({ activeTab, onTabChange, counts }: TabNavProps) {
  const tabs = [
    { id: "today" as const, label: "Today's Reads" },
    { id: "queue" as const, label: `Queue (${counts.queue})` },
    { id: "all" as const, label: `All (${counts.all})` },
    { id: "done" as const, label: `Done (${counts.done})` },
  ];

  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 btn-press whitespace-nowrap shrink-0 ${
            activeTab === tab.id
              ? "bg-text-primary text-background"
              : "bg-surface border border-border text-text-muted hover:text-text-secondary hover:border-border-hover"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
