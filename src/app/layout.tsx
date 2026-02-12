import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "I Say Disco, You Say Party — Painterly Image Filter",
  description: "Transform any image into the oil-painted, cel-shaded aesthetic. Face detection, brushstroke simulation, and moody color grading.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Disco Party",
  },
  openGraph: {
    title: "I Say Disco, You Say Party",
    description: "Turn your photos into oil-painted, cel-shaded images",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1611",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
