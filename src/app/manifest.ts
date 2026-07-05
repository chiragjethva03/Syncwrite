import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * Web app manifest (Next.js App Router native). Makes the app installable and,
 * together with the service worker (public/sw.js), enables an offline-capable
 * PWA: the app shell is cached so a full reload works with no network.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} — ${siteConfig.tagline}`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#7c5cff",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "maskable" },
    ],
  };
}
