"use client";

import { useState } from "react";
import Link from "next/link";
import { fmt, PLATFORM_TZ } from "@/lib/tz";
import type { ActivityItem, ActivityCategory } from "@/lib/activity";

const FILTERS: { key: ActivityCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pool", label: "Pools" },
  { key: "social", label: "Social" },
  { key: "league", label: "League & admin" },
  { key: "account", label: "Account" },
];

export function ActivityTimeline({
  items,
  tz = PLATFORM_TZ,
}: {
  items: ActivityItem[];
  tz?: string;
}) {
  const [filter, setFilter] = useState<ActivityCategory | "all">("all");
  const shown = filter === "all" ? items : items.filter((i) => i.category === filter);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.key === "all"
              ? items.length
              : items.filter((i) => i.category === f.key).length;
          if (f.key !== "all" && count === 0) return null;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filter === f.key
                  ? "bg-accent text-white"
                  : "border border-border text-muted hover:text-foreground"
              }`}
            >
              {f.label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          Nothing here yet.
        </p>
      ) : (
        <ol className="mt-5 space-y-0">
          {shown.map((it, i) => {
            const body = (
              <>
                <span className="mt-0.5 shrink-0 text-lg leading-none">{it.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{it.title}</p>
                  {it.detail && (
                    <p className="truncate text-xs text-muted">{it.detail}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted">{fmt(it.at, tz)}</p>
                </div>
              </>
            );
            const cls =
              "flex gap-3 border-l-2 border-border py-3 pl-4 hover:border-accent";
            return it.href ? (
              <li key={i}>
                <Link href={it.href} className={cls}>
                  {body}
                </Link>
              </li>
            ) : (
              <li key={i} className={cls}>
                {body}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
