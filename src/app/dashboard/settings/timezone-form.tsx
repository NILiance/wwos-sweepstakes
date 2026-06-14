"use client";

import { useActionState } from "react";
import { saveTimezone } from "./timezone-actions";
import { PLATFORM_TZ, TIMEZONES, shortZone } from "@/lib/tz";

const ZONE_LABEL: Record<string, string> = {
  "America/New_York": "Eastern",
  "America/Chicago": "Central",
  "America/Denver": "Mountain",
  "America/Los_Angeles": "Pacific",
  "America/Phoenix": "Arizona",
  "America/Anchorage": "Alaska",
  "Pacific/Honolulu": "Hawaii",
};

export function TimezoneForm({ current }: { current: string }) {
  const [state, formAction, pending] = useActionState(saveTimezone, null);
  const tz = TIMEZONES.includes(current) ? current : PLATFORM_TZ;

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium">
        <span className="mb-1 block">Display timezone</span>
        <select
          name="timezone"
          defaultValue={tz}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info"
        >
          {TIMEZONES.map((z) => (
            <option key={z} value={z}>
              {ZONE_LABEL[z] ?? z} ({shortZone(z)})
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={pending}
        className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state && (
        <span className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
