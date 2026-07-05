/**
 * Central application + developer configuration.
 *
 * The footer developer identity lives here (single source of truth) so it can
 * be rendered anywhere without hard-coding strings across the UI. Fill in your
 * real details before submitting — these are the values the assignment requires
 * in the footer.
 */
export const siteConfig = {
  name: "Syncwrite",
  tagline: "Local-first collaborative document editor",
  description:
    "A local-first, offline-capable collaborative editor with a background sync engine, deterministic conflict resolution, and granular version history.",
  /** Developer identity rendered in the application footer (submission requirement). */
  developer: {
    name: "Chirag Jethva",
    github: "https://github.com/chiragjethva03",
    linkedin: "https://www.linkedin.com/in/jethvachirag23/",
  },
} as const;

export type SiteConfig = typeof siteConfig;
