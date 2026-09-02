import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "./service-worker-registration";

// `next/font` downloads these at build time and serves them from this origin. Verified in
// the build output: ten woff2 files under `.next/static/media`, and no reference to
// fonts.googleapis.com or fonts.gstatic.com anywhere in it. That matters twice over —
// CLAUDE.md forbids CDN-hosted fonts, and a font fetched at runtime would not be in the
// service worker's precache and would fail offline.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fieldnote",
  description: "Field capture and follow-up drafting, local to this device.",
};

/**
 * `viewportFit: "cover"` lets the capture dock sit against the bottom edge on a device
 * with a home indicator, with the safe-area inset handled in CSS rather than by leaving a
 * permanent gap.
 *
 * There is deliberately no `maximumScale`. Locking the scale is the usual way to stop iOS
 * zooming when a field takes focus, but it also disables pinch zoom for everyone, which
 * fails WCAG 1.4.4. It is also unnecessary here: iOS only zooms on focus when the field's
 * type is below 16px, and the note textarea and every other input in the capture surface
 * are set at 16px for exactly that reason. The type size solves the problem the scale lock
 * was reaching for, without taking zoom away from someone who needs it.
 */
export const viewport: Viewport = {
  themeColor: "#1e293b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
