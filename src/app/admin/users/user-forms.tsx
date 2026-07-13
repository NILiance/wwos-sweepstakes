"use client";

import { useActionState, useState } from "react";
import {
  addUser,
  updateUserRole,
  setUserPassword,
  resendInvite,
  deleteUser,
} from "./actions";

// Grantable (non-superadmin) areas. Users, Payouts, Settings and Branding are
// superadmin-only and are never granted here.
const SECTIONS = [
  ["overview", "Overview"],
  ["sweepstakes", "Sweepstakes & Draws"],
  ["products", "Products"],
  ["simulator", "Simulator"],
  ["dataops", "Data Ops"],
] as const;

const ALL_KEYS = SECTIONS.map(([k]) => k);

function PermissionChecks({ defaults }: { defaults?: string[] }) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(defaults ?? ALL_KEYS),
  );
  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs">
        <span className="font-semibold uppercase tracking-wide text-muted">
          Areas this admin manages
        </span>
        <button
          type="button"
          onClick={() => setChecked(new Set(ALL_KEYS))}
          className="text-info underline hover:text-foreground"
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setChecked(new Set())}
          className="text-info underline hover:text-foreground"
        >
          None
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {SECTIONS.map(([key, label]) => (
          <label key={key} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              name={`perm_${key}`}
              checked={checked.has(key)}
              onChange={() => toggle(key)}
              className="accent-[var(--red-500)]"
            />
            {label}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">
        Superadmin-only areas (Users, Payouts, Settings, Branding) stay locked to
        superadmins.
      </p>
    </div>
  );
}

export function AddUserForm() {
  const [state, formAction, pending] = useActionState(addUser, null);
  const [role, setRole] = useState("user");

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="email@example.com"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          name="display_name"
          type="text"
          required
          placeholder="Display name"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="user">User</option>
          <option value="staff">Admin</option>
          <option value="admin">Superadmin</option>
        </select>
        <input
          name="password"
          type="text"
          placeholder="Password (optional)"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <p className="text-xs text-muted">
        Set a password to share directly, or leave it blank to email them a
        sign-in invite.
      </p>
      {role === "staff" && <PermissionChecks />}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add user"}
      </button>
      {state && (
        <p className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function RoleEditor({
  userId,
  role,
  permissions,
}: {
  userId: string;
  role: string;
  permissions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selRole, setSelRole] = useState(role);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 text-xs text-info underline hover:text-foreground"
      >
        Edit role & permissions
      </button>
    );
  }

  return (
    <form
      action={updateUserRole}
      className="mt-3 space-y-3 rounded-md bg-surface-raised p-4"
    >
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="role"
        value={selRole}
        onChange={(e) => setSelRole(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
      >
        <option value="user">User</option>
        <option value="staff">Admin</option>
        <option value="admin">Superadmin</option>
      </select>
      {selRole === "staff" && <PermissionChecks defaults={permissions} />}
      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function UserActions({
  userId,
  email,
  displayName,
  isSelf,
}: {
  userId: string;
  email: string;
  displayName: string;
  isSelf: boolean;
}) {
  const [pwState, pwAction, pwPending] = useActionState(setUserPassword, null);
  const [invState, invAction, invPending] = useActionState(resendInvite, null);
  const [delState, delAction, delPending] = useActionState(deleteUser, null);
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          onClick={() => setShowPw(!showPw)}
          className="text-info underline hover:text-foreground"
        >
          Set password
        </button>
        <form action={invAction} className="inline">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="display_name" value={displayName} />
          <button
            disabled={invPending}
            className="text-info underline hover:text-foreground disabled:opacity-50"
          >
            {invPending ? "Sending…" : "Resend invite"}
          </button>
        </form>
        {!isSelf && (
          <form
            action={delAction}
            className="inline"
            onSubmit={(e) => {
              if (!confirm(`Delete ${displayName}? This cannot be undone.`))
                e.preventDefault();
            }}
          >
            <input type="hidden" name="user_id" value={userId} />
            <button
              disabled={delPending}
              className="text-brand-red underline hover:text-foreground disabled:opacity-50"
            >
              {delPending ? "Deleting…" : "Delete"}
            </button>
          </form>
        )}
      </div>

      {showPw && (
        <form action={pwAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="user_id" value={userId} />
          <input
            name="password"
            type="text"
            placeholder="New password (min 8)"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
          <button
            disabled={pwPending}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {pwPending ? "Saving…" : "Save password"}
          </button>
        </form>
      )}

      {[pwState, invState, delState]
        .filter(Boolean)
        .map((s, i) => (
          <p
            key={i}
            className={`text-xs ${s!.ok ? "text-info" : "text-brand-red"}`}
          >
            {s!.message}
          </p>
        ))}
    </div>
  );
}
