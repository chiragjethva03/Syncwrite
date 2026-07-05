"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useLiveQuery } from "dexie-react-hooks";
import { buildExtensions } from "./extensions";
import { EditorToolbar } from "./editor-toolbar";
import { applyEditorChange, getLocalDoc } from "@/lib/sync/local-store";
import { toProseMirror } from "@/domain/crdt/document";
import { syncEngine } from "@/lib/sync/sync-engine";
import type { ProseMirrorNode } from "@/domain/crdt/types";

const AUTOSAVE_MS = 600;

/**
 * The editing surface. Two data flows meet here:
 *  1. LOCAL edits → debounced → `applyEditorChange` (writes IndexedDB + queues a
 *     sync op) → `syncEngine.kick()`. The network is never on the typing path.
 *  2. REMOTE changes → observed via a Dexie live query → projected back into the
 *     editor when the user isn't actively typing, so a collaborator's edits
 *     appear without stealing the caret. (Caret-preserving live merge is noted
 *     as a future enhancement in the docs.)
 */
export function EditorCanvas({
  documentId,
  initialContent,
  editable,
  onApplyTitle,
}: {
  documentId: string;
  initialContent: ProseMirrorNode;
  editable: boolean;
  onApplyTitle?: (title: string) => void;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDoc = useRef<ProseMirrorNode | null>(null);
  const lastKnown = useRef<string>(JSON.stringify(initialContent));

  const flush = async () => {
    if (!pendingDoc.current) return;
    const doc = pendingDoc.current;
    pendingDoc.current = null;
    lastKnown.current = JSON.stringify(doc);
    await applyEditorChange(documentId, doc);
    syncEngine.kick();
  };

  const editor = useEditor({
    editable,
    immediatelyRender: false,
    extensions: buildExtensions("Start writing… (works offline)"),
    content: initialContent as never,
    editorProps: {
      attributes: {
        class: "prose-editor mx-auto w-full max-w-3xl px-4 py-8",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Document editor",
      },
    },
    onUpdate: ({ editor }) => {
      pendingDoc.current = editor.getJSON() as ProseMirrorNode;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
  });

  // Persist any pending edit when leaving the page.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Observe the local record for REMOTE changes and reflect them when idle.
  const localDoc = useLiveQuery(() => getLocalDoc(documentId), [documentId]);
  useEffect(() => {
    // Never re-project while the user is editing (focused) or has an unsaved
    // local edit in flight — setContent would reset the caret/selection to the
    // document start, making toolbar commands land on the wrong line.
    if (!editor || !localDoc || editor.isFocused || pendingDoc.current) return;
    const projected = toProseMirror(localDoc.syncDoc);
    const projectedStr = JSON.stringify(projected);
    if (projectedStr === lastKnown.current) return;
    lastKnown.current = projectedStr;
    editor.commands.setContent(projected as never, { emitUpdate: false });
  }, [editor, localDoc]);

  if (!editor) {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-muted-foreground">Loading editor…</div>;
  }

  return (
    <div className="flex flex-col">
      {editable && (
        <EditorToolbar
          editor={editor}
          documentId={documentId}
          disabled={!editable}
          onApplyTitle={onApplyTitle}
        />
      )}
      {!editable && (
        <div className="border-b bg-muted/40 px-4 py-2 text-center text-xs text-muted-foreground">
          You have view-only access. Editing and syncing are disabled.
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
