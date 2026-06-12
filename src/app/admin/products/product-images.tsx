"use client";

import { useActionState } from "react";
import { addProductImages, removeProductImage } from "./actions";

export function ImageUploader({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState(addProductImages, null);

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="product_id" value={productId} />
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
        disabled={pending}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Add photos"}
      </button>
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
