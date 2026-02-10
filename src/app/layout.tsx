import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "I Say Disco, You Say Party — Painterly Image Filter",
  description: "Transform any image into the oil-painted, cel-shaded aesthetic of Disco Elysium. Face detection, brushstroke simulation, and moody color grading.",
  openGraph: {
    title: "I Say Disco, You Say Party",
    description: "Turn your photos into Disco Elysium paintings",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
