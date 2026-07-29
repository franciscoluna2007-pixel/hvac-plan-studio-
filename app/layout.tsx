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
    default: "HVAC Plan Studio · Field Redline Studio",
    template: "%s · HVAC Plan Studio",
  },
  description: "Draw source-bound field redlines, organize review notes, and export a clear marked-up plan without changing the approved HVAC design.",
  applicationName: "HVAC Plan Studio",
  keywords: ["HVAC plan setup", "HVAC plan reader", "duct plan", "HVAC takeoff", "plan markup"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "HVAC Plan Studio · Field Redline Studio",
    description: "Draw source-bound field redlines, organize review notes, and export a clear marked-up plan without changing the approved HVAC design.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "HVAC Plan Studio · Field Redline Studio",
    description: "Draw source-bound field redlines, organize review notes, and export a clear marked-up plan without changing the approved HVAC design.",
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
