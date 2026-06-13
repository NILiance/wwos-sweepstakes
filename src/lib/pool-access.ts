import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Private-pool access check, cached per request so the layout (lock-screen
 * UX) and the page (data protection — pages render in parallel with layouts,
 * so each data-bearing page must enforce this itself) share one lookup.
 */
export const poolAccess = cache(
  async (
    slug: string,
  ): Promise<{
    exists: boolean;
    name: string | null;
    visibility: string | null;
    gameMode: string | null;
    allowed: boolean;
    signedIn: boolean;
  }> => {
    const admin = createAdminClient();
    const { data: sw } = await admin
      .from("sweepstakes")
      .select("id,name,visibility,game_mode")
      .eq("slug", slug)
      .maybeSingle();
    if (!sw) {
      return { exists: false, name: null, visibility: null, gameMode: null, allowed: false, signedIn: false };
    }
    if (sw.visibility !== "private") {
      return { exists: true, name: sw.name, visibility: sw.visibility, gameMode: sw.game_mode, allowed: true, signedIn: false };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { exists: true, name: sw.name, visibility: "private", gameMode: sw.game_mode, allowed: false, signedIn: false };
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role,is_admin")
      .eq("id", user.id)
      .single();
    let allowed =
      profile?.role === "admin" || profile?.role === "staff" || !!profile?.is_admin;

    if (!allowed) {
      const { data: entry } = await admin
        .from("entries")
        .select("id")
        .eq("sweepstakes_id", sw.id)
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle();
      allowed = !!entry;
    }
    if (!allowed) {
      const { data: share } = await admin
        .from("entry_shares")
        .select("id,entries!inner(sweepstakes_id)")
        .eq("user_id", user.id)
        .eq("entries.sweepstakes_id", sw.id)
        .limit(1)
        .maybeSingle();
      allowed = !!share;
    }
    return { exists: true, name: sw.name, visibility: "private", gameMode: sw.game_mode, allowed, signedIn: true };
  },
);
