"use client";

import { useActionState, useState, startTransition } from "react";
import { saveBranding, resetColors } from "./actions";
import { uploadDirect } from "@/lib/upload-client";

function LogoSizeSlider({ initial }: { initial: number }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="mt-3 flex items-center gap-4">
      <input
        type="range"
        name="logoHeight"
        min={24}
        max={96}
        step={2}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-64 accent-[var(--red-500)]"
      />
      <span className="w-14 text-sm font-semibold">{value}px</span>
    </div>
  );
}

type Props = {
  current: {
    logo_url: string | null;
    favicon_url: string | null;
    hero_url: string | null;
    colors: Record<string, string | number>;
  };
  defaults: Record<string, string>;
};

const COLOR_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "background", label: "Background", hint: "Page background (deep navy)" },
  { key: "surface", label: "Surface", hint: "Cards, nav, footer" },
  { key: "accent", label: "Accent", hint: "Buttons, highlights (athletic red)" },
  { key: "info", label: "Info", hint: "Chips, links, stats (sky blue)" },
  { key: "muted", label: "Muted text", hint: "Secondary text (silver)" },
];

export function BrandingForm({ current, defaults }: Props) {
  const [state, formAction, pending] = useActionState(saveBranding, null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload files browser→storage first (Vercel caps request bodies ~4.5MB),
  // then submit only URLs + colors to the server action.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      setUploading(true);
      for (const kind of ["logo", "favicon", "hero"] as const) {
        const file = fd.get(kind);
        fd.delete(kind);
        if (file instanceof File && file.size > 0) {
          fd.set(`${kind}_url`, await uploadDirect(file, kind));
        }
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
      setUploading(false);
      return;
    }
    setUploading(false);
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-8">
      {/* Images */}
      <section className="rounded-lg border border-border bg-surface p-6">
        <h3 className="font-semibold">Images</h3>
        <div className="mt-4 grid gap-6 sm:grid-cols-3">
          {(
            [
              ["logo", "Logo", current.logo_url, "Shown in the nav. PNG/SVG with transparency works best."],
              ["favicon", "Favicon", current.favicon_url, "Browser tab icon. Square PNG or ICO."],
              ["hero", "Hero image", current.hero_url, "Optional banner art for the landing page."],
            ] as const
          ).map(([name, label, url, hint]) => (
            <div key={name}>
              <label htmlFor={name} className="block text-sm font-medium">
                {label}
              </label>
              {url ? (
                <div className="mt-2 flex h-20 items-center justify-center rounded-md bg-navy-950 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={label} className="max-h-16 max-w-full" />
                </div>
              ) : (
                <div className="mt-2 flex h-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted">
                  none yet
                </div>
              )}
              <input
                id={name}
                name={name}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                className="mt-2 block w-full text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground hover:file:bg-navy-700"
              />
              <p className="mt-1 text-xs text-muted">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Logo size */}
      <section className="rounded-lg border border-border bg-surface p-6">
        <h3 className="font-semibold">Logo size</h3>
        <p className="mt-1 text-xs text-muted">
          Height of the logo in the navigation bar.
        </p>
        <LogoSizeSlider initial={Number(current.colors.logoHeight) || 44} />
      </section>

      {/* Colors */}
      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Colors</h3>
          <button
            type="button"
            onClick={() => startTransition(() => resetColors())}
            className="text-xs text-muted underline hover:text-foreground"
          >
            Reset to brand defaults
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {COLOR_FIELDS.map((f) => (
            <div
              key={f.key}
              className="flex items-center gap-3 rounded-md bg-surface-raised px-4 py-3"
            >
              <input
                type="color"
                name={f.key}
                defaultValue={String(current.colors[f.key] ?? defaults[f.key])}
                className="h-10 w-12 cursor-pointer rounded border-0 bg-transparent"
              />
              <div>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-muted">{f.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {uploadError && <p className="text-sm text-brand-red">{uploadError}</p>}
      {state && (
        <p
          className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || uploading}
        className="rounded-md bg-accent px-6 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {uploading ? "Uploading images…" : pending ? "Saving…" : "Save branding"}
      </button>
    </form>
  );
}
