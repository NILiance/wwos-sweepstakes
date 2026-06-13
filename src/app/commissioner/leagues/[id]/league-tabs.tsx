"use client";

import { useState } from "react";

export function LeagueTabs({
  tabs,
}: {
  tabs: { key: string; label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.key);
  const cur = tabs.find((t) => t.key === active);
  return (
    <div className="mt-6">
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
      <div className="mt-6">{cur?.content}</div>
    </div>
  );
}
