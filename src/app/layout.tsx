import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ax-registry — the credibility layer for MCP servers",
  description:
    "The reliability layer on top of every MCP server: observed adoption, relationships, and re-verifiable public signals. Not another directory.",
};

function SiteNav() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3 text-sm">
        <Link href="/" className="font-semibold tracking-tight">
          ax-registry
        </Link>
        <div className="flex items-center gap-4 text-zinc-600 dark:text-zinc-400">
          <Link href="/scan" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Scan
          </Link>
          <Link href="/catalog" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Catalog
          </Link>
          <Link href="/compare" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Compare
          </Link>
          <Link href="/insights" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Insights
          </Link>
          <Link href="/methodology" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Methodology
          </Link>
          <Link
            href="/claim"
            className="rounded border border-zinc-300 px-2.5 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Claim
          </Link>
        </div>
      </nav>
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteNav />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
