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
  metadataBase: new URL("https://hvac-plan-studio.franciscoluna2007.chatgpt.site"),
  title: {
    default: "HVAC Plan Studio · Markup Assistant Fixes 2.0",
    template: "%s · HVAC Plan Studio",
  },
  description: "See what to fix first, preview the exact change, and approve safe HVAC plan repairs with one Undo.",
  applicationName: "HVAC Plan Studio",
  keywords: ["HVAC plan setup", "HVAC plan reader", "duct plan", "HVAC takeoff", "plan markup"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "HVAC Plan Studio · Markup Assistant Fixes 2.0",
    description: "See what to fix first, preview the exact change, and approve safe HVAC plan repairs with one Undo.",
    type: "website",
    images: [{
      url: "/og-v123.png",
      width: 1536,
      height: 1024,
      alt: "HVAC Plan Studio showing prioritized plan problems and an exact before-and-after repair preview.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HVAC Plan Studio · Markup Assistant Fixes 2.0",
    description: "See what to fix first, preview the exact change, and approve safe HVAC plan repairs with one Undo.",
    images: ["/og-v123.png"],
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
        {children}
      </body>
    </html>
  );
}
