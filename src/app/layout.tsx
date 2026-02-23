import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://projectloom.space';
// 57 chars — within 50-60 optimal range
const ogTitle = 'ProjectLoom — Branching AI Conversations, Infinite Canvas';
// 134 chars — within 110-160 optimal range
const ogDescription = 'Split any AI conversation into different directions, explore them side by side, and combine the best parts — all on one visual canvas.';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: ogTitle,
  description: ogDescription,
  metadataBase: new URL(siteUrl),
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    url: siteUrl,
    title: ogTitle,
    description: ogDescription,
    siteName: 'ProjectLoom',
    images: [
      {
        url: '/banner.png',
        width: 1280,
        height: 320,
        alt: 'ProjectLoom — branching AI conversations on an infinite canvas',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: ogTitle,
    description: ogDescription,
    images: ['/banner.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'ProjectLoom',
              applicationCategory: 'ProductivityApplication',
              operatingSystem: 'Web',
              url: siteUrl,
              description: 'Split any AI conversation into different directions, explore them side by side, and combine the best parts — all on one visual canvas.',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              creator: {
                '@type': 'Organization',
                name: 'Modryn Studio',
                url: 'https://modrynstudio.com',
              },
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('projectloom:preferences');
                  if (stored) {
                    const prefs = JSON.parse(stored);
                    const theme = prefs?.data?.ui?.theme || 'system';
                    if (theme !== 'system') {
                      document.documentElement.setAttribute('data-theme', theme);
                    }
                  }
                } catch (e) {
                  // Ignore errors
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-bg-primary text-fg-primary`}
      >
        {children}
        <Analytics />
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script
              id="ga-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');`,
              }}
            />
          </>
        )}
      </body>
    </html>
  );
}
