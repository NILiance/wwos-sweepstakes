import type { Metadata } from "next";
import { Geist, Geist_Mono, Yellowtail } from "next/font/google";
import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Retro athletic script for brand moments only (SCOPE.md Appendix D)
const script = Yellowtail({
  variable: "--font-script",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wide World of Sports Sweepstakes",
  description:
    "The best pool ever. One entry, a roster across CFB, NFL, NBA, NHL, CBB, golf and MLB — drawn live, scored all season.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${script.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="brand-script text-3xl text-brand-red">
                Sports
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-silver">
                Wide World of · Sweepstakes
              </span>
            </Link>
            <div className="flex items-center gap-6 text-sm font-medium">
              <Link href="/browse" className="text-muted hover:text-foreground">
                Browse Pools
              </Link>
              <Link
                href="/dashboard"
                className="text-muted hover:text-foreground"
              >
                My Entries
              </Link>
              <AuthNav />
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="brand-ring mt-16 bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted">
            <p>
              © {new Date().getFullYear()} Wide World of Sports Sweepstakes.
            </p>
            <p>
              Must be of legal age in your jurisdiction. See official rules per
              sweepstakes.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
