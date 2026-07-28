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
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "HVAC Plan Studio · Simple Job Workflow",
    description: "One job. One clear next step.",
    type: "website",
    images: [{
      url: "/og-v121.png",
      width: 1717,
      height: 916,
      alt: "HVAC Plan Studio showing one five-step job workflow over a connected HVAC plan.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "HVAC Plan Studio · Simple Job Workflow",
    description: "One job. One clear next step.",
    images: ["/og-v121.png"],
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
