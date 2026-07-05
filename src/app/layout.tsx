import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { siteConfig } from "@/config/site";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  // Enables the installable/offline PWA (manifest lives in app/manifest.ts).
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: siteConfig.name },
};

export const viewport: Viewport = {
  themeColor: "#7c5cff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <AppProviders>{children}</AppProviders>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
