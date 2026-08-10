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
  title: "NewsFlash",
  description: "실시간 뉴스, 속보 및 경제 지표 알림 서비스",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NewsFlash",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "NewsFlash",
    description: "실시간 뉴스, 속보 및 경제 지표 알림 서비스",
    images: [{ url: "/og-cover.png", width: 1200, height: 630, alt: "NewsFlash LIVE NEWS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NewsFlash",
    description: "실시간 뉴스, 속보 및 경제 지표 알림 서비스",
    images: ["/og-cover.png"],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
