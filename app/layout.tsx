import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/app/components/top-nav";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WuSphere | AI Growth Platform",
  description: "AI-inspired member platform with Supabase auth, leveling, and gated content.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${monoFont.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
