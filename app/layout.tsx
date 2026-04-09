import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SupabaseAuthProvider } from "../src/contexts/SupabaseAuthContext";
import { I18nProvider } from "../src/contexts/I18nProvider";
import { Analytics } from "@vercel/analytics/next";
import { getHomeDictionary, resolveHomeLocale } from "../src/i18n/homeDictionary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Domain.Financial – Track & Grow Your Domains",
  description: "Professional domain investment management tools to help you track domain portfolios, monitor renewals, and maximize returns",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const acceptLanguage = (await headers()).get("accept-language");
  const locale = resolveHomeLocale(cookieStore, acceptLanguage);
  const { htmlLang } = getHomeDictionary(locale);

  return (
    <html lang={htmlLang}>
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
