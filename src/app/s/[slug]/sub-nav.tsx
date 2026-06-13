"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SubNav({
  slug,
  name,
  mode = "draw_roster",
}: {
  slug: string;
  name: string;
  mode?: string;
}) {
  const pathname = usePathname();
  const base = `/s/${slug}`;
  const isBracket = mode === "bracket";
  const TABS: [string, string][] = isBracket
    ? [
        [base, "Pool"],
        [`${base}/bracket`, "Bracket"],
        [`${base}/board`, "Smack Talk"],
        [`${base}/rules`, "Rules"],
      ]
    : [
        [base, "Pool"],
        [`${base}/standings`, "Standings"],
        [`${base}/scorecard`, "Scorecard"],
        [`${base}/draw`, "The Draw"],
        [`${base}/board`, "Smack Talk"],
        [`${base}/scoring`, "Scoring"],
        [`${base}/rules`, "Rules"],
      ];

  return (
    <div className="border-b border-border bg-surface/60">
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4">
        <span className="mr-3 hidden shrink-0 text-sm font-bold sm:block">
          {name}
        </span>
        {TABS.map(([href, label]) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
