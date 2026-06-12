"use client";

import { useActionState, useState } from "react";
import { addUser, updateUserRole } from "./actions";

const SECTIONS = [
  ["overview", "Overview"],
  ["sweepstakes", "Sweepstakes & Draws"],
  ["products", "Products"],
  ["branding", "Branding"],
  ["simulator", "Simulator"],
  ["dataops", "Data Ops"],
  ["users", "Users"],
] as const;

function PermissionChecks({
  name,
  defaults,
}: {
  name?: string;
  defaults?: string[];
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {SECTIONS.map(([key, label]) => (
        <label key={key} className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            name={`perm_${key}`}
            defaultChecked={defaults?.includes(key)}
            className="accent-[var(--red-500)]"
          />
          {label}
        </label>
      ))}
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
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </div>
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
        <option value="staff">Staff</option>
        <option value="admin">Admin</option>
      </select>
      {selRole === "staff" && (
        <PermissionChecks name="perm" defaults={permissions} />
      )}
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
