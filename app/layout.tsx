import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SupabaseAuthProvider } from "../src/contexts/SupabaseAuthContext";
import { I18nProvider } from "../src/contexts/I18nProvider";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "66Do - Domain Investment Platform",
  description: "Professional domain investment management tools to help you track domain portfolios, monitor renewals, and maximize returns",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>
          <SupabaseAuthProvider>
            {children}
          </SupabaseAuthProvider>
        </I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}
