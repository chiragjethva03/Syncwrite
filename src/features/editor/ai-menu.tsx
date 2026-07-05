"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Sparkles, Loader2, FileText, SpellCheck, Wand2, Heading, PenLine,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { runAiApi } from "./api";
import { ApiClientError } from "@/lib/api-client";
import type { AiActionName } from "@/types/dto";

/**
 * AI assistant menu (Gemini). "Transforming" actions (grammar/improve/continue)
 * edit the document in place through the same TipTap commands a human uses — so
 * the change flows through the CRDT/sync pipeline like any other edit. "Insight"
 * actions (summarize/title) surface their result in a dialog.
 */
export function AiMenu({
  editor,
  documentId,
  disabled,
  onApplyTitle,
}: {
  editor: Editor;
  documentId: string;
  disabled?: boolean;
  onApplyTitle?: (title: string) => void;
}) {
  const [loading, setLoading] = useState<AiActionName | null>(null);
  const [dialog, setDialog] = useState<{ action: AiActionName; result: string } | null>(null);

  function selectionOrAll(): { text: string; from: number; to: number } {
    const { from, to } = editor.state.selection;
    if (from !== to) {
      return { text: editor.state.doc.textBetween(from, to, "\n"), from, to };
    }
    return {
      text: editor.getText(),
      from: 0,
      to: editor.state.doc.content.size,
    };
  }

  async function run(action: AiActionName) {
    const { text, from, to } = selectionOrAll();
    if (!text.trim()) {
      toast.error("Write or select some text first.");
      return;
    }
    setLoading(action);
    try {
      const { result } = await runAiApi(documentId, action, text.slice(0, 20_000));
      if (action === "summarize" || action === "title") {
        setDialog({ action, result });
      } else if (action === "continue") {
        editor.chain().focus().insertContentAt(to, ` ${result}`).run();
      } else {
        // grammar / improve — replace the operated range.
        editor.chain().focus().insertContentAt({ from, to }, result).run();
      }
    } catch (error) {
      const msg = error instanceof ApiClientError ? error.message : "AI request failed";
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }

  const items: { action: AiActionName; label: string; icon: React.ReactNode }[] = [
    { action: "improve", label: "Improve writing", icon: <Wand2 className="size-4" /> },
    { action: "grammar", label: "Fix grammar", icon: <SpellCheck className="size-4" /> },
    { action: "continue", label: "Continue writing", icon: <PenLine className="size-4" /> },
    { action: "summarize", label: "Summarize", icon: <FileText className="size-4" /> },
    { action: "title", label: "Generate title", icon: <Heading className="size-4" /> },
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={disabled}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-primary" />}
            AI
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>AI assistant</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map((it) => (
            <DropdownMenuItem
              key={it.action}
              disabled={loading !== null}
              onSelect={(e) => {
                e.preventDefault();
                void run(it.action);
              }}
            >
              {it.icon} {it.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {dialog?.action === "title" ? "Suggested title" : "Summary"}
            </DialogTitle>
            <DialogDescription>Generated with AI.</DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
            {dialog?.result}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Close
            </Button>
            {dialog?.action === "title" && onApplyTitle && (
              <Button
                onClick={() => {
                  onApplyTitle(dialog.result.replace(/^["']|["']$/g, ""));
                  setDialog(null);
                }}
              >
                Use this title
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                if (dialog) navigator.clipboard.writeText(dialog.result);
                toast.success("Copied");
              }}
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
