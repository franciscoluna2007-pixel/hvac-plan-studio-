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
      alt: "HVAC Plan Studio framing a mechanical source plan on a galvanized daylight workbench",
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
          data-impeccable-direction="material-cobalt"
          dangerouslySetInnerHTML={{
            __html: "<!-- THESIS: the source plan remains the work while calm Material chrome makes daily drafting faster to read. OWN-WORLD: cool-neutral surfaces, exact plan white, disciplined cobalt, precise type, shallow functional depth. STORY: Open Plan, Draw HVAC, Materials, Export; Plan Check remains compact and optional. FIRST VIEWPORT: premium job bar, segmented workflow, dominant plan, progressive tool and detail surfaces. FORM: selected Traverse Material direction, presentation-only over frozen behavior. FINISH: coherent desktop, tablet, and mobile production UI. -->",
          }}
        />
        {children}
      </body>
    </html>
  );
}
