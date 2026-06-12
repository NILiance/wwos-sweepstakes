"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "magic";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();

    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${location.origin}/auth/callback?next=${next}` },
        });
        if (error) throw error;
        setMessage("Check your email for a sign-in link.");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split("@")[0] },
            emailRedirectTo: `${location.origin}/auth/callback?next=${next}`,
          },
        });
        if (error) throw error;
        setMessage("Account created — check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-3xl font-bold">
        {mode === "signup" ? "Create your account" : "Sign in"}
      </h1>
      <p className="mt-2 text-center text-sm text-muted">
        {mode === "signup"
          ? "Join the pool. Your display name shows in standings and smack talk."
          : "Welcome back to the Wide World of Sports."}
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-4 rounded-lg border border-border bg-surface p-6"
      >
        {mode === "signup" && (
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Dustin/JB"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info"
          />
        </div>
        {mode !== "magic" && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-info"
            />
          </div>
        )}

        {error && <p className="text-sm text-brand-red">{error}</p>}
        {message && <p className="text-sm text-info">{message}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {busy
            ? "Working…"
            : mode === "signup"
              ? "Create account"
              : mode === "magic"
                ? "Email me a sign-in link"
                : "Sign in"}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted">
        {mode !== "signin" && (
          <button onClick={() => setMode("signin")} className="hover:text-foreground">
            Have an account? Sign in
          </button>
        )}
        {mode !== "signup" && (
          <button onClick={() => setMode("signup")} className="hover:text-foreground">
            New here? Create an account
          </button>
        )}
        {mode !== "magic" && (
          <button onClick={() => setMode("magic")} className="hover:text-foreground">
            Email me a sign-in link instead
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
