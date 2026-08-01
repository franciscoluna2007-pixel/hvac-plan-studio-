import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const patternCondensed = localFont({
  src: [
    {
      path: "./fonts/BarlowCondensed-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/BarlowCondensed-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/BarlowCondensed-ExtraBold.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-pattern-condensed",
  display: "swap",
  preload: true,
  fallback: ["Arial Narrow", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://hvac-plan-studio.franciscoluna2007.chatgpt.site"),
  title: {
    default: "HVAC Plan Studio · Draw & Detail",
    template: "%s · HVAC Plan Studio",
  },
  description: "Plan, route, review, redline, and issue controlled HVAC work directly over the source PDF.",
  applicationName: "HVAC Plan Studio",
  keywords: ["HVAC plan setup", "HVAC plan reader", "duct plan", "HVAC takeoff", "plan markup"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "HVAC Plan Studio · Draw & Detail",
    description: "Plan, route, review, redline, and issue controlled HVAC work directly over the source PDF.",
    type: "website",
    images: [{
      url: "/og.png",
      width: 1728,
      height: 908,
      alt: "HVAC Plan Studio framing a mechanical source plan on a measured layout table",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HVAC Plan Studio · Draw & Detail",
    description: "Plan, route, review, redline, and issue controlled HVAC work directly over the source PDF.",
    images: ["/og.png"],
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
        className={`${geistSans.variable} ${geistMono.variable} ${patternCondensed.variable} antialiased`}
      >
        <template
          data-impeccable-direction="patternmakers-layout-table"
          dangerouslySetInnerHTML={{
            __html: "<!-- THESIS: the source plan is an open patternmaking surface, not a dashboard. OWN-WORLD: kraft, chalk paper, graphite, Prussian blue, brick red, zinc trays, steel rules. STORY: open, draw, inspect, advance. FIRST VIEWPORT: identity plate, measured worktable, ledger inspector, bottom traveler. FORM: user-pinned direction, decision ef99ff31. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md -->",
          }}
        />
        {children}
      </body>
    </html>
  );
}
