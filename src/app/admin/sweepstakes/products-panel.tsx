"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addProduct, cloneProduct, toggleProductActive } from "./actions";

type ProductRow = {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
};

type CatalogRow = {
  id: string;
  name: string;
  price_cents: number;
  pool: string;
};

const field =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info";

export function ProductsPanel({
  sweepstakesId,
  products,
  catalog,
}: {
  sweepstakesId: string;
  products: ProductRow[];
  catalog: CatalogRow[];
}) {
  const [addState, addAction, addPending] = useActionState(addProduct, null);
  const [cloneState, cloneAction, clonePending] = useActionState(cloneProduct, null);

  return (
    <section className="mt-6 max-w-2xl rounded-lg border border-border bg-surface p-6">
      <h3 className="font-semibold">Products</h3>
      <p className="mt-1 text-xs text-muted">
        What customers buy on this pool&apos;s page — entry included as the
        bonus. Photos & offers live on the{" "}
        <Link href="/admin/products" className="text-info hover:underline">
          Products tab
        </Link>
        .
      </p>

      {/* Current products */}
      <div className="mt-4 space-y-2">
        {products.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-md bg-surface-raised px-4 py-2.5 text-sm"
          >
            <span>
              <span className="font-semibold">{p.name}</span>{" "}
              <span className="text-muted">
                ${(p.price_cents / 100).toLocaleString()}
              </span>
              {!p.active && (
                <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                  inactive
                </span>
              )}
            </span>
            <form action={toggleProductActive}>
              <input type="hidden" name="product_id" value={p.id} />
              <input type="hidden" name="active" value={String(!p.active)} />
              <button className="text-xs text-info underline hover:text-foreground">
                {p.active ? "Deactivate" : "Activate"}
              </button>
            </form>
          </div>
        ))}
        {products.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
            No products yet — the pool page shows &quot;Product not yet
            announced&quot; until one is active.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {/* Add new */}
        <form action={addAction} className="rounded-md bg-surface-raised p-4">
          <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
          <p className="text-sm font-semibold">Add new product</p>
          <label className="mt-2 block text-xs text-muted">
            Name
            <input name="name" required className={field} />
          </label>
          <label className="mt-2 block text-xs text-muted">
            Price ($)
            <input name="price" type="number" min={0} step="0.01" className={field} />
          </label>
          <label className="mt-2 block text-xs text-muted">
            Description
            <textarea name="description" rows={2} className={field} />
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" name="shipping" defaultChecked className="accent-[var(--red-500)]" />
            Requires shipping
          </label>
          <button
            disabled={addPending}
            className="mt-3 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {addPending ? "Adding…" : "Add product"}
          </button>
          {addState && (
            <p className={`mt-2 text-xs ${addState.ok ? "text-info" : "text-brand-red"}`}>
              {addState.message}
            </p>
          )}
        </form>

        {/* Copy existing */}
        <form action={cloneAction} className="rounded-md bg-surface-raised p-4">
          <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
          <p className="text-sm font-semibold">Copy from existing</p>
          <p className="mt-1 text-xs text-muted">
            Duplicates the product here — photos and offers come along.
          </p>
          <select name="source_product_id" required className={field}>
            <option value="">Choose a product…</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — ${(c.price_cents / 100).toLocaleString()} ({c.pool})
              </option>
            ))}
          </select>
          <button
            disabled={clonePending}
            className="mt-3 rounded-md border border-border px-4 py-1.5 text-sm font-semibold hover:bg-navy-700 disabled:opacity-50"
          >
            {clonePending ? "Copying…" : "Copy product"}
          </button>
          {cloneState && (
            <p className={`mt-2 text-xs ${cloneState.ok ? "text-info" : "text-brand-red"}`}>
              {cloneState.message}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
