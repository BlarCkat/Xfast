import type { Metadata, Viewport } from "next";
import { GeistPixelCircle } from "geist/font/pixel";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roadmasters",
  description: "An endless voxel road-crossing hopper.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistPixelCircle.variable}>
      <body>{children}</body>
    </html>
  );
}
