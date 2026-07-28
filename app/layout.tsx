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
    default: "HVAC Plan Studio · Open PDF & Draw",
    template: "%s · HVAC Plan Studio",
  },
  description: "Open a PDF and start drawing immediately, or use guided setup when you want help with plan details.",
  applicationName: "HVAC Plan Studio",
  keywords: ["HVAC plan setup", "HVAC plan reader", "duct plan", "HVAC takeoff", "plan markup"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "HVAC Plan Studio · Open PDF & Draw",
    description: "Open a PDF and start drawing immediately, or use guided setup when you want help with plan details.",
    type: "website",
    images: [{
      url: "/og-v125.png",
      width: 1536,
      height: 1024,
      alt: "HVAC Plan Studio showing direct PDF opening and optional guided setup over an HVAC floor plan.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HVAC Plan Studio · Open PDF & Draw",
    description: "Open a PDF and start drawing immediately, or use guided setup when you want help with plan details.",
    images: ["/og-v125.png"],
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
