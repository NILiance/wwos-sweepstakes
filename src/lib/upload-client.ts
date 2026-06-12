"use client";

import { createClient } from "@/lib/supabase/client";
import { createUploadUrl } from "@/app/admin/upload-actions";

/** Upload a file from the browser directly to Supabase Storage. */
export async function uploadDirect(
  file: File,
  kind: "logo" | "favicon" | "hero" | "product",
  subId?: string,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const { path, token, publicUrl } = await createUploadUrl(kind, ext, subId);
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("media")
    .uploadToSignedUrl(path, token, file);
  if (error) throw new Error(error.message);
  return publicUrl;
}
