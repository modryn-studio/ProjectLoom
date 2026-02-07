import type { Metadata } from "next";
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
  title: "ProjectLoom - Visual Canvas for AI Conversations",
  description: "Transform linear AI conversations into spatial, branching project trees. Git for AI conversations.",
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
      </body>
    </html>
  );
}
