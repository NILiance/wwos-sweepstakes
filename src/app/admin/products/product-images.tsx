"use client";

import { useActionState, useState, startTransition } from "react";
import { addProductImages, removeProductImage, updateProductOffers } from "./actions";

export function OffersEditor({
  productId,
  offers,
}: {
  productId: string;
  offers: string[];
}) {
  const [state, formAction, pending] = useActionState(updateProductOffers, null);

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="product_id" value={productId} />
      <label className="block text-sm font-medium">
        Partner offers <span className="text-xs text-muted">(one per line — shown on the product page)</span>
        <textarea
          name="offers"
          rows={4}
          defaultValue={offers.join("\n")}
          placeholder={"20% off at Primo's Pizzeria\nBOGO wings at The End Zone"}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info"
        />
      </label>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border px-4 py-1.5 text-sm font-semibold hover:bg-surface-raised disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save offers"}
        </button>
        {state && (
          <p className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
import { uploadDirect } from "@/lib/upload-client";

export function ImageUploader({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState(addProductImages, null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const input = form.querySelector<HTMLInputElement>('input[type="file"]');
    const files = [...(input?.files ?? [])];
    if (!files.length) return;

    const fd = new FormData();
    fd.set("product_id", productId);
    try {
      setUploading(true);
      for (const file of files) {
        fd.append("image_urls", await uploadDirect(file, "product", productId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setUploading(false);
      return;
    }
    setUploading(false);
    if (input) input.value = "";
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-center gap-3">
      <input
        type="file"
        name="images"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        required
        className="text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground hover:file:bg-navy-700"
      />
      <button
        type="submit"
        disabled={pending || uploading}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {uploading ? "Uploading…" : pending ? "Saving…" : "Add photos"}
      </button>
      {error && <p className="text-sm text-brand-red">{error}</p>}
      {state && (
        <p className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function RemoveImageButton({
  productId,
  url,
}: {
  productId: string;
  url: string;
}) {
  return (
    <form action={removeProductImage} className="absolute -right-2 -top-2 hidden group-hover:block">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="url" value={url} />
      <button
        type="submit"
        title="Remove image"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white shadow"
      >
        ✕
      </button>
    </form>
  );
}
