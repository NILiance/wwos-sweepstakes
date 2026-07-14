"use client";

import { useActionState, useState } from "react";
import {
  addLeagueEntrant,
  recordPayment,
  updateLeagueMember,
  removeLeagueMember,
  messageMembers,
  inviteMember,
} from "@/app/commissioner/actions";
import { setStatus } from "@/app/admin/sweepstakes/actions";

const STATUSES = ["draft", "enrolling", "full", "drawing", "active", "completed", "archived"];
const field =
  "rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-info";

export function StatusControl({
  sweepstakesId,
  status,
}: {
  sweepstakesId: string;
  status: string;
}) {
  return (
    <form action={setStatus} className="flex items-center gap-2 text-sm">
      <input type="hidden" name="id" value={sweepstakesId} />
      <span className="text-muted">Status:</span>
      <select name="status" defaultValue={status} className={field}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-raised">
        Update
      </button>
    </form>
  );
}

export function MemberForm({ sweepstakesId }: { sweepstakesId: string }) {
  const [state, formAction, pending] = useActionState(addLeagueEntrant, null);
  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2">
      <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
      <input name="display_name" required placeholder="Member name" className={field} />
      <input name="email" type="email" placeholder="Email (optional)" className={field} />
      <input name="phone" placeholder="Phone (optional)" className={`${field} w-32`} />
      <button
        disabled={pending}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add member"}
      </button>
      {state && (
        <span className={`w-full text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}

export function MemberRow({
  sweepstakesId,
  member,
}: {
  sweepstakesId: string;
  member: { id: string; name: string; email: string | null; phone: string | null };
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateLeagueMember, null);
  const [invState, invAction, invPending] = useActionState(inviteMember, null);

  if (editing) {
    return (
      <form
        action={formAction}
        className="flex flex-wrap items-center gap-2 py-2"
        onSubmit={() => setTimeout(() => setEditing(false), 50)}
      >
        <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
        <input type="hidden" name="entry_id" value={member.id} />
        <input name="display_name" required defaultValue={member.name} className={field} />
        <input name="email" type="email" defaultValue={member.email ?? ""} placeholder="Email" className={field} />
        <input name="phone" defaultValue={member.phone ?? ""} placeholder="Phone" className={`${field} w-28`} />
        <button
          disabled={pending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
        {state && !state.ok && (
          <span className="text-sm text-brand-red">{state.message}</span>
        )}
      </form>
    );
  }

  return (
    <div className="py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-semibold">{member.name}</span>
          {member.email && <span className="ml-2 text-muted">{member.email}</span>}
          {member.phone && <span className="ml-2 text-muted">{member.phone}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {member.email && (
            <form action={invAction}>
              <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
              <input type="hidden" name="entry_id" value={member.id} />
              <button
                disabled={invPending}
                className="text-xs font-semibold text-info hover:underline disabled:opacity-50"
              >
                {invPending ? "Inviting…" : "Invite"}
              </button>
            </form>
          )}
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-info hover:underline"
          >
            Edit
          </button>
          <form action={removeLeagueMember}>
            <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
            <input type="hidden" name="entry_id" value={member.id} />
            <button className="text-xs font-semibold text-brand-red hover:underline">
              Remove
            </button>
          </form>
        </div>
      </div>
      {invState && (
        <p className={`mt-1 text-xs ${invState.ok ? "text-info" : "text-brand-red"}`}>
          {invState.message}
        </p>
      )}
    </div>
  );
}

export function PaymentForm({
  sweepstakesId,
  entrants,
}: {
  sweepstakesId: string;
  entrants: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(recordPayment, null);
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
      <input name="payer_name" required placeholder="Who paid" className={field} />
      <input name="amount" type="number" min={0} step="0.01" placeholder="$" className={`${field} w-24`} />
      <input name="method" placeholder="Venmo / cash…" className={`${field} w-32`} />
      <select name="entry_id" className={field} defaultValue="">
        <option value="">— link member —</option>
        {entrants.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <select name="status" className={field} defaultValue="received">
        <option value="received">received</option>
        <option value="pending">pending</option>
        <option value="refunded">refunded</option>
      </select>
      <button
        disabled={pending}
        className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Saving…" : "Log payment"}
      </button>
      {state && (
        <span className={`w-full text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}

export function MessageForm({
  sweepstakesId,
  withEmail,
}: {
  sweepstakesId: string;
  withEmail: number;
}) {
  const [state, formAction, pending] = useActionState(messageMembers, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="sweepstakes_id" value={sweepstakesId} />
      <p className="text-xs text-muted">
        Emails the {withEmail} member{withEmail === 1 ? "" : "s"} with an address
        on file. Add emails on the Members tab to reach more.
      </p>
      <input
        name="subject"
        required
        placeholder="Subject"
        className={`${field} w-full`}
      />
      <textarea
        name="body"
        required
        rows={5}
        placeholder="Write your message to the league…"
        className={`${field} w-full`}
      />
      <button
        disabled={pending || withEmail === 0}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send to members"}
      </button>
      {state && (
        <p className={`text-sm ${state.ok ? "text-info" : "text-brand-red"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
