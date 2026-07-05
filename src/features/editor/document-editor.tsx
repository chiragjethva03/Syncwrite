"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { EditorCanvas } from "./editor-canvas";
import { VersionHistoryPanel } from "./version-history-panel";
import { ShareDialog } from "./share-dialog";
import { fetchDocumentBootstrap, renameDocumentApi, type DocumentBootstrap } from "./api";
import { ApiClientError } from "@/lib/api-client";
import {
  ensureLocalDoc,
  getLocalDoc,
  getProseMirrorDoc,
  setLocalTitle,
} from "@/lib/sync/local-store";
import { syncEngine } from "@/lib/sync/sync-engine";
import { toProseMirror } from "@/domain/crdt/document";
import type { ProseMirrorNode } from "@/domain/crdt/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      doc: DocumentBootstrap;
      initialContent: ProseMirrorNode;
      offline: boolean;
    };

/**
 * Editor orchestrator: bootstraps the document (server → local), boots the local
 * editing surface, and handles the OFFLINE-OPEN path (if the network fetch fails
 * but we have a local copy, we open it anyway — the whole point of local-first).
 */
export function DocumentEditor({ documentId }: { documentId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [title, setTitle] = useState("");
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const doc = await fetchDocumentBootstrap(documentId);
        await ensureLocalDoc(documentId, {
          title: doc.title,
          syncDoc: doc.content,
          serverVersion: doc.serverVersion,
        });
        const initialContent =
          (await getProseMirrorDoc(documentId)) ?? toProseMirror(doc.content);
        if (!mounted) return;
        setTitle(doc.title);
        syncEngine.registerDoc(documentId);
        setState({ status: "ready", doc, initialContent, offline: false });
      } catch (error) {
        // Offline (or server error): fall back to the local copy if we have one.
        const local = await getLocalDoc(documentId);
        if (local) {
          const initialContent = toProseMirror(local.syncDoc);
          if (!mounted) return;
          setTitle(local.title);
          syncEngine.registerDoc(documentId);
          setState({
            status: "ready",
            offline: true,
            initialContent,
            doc: {
              id: documentId,
              title: local.title,
              role: "EDITOR",
              serverVersion: local.serverVersion,
              content: local.syncDoc,
              owner: { id: "", name: null, email: null },
              collaborators: [],
            },
          });
          return;
        }
        if (!mounted) return;
        const message =
          error instanceof ApiClientError && error.status === 404
            ? "This document does not exist or you don't have access."
            : "Could not open this document. Check your connection.";
        setState({ status: "error", message });
      }
    })();
    return () => {
      mounted = false;
      syncEngine.unregisterDoc(documentId);
    };
  }, [documentId]);

  function onTitleChange(value: string) {
    setTitle(value);
    void setLocalTitle(documentId, value);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      renameDocumentApi(documentId, value).catch(() => {
        /* offline — will remain local; server updates on next successful rename */
      });
    }, 800);
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" /> Back to dashboard
          </Link>
        </Button>
      </div>
    );
  }

  const { doc, initialContent } = state;
  const canEdit = doc.role !== "VIEWER";
  const isOwner = doc.role === "OWNER";

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur">
        <Button asChild variant="ghost" size="icon" aria-label="Back to dashboard">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={() => title.trim() || onTitleChange("Untitled document")}
          disabled={!canEdit}
          aria-label="Document title"
          className="max-w-xs border-transparent bg-transparent px-2 text-base font-medium shadow-none focus-visible:bg-background focus-visible:ring-1"
        />
        <div className="ml-auto flex items-center gap-2">
          <SyncStatusIndicator />
          <VersionHistoryPanel documentId={documentId} canEdit={canEdit} />
          {isOwner && !state.offline && <ShareDialog doc={doc} />}
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1">
        <EditorCanvas
          documentId={documentId}
          initialContent={initialContent}
          editable={canEdit}
          onApplyTitle={(t) => onTitleChange(t)}
        />
      </main>
    </div>
  );
}
