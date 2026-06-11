import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";
import { NavAuth } from "@/components/NavAuth";
import { authConfigured } from "@/auth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ax-registry — the credibility layer for MCP servers",
  description:
    "The reliability layer on top of every MCP server: observed adoption, relationships, and re-verifiable public signals. Not another directory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteNav authSlot={<NavAuth authConfigured={authConfigured} />} />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
