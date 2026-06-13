import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffSection =
  | "overview"
  | "sweepstakes"
  | "products"
  | "branding"
  | "simulator"
  | "dataops"
  | "payouts"
  | "settings"
  | "users";

export type StaffContext = {
  userId: string;
  role: "staff" | "admin";
  permissions: StaffSection[];
};

/** Sections a staff context can see (admins see everything). */
export function allowedSections(ctx: StaffContext): StaffSection[] {
  if (ctx.role === "admin") {
    return ["overview", "sweepstakes", "products", "branding", "simulator", "dataops", "payouts", "users", "settings"];
  }
  return ctx.permissions;
}

/**
 * Server-side backend gate. Admins pass everything; staff need the section
 * in their permissions. Others get redirected.
 */
export async function requireStaff(
  section?: StaffSection,
): Promise<StaffContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  // select(*) keeps this working before/after the role migration lands
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const role: string =
    profile?.role ?? (profile?.is_admin ? "admin" : "user");
  if (role !== "admin" && role !== "staff") redirect("/");

  const permissions = (
    Array.isArray(profile?.permissions) ? profile!.permissions : []
  ) as StaffSection[];

  const ctx: StaffContext = { userId: user.id, role, permissions };
  if (section && role !== "admin" && !permissions.includes(section)) {
    redirect("/admin");
  }
  return ctx;
}

/** Full-admin-only gate (user management, destructive ops). */
export async function requireAdmin(): Promise<string> {
  const ctx = await requireStaff();
  if (ctx.role !== "admin") redirect("/admin");
  return ctx.userId;
}
