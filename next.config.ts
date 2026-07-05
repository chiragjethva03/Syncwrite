import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * These are the framework-native equivalent of Helmet (which targets Express).
 * In a Next.js app the correct place for these is `headers()` / the response
 * layer, not an Express middleware. We set a conservative baseline: disable
 * MIME sniffing, deny framing (clickjacking), restrict referrer + permissions,
 * and enable HSTS in production.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Produce a self-contained server bundle for a slim Docker image.
  output: "standalone",
  // Prisma must stay external to the server bundle (native engine).
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The service worker must never be cached, so clients always pick up a
        // new version on the next visit.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
