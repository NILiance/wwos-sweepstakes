import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, cta, SITE } from "@/lib/email";

/**
 * Find an existing auth user by email, or create a standard (role "user")
 * account. Never elevates an existing user. Returns the user id, or null.
 */
export async function getOrCreateUserId(
  email: string,
  displayName: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (!error && created?.user) return created.user.id;

  // Already registered — look them up (listUsers is paginated; scan first page)
  const { data: list } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const found = list?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  return found?.id ?? null;
}

/** Email a branded magic sign-in link. Bypasses the demo skip-list. */
export async function sendMagicInvite(
  email: string,
  opts: {
    subject: string;
    title: string;
    introHtml: string;
    ctaLabel?: string;
    next?: string;
  },
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const token = link?.properties?.hashed_token;
  const next = opts.next ?? "/dashboard";
  const url = token
    ? `${SITE}/auth/confirm?token_hash=${token}&type=magiclink&next=${encodeURIComponent(next)}`
    : `${SITE}/login`;
  return sendEmail(
    email,
    opts.subject,
    opts.title,
    opts.introHtml + cta(url, opts.ctaLabel ?? "Sign in"),
    { force: true },
  );
}
