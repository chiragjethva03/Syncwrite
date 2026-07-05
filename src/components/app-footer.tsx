import { siteConfig } from "@/config/site";
import { BrandMark } from "@/components/logo";

/** Inline brand marks (lucide dropped brand icons for trademark reasons). */
function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4" {...props}>
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z" />
    </svg>
  );
}
function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4" {...props}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33 0-3.04-1.85-3.04s-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.8 0 0 .78 0 1.75v20.5C0 23.2.8 24 1.77 24h20.45c.98 0 1.78-.8 1.78-1.75V1.75C24 .78 23.2 0 22.22 0Z" />
    </svg>
  );
}

/**
 * Application footer. Displays the developer's identity + profile links, which
 * is a submission requirement. Content is sourced from config/site.ts.
 */
export function AppFooter() {
  const { developer, name, tagline } = siteConfig;
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <BrandMark className="size-6" />
              <span className="font-semibold tracking-tight text-foreground">{name}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {tagline}. Offline-ready editing, deterministic conflict resolution,
              and version history in a single Next.js app.
            </p>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              Designed &amp; built by{" "}
              <span className="font-medium text-foreground">{developer.name}</span>
            </p>
            <div className="flex items-center gap-4 text-muted-foreground">
              <a
                href={developer.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                aria-label="GitHub profile"
              >
                <GithubIcon /> GitHub
              </a>
              <a
                href={developer.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                aria-label="LinkedIn profile"
              >
                <LinkedinIcon /> LinkedIn
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Next.js 16 · React 19 · TypeScript · Tailwind · Prisma · CRDT sync</p>
          <p>
            © {year} {name}. Built for the House of Edtech assignment.
          </p>
        </div>
      </div>
    </footer>
  );
}
