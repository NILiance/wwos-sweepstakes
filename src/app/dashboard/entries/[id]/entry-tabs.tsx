"use client";

import { useState } from "react";

export type EntryTab = {
  key: string;
  label: string;
  content: React.ReactNode;
};

export function EntryTabs({ tabs }: { tabs: EntryTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              active === t.key
                ? "bg-accent text-white"
                : "border border-border text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6">{current?.content}</div>
    </div>
  );
}
