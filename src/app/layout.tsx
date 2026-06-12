import type { Metadata } from "next";
import { Geist, Geist_Mono, Yellowtail } from "next/font/google";
import Link from "next/link";
import { AuthNav } from "@/components/auth-nav";
import { getSiteTheme, themeCssOverrides } from "@/lib/theme";
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

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getSiteTheme();
  return {
    title: "Wide World of Sports Sweepstakes",
    description:
      "The best pool ever. One entry, a roster across college and pro football, basketball, hockey, golf and baseball — drawn live, scored all season.",
    ...(theme?.favicon_url ? { icons: { icon: theme.favicon_url } } : {}),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getSiteTheme();
  const cssOverrides = themeCssOverrides(theme?.colors ?? {});

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${script.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {cssOverrides && <style>{cssOverrides}</style>}
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-2">
            <Link href="/" className="flex items-center gap-3">
              {theme?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={theme.logo_url}
                  alt="Wide World of Sports Sweepstakes"
                  className="w-auto"
                  style={{ height: theme.colors.logoHeight ?? 44 }}
                />
              ) : (
                <span className="flex items-baseline gap-2">
                  <span className="brand-script text-3xl text-brand-red">
                    Sports
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-silver">
                    Wide World of · Sweepstakes
                  </span>
                </span>
              )}
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
              Must be of legal age in your jurisdiction. No purchase necessary —
              see official rules per sweepstakes.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
