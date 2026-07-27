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
  description: "Turn an HVAC plan PDF into a clear markup, airflow and duct-size review, material list, and field-ready print.",
  applicationName: "HVAC Plan Studio",
  keywords: ["HVAC plan reader", "HVAC plan intelligence", "duct plan", "HVAC takeoff", "plan markup"],
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "HVAC Plan Studio",
    description: "A clear five-step plan workspace for HVAC superintendents and one-person businesses.",
    type: "website",
    images: [{
      url: "/hvac-plan-studio-solo-operator-social.png",
      width: 1536,
      height: 1024,
      alt: "An HVAC superintendent marking supply, return, branch, and fresh-air routes on a plan tablet.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HVAC Plan Studio",
    description: "From PDF plan to HVAC markup, materials, and field-ready print.",
    images: ["/hvac-plan-studio-solo-operator-social.png"],
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
