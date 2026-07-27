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
    default: "HVAC Plan Studio",
    template: "%s · HVAC Plan Studio",
  },
  description: "Read an HVAC plan, confirm scale and room information, find problems, and approve safe markup repairs.",
  applicationName: "HVAC Plan Studio",
  keywords: ["HVAC plan setup", "HVAC plan reader", "duct plan", "HVAC takeoff", "plan markup"],
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "HVAC Plan Studio · Smart Plan Setup & Repair",
    description: "Read the plan. Find what’s missing. Fix with approval.",
    type: "website",
    images: [{
      url: "/og.png",
      width: 1731,
      height: 909,
      alt: "HVAC Plan Studio v120 showing a connected supply-and-return system over a floor plan.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HVAC Plan Studio · Smart Plan Setup & Repair",
    description: "Read the plan. Find what’s missing. Fix with approval.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
