import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SupabaseAuthProvider } from "../src/contexts/SupabaseAuthContext";
import { I18nProvider } from "../src/contexts/I18nProvider";
import { Analytics } from "@vercel/analytics/next";
import { getHomeDictionary, resolveHomeLocale } from "../src/i18n/homeDictionary";
import { getSiteUrl } from "../src/lib/siteUrl";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Default OG image — 612×408 (the only branded asset we have today). Below
// the 1200×630 ideal, but having one beats having none for FB / LinkedIn /
// Slack unfurls. Listed in metadata so per-page generateMetadata that
// doesn't override openGraph.images inherits this fallback.
const OG_IMAGE = {
  url: "/domainfinancialpng.png",
  width: 612,
  height: 408,
  alt: "Domain.Financial",
} as const;

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: "Domain.Financial – Track & Grow Your Domains",
  description: "Professional domain investment management tools to help you track domain portfolios, monitor renewals, and maximize returns",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Domain.Financial",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    images: [OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d9488", // teal-600 — matches CTA + primary accent
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language");
  const pathLocale = headersList.get("x-path-locale");
  const locale =
    pathLocale === "zh" || pathLocale === "en"
      ? pathLocale
      : resolveHomeLocale(cookieStore, acceptLanguage);
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
