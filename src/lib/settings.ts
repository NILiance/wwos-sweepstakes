import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type SponsorInfo = {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  amoeNote?: string;
};

export const getSetting = cache(
  async <T = Record<string, unknown>>(key: string): Promise<T | null> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return (data?.value as T) ?? null;
  },
);

export async function setSetting(key: string, value: unknown) {
  const admin = createAdminClient();
  await admin
    .from("app_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
}

export async function getSponsor(): Promise<SponsorInfo> {
  return (await getSetting<SponsorInfo>("sponsor")) ?? {};
}

/** Human-readable mailing address block, or null if not configured. */
export function formatSponsorAddress(s: SponsorInfo): string | null {
  const lines = [
    s.name,
    s.address1,
    s.address2,
    [s.city, s.state].filter(Boolean).join(", ") +
      (s.zip ? ` ${s.zip}` : ""),
  ]
    .map((l) => (l ?? "").trim())
    .filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}
