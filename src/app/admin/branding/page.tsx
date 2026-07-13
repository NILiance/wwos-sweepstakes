import { requireStaff } from "@/lib/admin-guard";
import { getSiteTheme } from "@/lib/theme";
import { BrandingForm } from "./branding-form";

export const metadata = { title: "Branding — Admin" };
export const revalidate = 0;

// Brand guide defaults (SCOPE.md Appendix D)
const DEFAULTS = {
  background: "#0e1726",
  surface: "#15233f",
  accent: "#c0273d",
  info: "#a9d3ec",
  muted: "#a7a9ac",
};

export default async function BrandingPage() {
  await requireStaff("branding");
  const theme = await getSiteTheme();

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-bold">Site branding</h2>
      <p className="mt-1 text-sm text-muted">
        Logo, favicon and colors apply across the whole site instantly —
        storefronts, standings, emails pick these up. Per-sweepstakes overrides
        come later.
      </p>
      <BrandingForm
        current={{
          logo_url: theme?.logo_url ?? null,
          favicon_url: theme?.favicon_url ?? null,
          hero_url: theme?.hero_url ?? null,
          colors: { ...DEFAULTS, ...theme?.colors },
        }}
        defaults={DEFAULTS}
      />
    </div>
  );
}
