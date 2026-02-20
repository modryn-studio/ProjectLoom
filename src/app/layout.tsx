import type { Metadata } from "next";
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
const ogDescription = 'Branching AI conversations on an infinite canvas. Explore multiple threads simultaneously, merge insights, and never lose a thought. BYOK — your keys, your data.';

export const metadata: Metadata = {
  title: 'ProjectLoom — Branching AI Conversations on an Infinite Canvas',
  description: ogDescription,
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    url: siteUrl,
    title: 'ProjectLoom — Branching AI Conversations on an Infinite Canvas',
    description: ogDescription,
    siteName: 'ProjectLoom',
    images: [
      {
        url: '/banner.png',
        width: 1280,
        height: 320,
        alt: 'ProjectLoom — infinite canvas for branching AI conversations',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ProjectLoom — Branching AI Conversations on an Infinite Canvas',
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
