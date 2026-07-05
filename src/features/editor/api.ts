import { apiFetch } from "@/lib/api-client";
import type { SyncDoc } from "@/domain/crdt/types";
import type { AiActionName, VersionDTO } from "@/types/dto";
import type { Role } from "@prisma/client";

export interface DocumentBootstrap {
  id: string;
  title: string;
  role: Role;
  serverVersion: number;
  content: SyncDoc;
  owner: { id: string; name: string | null; email: string | null };
  collaborators: { role: Role; user: { id: string; name: string | null; email: string | null } }[];
}

export function fetchDocumentBootstrap(id: string) {
  return apiFetch<DocumentBootstrap>(`/api/documents/${id}`);
}

export function renameDocumentApi(id: string, title: string) {
  return apiFetch(`/api/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function listVersionsApi(id: string) {
  return apiFetch<VersionDTO[]>(`/api/documents/${id}/versions`);
}

export function snapshotApi(id: string, label?: string) {
  return apiFetch<{ id: string; versionNumber: number }>(
    `/api/documents/${id}/versions`,
    { method: "POST", body: JSON.stringify({ label }) },
  );
}

export function restoreVersionApi(id: string, versionId: string) {
  return apiFetch<{ serverVersion: number }>(
    `/api/documents/${id}/versions/${versionId}/restore`,
    { method: "POST" },
  );
}

export function addCollaboratorApi(id: string, email: string, role: "EDITOR" | "VIEWER") {
  return apiFetch(`/api/documents/${id}/collaborators`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export function runAiApi(id: string, action: AiActionName, text: string) {
  return apiFetch<{ action: AiActionName; result: string }>(`/api/ai`, {
    method: "POST",
    body: JSON.stringify({ documentId: id, action, text }),
  });
}
