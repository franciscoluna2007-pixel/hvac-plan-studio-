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
    default: "HVAC Plan Studio · Draw-First Detail Workflow",
    template: "%s · HVAC Plan Studio",
  },
  description: "Draw routes first. Add numbers, reviewed sizes, returns, and connections in order.",
  applicationName: "HVAC Plan Studio",
  keywords: ["HVAC plan setup", "HVAC plan reader", "duct plan", "HVAC takeoff", "plan markup"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "HVAC Plan Studio · Draw-First Detail Workflow",
    description: "Draw routes first. Add numbers, reviewed sizes, returns, and connections in order.",
    type: "website",
    images: [{
      url: "/og-v122.png",
      width: 1717,
      height: 916,
      alt: "HVAC Plan Studio showing the Smart Scale and Draw-First workflow over an HVAC plan.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HVAC Plan Studio · Draw-First Detail Workflow",
    description: "Draw routes first. Add numbers, reviewed sizes, returns, and connections in order.",
    images: ["/og-v122.png"],
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
