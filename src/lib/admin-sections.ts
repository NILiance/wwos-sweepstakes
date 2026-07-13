// Client-safe admin permission constants — shared by the server guard
// (admin-guard.ts) and the client user-management UI. No server imports here.

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

export const ALL_SECTIONS: StaffSection[] = [
  "overview",
  "sweepstakes",
  "products",
  "branding",
  "simulator",
  "dataops",
  "payouts",
  "users",
  "settings",
];

/**
 * Superadmin-only areas. A mid-tier admin (role "staff") can never reach these,
 * even if a permission slipped into their record. These control accounts/roles,
 * money, platform config, and brand identity.
 */
export const SUPERADMIN_SECTIONS: StaffSection[] = [
  "users",
  "payouts",
  "settings",
  "branding",
];

/** Areas a mid-tier admin can be granted. */
export const ADMIN_SECTIONS: StaffSection[] = ALL_SECTIONS.filter(
  (s) => !SUPERADMIN_SECTIONS.includes(s),
);

export const SECTION_LABELS: Record<StaffSection, string> = {
  overview: "Overview",
  sweepstakes: "Sweepstakes & Draws",
  products: "Products",
  branding: "Branding",
  simulator: "Simulator",
  dataops: "Data Ops",
  payouts: "Payouts",
  settings: "Settings",
  users: "Users",
};

/** Role values (DB) → human labels. "staff" is a mid-tier admin. */
export const ROLE_LABEL: Record<string, string> = {
  user: "User",
  staff: "Admin",
  admin: "Superadmin",
  commissioner: "Commissioner",
};
