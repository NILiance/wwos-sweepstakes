import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type SiteColors = {
  background?: string;
  surface?: string;
  accent?: string;
  info?: string;
  muted?: string;
  /** Nav logo height in px (24–96). Stored alongside colors in themes.colors. */
  logoHeight?: number;
};

export type SiteTheme = {
  id: string;
  logo_url: string | null;
  favicon_url: string | null;
  hero_url: string | null;
  colors: SiteColors;
};

const HEX = /^#[0-9a-fA-F]{3,8}$/;

export function sanitizeColors(colors: unknown): SiteColors {
  const out: SiteColors = {};
  if (colors && typeof colors === "object") {
    for (const key of ["background", "surface", "accent", "info", "muted"] as const) {
      const v = (colors as Record<string, unknown>)[key];
      if (typeof v === "string" && HEX.test(v)) out[key] = v;
    }
    const h = Number((colors as Record<string, unknown>).logoHeight);
    if (Number.isFinite(h)) {
      out.logoHeight = Math.min(96, Math.max(24, Math.round(h)));
    }
  }
  return out;
}

// Map editable tokens to the CSS variables defined in globals.css
export function themeCssOverrides(colors: SiteColors): string {
  const map: [keyof SiteColors, string[]][] = [
    ["background", ["--navy-950"]],
    ["surface", ["--navy-900"]],
    ["accent", ["--red-500", "--red-400"]],
    ["info", ["--sky-300"]],
    ["muted", ["--silver-400"]],
  ];
  const decls = map
    .flatMap(([key, vars]) =>
      colors[key] ? vars.map((v) => `${v}:${colors[key]}`) : [],
    )
    .join(";");
  return decls ? `:root{${decls}}` : "";
}

export const getSiteTheme = cache(async (): Promise<SiteTheme | null> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("themes")
    .select("id,logo_url,favicon_url,hero_url,colors")
    .eq("scope", "site")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { ...data, colors: sanitizeColors(data.colors) } as SiteTheme;
});
