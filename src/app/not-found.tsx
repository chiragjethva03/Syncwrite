import type { Metadata } from "next";
import { NotFoundContent } from "@/components/not-found-content";

export const metadata: Metadata = { title: "Page not found" };

/** App Router 404 page — rendered inside the root layout (theme + fonts apply). */
export default function NotFound() {
  return <NotFoundContent />;
}
