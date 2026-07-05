import type { Role } from "@prisma/client";

/** Shared client-facing DTOs (shapes returned by the REST API). */

export interface UserSummary {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface CollaboratorDTO {
  role: Role;
  user: UserSummary;
}

export interface DocumentListItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  serverVersion: number;
  owner: UserSummary;
  collaborators: CollaboratorDTO[];
}

export interface VersionDTO {
  id: string;
  versionNumber: number;
  label: string | null;
  origin: "SNAPSHOT" | "RESTORE" | "AUTO";
  restoredFromId: string | null;
  createdAt: string;
  createdBy: { id: string; name: string | null; email: string | null };
}

export type AiActionName =
  | "summarize"
  | "grammar"
  | "improve"
  | "title"
  | "continue";
