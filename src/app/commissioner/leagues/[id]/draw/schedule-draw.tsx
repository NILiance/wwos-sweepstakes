"use client";

import { useActionState } from "react";
import { scheduleDraw } from "@/app/commissioner/actions";
import { PLATFORM_TZ, TIMEZONES, fmt, shortZone, utcToLocalInput } from "@/lib/tz";

const field =
  "rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-info";

const ZONE_LABEL: Record<string, string> = {
  "America/New_York": "Eastern",
  "America/Chicago": "Central",
  "America/Denver": "Mountain",
  "America/Los_Angeles": "Pacific",
  "America/Phoenix": "Arizona",
  "America/Anchorage": "Alaska",
  "Pacific/Honolulu": "Hawaii",
};

export function ScheduleDraw({
  sweepstakesId,
  drawAt,
  timezone,
}: {
  sweepstakesId: string;
  drawAt: string | null;
  timezone: string | null;
}) {
  const tz = timezone || PLATFORM_TZ;
  const [state, formAction, pending] = useActionState(scheduleDraw, null);

  return (
    <form
      action={formAction}
      className="mt-4 rounded-lg border border-border bg-surface p-5"
    >
      <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
      <h3 className="font-bold">Schedule draw</h3>
      <p className="mt-1 text-xs text-muted">
        Pick a date &amp; time and the draw runs automatically. Leave blank to
        run manually. The platform default is Eastern ({shortZone(PLATFORM_TZ)})
        — override your league&apos;s timezone below.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Timezone</span>
          <select name="timezone" defaultValue={tz} className={field}>
            {TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {ZONE_LABEL[z] ?? z} ({shortZone(z)})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Draw date &amp; time</span>
          <input
            type="datetime-local"
            name="draw_at"
            defaultValue={utcToLocalInput(drawAt, tz)}
            className={field}
          />
        </label>
        <button
          disabled={pending}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save schedule"}
        </button>
      </div>

      {drawAt && (
        <p className="mt-3 text-sm text-info">
          Currently scheduled for {fmt(drawAt, tz)}.
        </p>
      )}
      {state && (
        <p className={`mt-2 text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
