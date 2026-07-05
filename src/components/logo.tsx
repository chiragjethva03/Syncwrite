import { cn } from "@/lib/utils";

/**
 * Syncwrite brand mark — a document (the thing you write) with a live "synced"
 * node (the thing that makes this app special). Solid, scalable, and readable
 * down to favicon sizes. The green node echoes the app's "all changes saved"
 * status color, tying the identity to the product's core promise.
 *
 * The gradient id is fixed; multiple identical instances resolving to the same
 * def render correctly, so this stays a pure (server-renderable) component.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("size-7", className)}
      role="img"
      aria-label="Syncwrite"
    >
      <defs>
        <linearGradient id="syncwrite-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b6cff" />
          <stop offset="1" stopColor="#5b8def" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#syncwrite-mark)" />
      <path
        d="M168 116h116l76 76v206a22 22 0 0 1-22 22H168a22 22 0 0 1-22-22V138a22 22 0 0 1 22-22Z"
        fill="#ffffff"
      />
      <path d="M284 116v54a22 22 0 0 0 22 22h54Z" fill="#cdd9ff" />
      <rect x="190" y="252" width="132" height="24" rx="12" fill="#7c5cff" />
      <rect x="190" y="302" width="96" height="24" rx="12" fill="#b9a8ff" />
      <circle cx="356" cy="360" r="36" fill="#34d399" stroke="#ffffff" strokeWidth="14" />
    </svg>
  );
}

/**
 * Full logo lockup (mark + wordmark), used consistently across the landing,
 * auth, and app-shell headers so the brand reads the same everywhere.
 */
export function Logo({
  className,
  markClassName,
  textClassName,
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandMark className={cn("size-7", markClassName)} />
      <span className={cn("text-lg font-semibold tracking-tight", textClassName)}>
        Syncwrite
      </span>
    </span>
  );
}
