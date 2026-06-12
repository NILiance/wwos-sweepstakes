"use client";

import { useState } from "react";

export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [selected, setSelected] = useState(0);
  if (!images.length) return null;

  return (
    <div className="mt-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[selected]}
        alt={name}
        className="aspect-square w-full rounded-md border border-border bg-navy-950 object-cover"
      />
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {images.map((url, i) => (
            <button
              key={url}
              onClick={() => setSelected(i)}
              className={`shrink-0 rounded-md border-2 ${
                i === selected ? "border-accent" : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${name} ${i + 1}`}
                className="h-14 w-14 rounded object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
