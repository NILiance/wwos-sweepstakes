"use client";

import { useMemo, useState } from "react";

export type TrendSeries = {
  id: string;
  name: string;
  color: string;
  points: number[];
  ranks: number[];
};

const W = 680;
const H = 280;
const PAD_X = 36;
const PAD_Y = 28;

export function TrendChart({
  weeks,
  series,
}: {
  weeks: number[];
  series: TrendSeries[];
}) {
  const [mode, setMode] = useState<"points" | "rank">("points");
  const [hovered, setHovered] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);

  const visible = series.filter((s) => !hiddenIds.has(s.id));
  const n = weeks.length;

  const { x, y, maxVal } = useMemo(() => {
    const maxPts = Math.max(1, ...series.flatMap((s) => s.points));
    const maxRank = Math.max(2, ...series.flatMap((s) => s.ranks));
    const x = (i: number) => PAD_X + (i * (W - PAD_X * 2)) / Math.max(1, n - 1);
    const y = (s: TrendSeries, i: number) =>
      mode === "points"
        ? H - PAD_Y - (s.points[i] * (H - PAD_Y * 2)) / maxPts
        : PAD_Y + ((s.ranks[i] - 1) * (H - PAD_Y * 2)) / (maxRank - 1);
    return { x, y, maxVal: mode === "points" ? maxPts : maxRank };
  }, [series, mode, n]);

  function toggle(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hoveredSeries = series.find((s) => s.id === hovered);
  const wi = hoverWeek ?? n - 1;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {mode === "points" ? "Points by week" : "Rank race"}
        </p>
        <div className="flex rounded-md border border-border text-xs font-semibold">
          {(["points", "rank"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 ${
                mode === m
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              } first:rounded-l-md last:rounded-r-md`}
            >
              {m === "points" ? "📈 Points" : "🏁 Rank race"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-2 w-full select-none"
          onMouseLeave={() => {
            setHovered(null);
            setHoverWeek(null);
          }}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const idx = Math.round(((px - PAD_X) / (W - PAD_X * 2)) * (n - 1));
            setHoverWeek(Math.min(n - 1, Math.max(0, idx)));
          }}
        >
          {/* grid + axis labels */}
          {mode === "points" &&
            [0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line
                  x1={PAD_X}
                  x2={W - PAD_X}
                  y1={H - PAD_Y - f * (H - PAD_Y * 2)}
                  y2={H - PAD_Y - f * (H - PAD_Y * 2)}
                  stroke="currentColor"
                  opacity={0.07}
                />
                <text
                  x={W - PAD_X + 4}
                  y={H - PAD_Y - f * (H - PAD_Y * 2) + 3}
                  fontSize={9}
                  fill="currentColor"
                  opacity={0.4}
                >
                  {Math.round(maxVal * f)}
                </text>
              </g>
            ))}
          {weeks.map((w, i) => (
            <text
              key={w}
              x={x(i)}
              y={H - 8}
              fontSize={9}
              textAnchor="middle"
              fill="currentColor"
              opacity={hoverWeek === i ? 0.9 : 0.4}
              fontWeight={hoverWeek === i ? 700 : 400}
            >
              Wk {String(w).slice(-2)}
            </text>
          ))}

          {/* hover week guide */}
          {hoverWeek !== null && (
            <line
              x1={x(wi)}
              x2={x(wi)}
              y1={PAD_Y - 6}
              y2={H - PAD_Y + 6}
              stroke="currentColor"
              opacity={0.15}
              strokeDasharray="3 3"
            />
          )}

          {/* lines */}
          {visible.map((s) => {
            const dim = hovered && hovered !== s.id;
            const pts = weeks.map((_, i) => `${x(i)},${y(s, i)}`).join(" ");
            return (
              <g key={s.id}>
                <polyline
                  points={pts}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hovered === s.id ? 3.5 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={dim ? 0.12 : 0.95}
                  style={{ transition: "opacity .2s, stroke-width .2s" }}
                  className="trend-draw"
                />
                {/* fat invisible hit area */}
                <polyline
                  points={pts}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  onMouseEnter={() => setHovered(s.id)}
                  style={{ cursor: "pointer" }}
                />
                {/* dots on hovered series or at hover week */}
                {weeks.map((_, i) =>
                  hovered === s.id || (!dim && hoverWeek === i) ? (
                    <circle
                      key={i}
                      cx={x(i)}
                      cy={y(s, i)}
                      r={hovered === s.id && hoverWeek === i ? 5 : 3}
                      fill={s.color}
                      opacity={0.95}
                    />
                  ) : null,
                )}
                {/* end label for top 3 or hovered */}
                {(series.indexOf(s) < 3 || hovered === s.id) && !dim && (
                  <text
                    x={x(n - 1) - 4}
                    y={y(s, n - 1) - 7}
                    fontSize={10}
                    fontWeight={700}
                    textAnchor="end"
                    fill={s.color}
                  >
                    {mode === "rank" ? `#${s.ranks[n - 1]} ` : ""}
                    {s.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* tooltip */}
        {hoveredSeries && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-navy-950/95 px-3 py-2 text-xs shadow-xl">
            <p className="font-bold" style={{ color: hoveredSeries.color }}>
              {hoveredSeries.name}
            </p>
            <p className="mt-0.5">
              Wk {String(weeks[wi]).slice(-2)}:{" "}
              <span className="font-bold">
                {mode === "points"
                  ? `${hoveredSeries.points[wi]} pts`
                  : `#${hoveredSeries.ranks[wi]}`}
              </span>
              {wi > 0 && mode === "points" && (
                <span className="ml-1 text-info">
                  (+{hoveredSeries.points[wi] - hoveredSeries.points[wi - 1]} that wk)
                </span>
              )}
              {wi > 0 && mode === "rank" && (
                <span className="ml-1 text-info">
                  {hoveredSeries.ranks[wi - 1] - hoveredSeries.ranks[wi] > 0
                    ? `▲${hoveredSeries.ranks[wi - 1] - hoveredSeries.ranks[wi]}`
                    : hoveredSeries.ranks[wi - 1] - hoveredSeries.ranks[wi] < 0
                      ? `▼${hoveredSeries.ranks[wi] - hoveredSeries.ranks[wi - 1]}`
                      : "—"}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* legend chips */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {series.map((s) => {
          const off = hiddenIds.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              onMouseEnter={() => !off && setHovered(s.id)}
              onMouseLeave={() => setHovered(null)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                off
                  ? "border-border text-muted opacity-40"
                  : "border-border hover:border-info"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color }}
              />
              {s.name}
            </button>
          );
        })}
        {hiddenIds.size > 0 && (
          <button
            onClick={() => setHiddenIds(new Set())}
            className="text-xs text-info underline"
          >
            show all
          </button>
        )}
      </div>
    </div>
  );
}
