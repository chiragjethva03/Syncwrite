"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, Code2, Link as LinkIcon, ImageIcon,
  Table as TableIcon, Minus, Undo2, Redo2, Upload, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AiMenu } from "./ai-menu";

/** Max image file size for inline (base64) upload. Kept well under the 1 MiB
 * sync-payload cap so an embedded image never breaks a document's sync. */
const MAX_IMAGE_BYTES = 512 * 1024;

function Tb({
  onClick, active, disabled, label, children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8", active && "bg-accent text-accent-foreground")}
      // Keep the editor's selection: without this, mousedown moves focus off the
      // contenteditable and the command lands on the wrong range (e.g. line 1).
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </Button>
  );
}

export function EditorToolbar({
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
  // Re-render the toolbar as selection/marks change so active states update.
  const [, force] = useState(0);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  return (
    <div className="sticky top-14 z-20 flex flex-wrap items-center gap-0.5 border-b bg-background/90 px-2 py-1.5 backdrop-blur">
      <Tb label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={disabled || !editor.can().undo()}>
        <Undo2 className="size-4" />
      </Tb>
      <Tb label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={disabled || !editor.can().redo()}>
        <Redo2 className="size-4" />
      </Tb>
      <Separator orientation="vertical" className="mx-1 h-6" />

      <Tb label="Heading 1" active={editor.isActive("heading", { level: 1 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="size-4" />
      </Tb>
      <Tb label="Heading 2" active={editor.isActive("heading", { level: 2 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-4" />
      </Tb>
      <Tb label="Heading 3" active={editor.isActive("heading", { level: 3 })} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="size-4" />
      </Tb>
      <Separator orientation="vertical" className="mx-1 h-6" />

      <Tb label="Bold" active={editor.isActive("bold")} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </Tb>
      <Tb label="Italic" active={editor.isActive("italic")} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </Tb>
      <Tb label="Underline" active={editor.isActive("underline")} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline className="size-4" />
      </Tb>
      <Tb label="Strikethrough" active={editor.isActive("strike")} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </Tb>
      <Tb label="Inline code" active={editor.isActive("code")} disabled={disabled} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="size-4" />
      </Tb>
      <Separator orientation="vertical" className="mx-1 h-6" />

      <Tb label="Bullet list" active={editor.isActive("bulletList")} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-4" />
      </Tb>
      <Tb label="Numbered list" active={editor.isActive("orderedList")} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </Tb>
      <Tb label="Checklist" active={editor.isActive("taskList")} disabled={disabled} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListChecks className="size-4" />
      </Tb>
      <Tb label="Blockquote" active={editor.isActive("blockquote")} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </Tb>
      <Tb label="Code block" active={editor.isActive("codeBlock")} disabled={disabled} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code2 className="size-4" />
      </Tb>
      <Separator orientation="vertical" className="mx-1 h-6" />

      <LinkButton editor={editor} disabled={disabled} />
      <ImageButton editor={editor} disabled={disabled} />
      <Tb label="Insert table" disabled={disabled} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <TableIcon className="size-4" />
      </Tb>
      <Tb label="Divider" disabled={disabled} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="size-4" />
      </Tb>

      <div className="ml-auto">
        <AiMenu editor={editor} documentId={documentId} disabled={disabled} onApplyTitle={onApplyTitle} />
      </div>
    </div>
  );
}

/** Custom link dialog (replaces the browser prompt): set, edit, or remove a link. */
function LinkButton({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const isActive = editor.isActive("link");

  function openDialog() {
    setUrl((editor.getAttributes("link").href as string | undefined) ?? "https://");
    setOpen(true);
  }

  function apply() {
    const trimmed = url.trim();
    if (!trimmed || trimmed === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else if (editor.state.selection.empty && !isActive) {
      // Nothing selected: insert the URL itself as clickable linked text
      // (setLink alone is a no-op with no text to mark).
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: trimmed,
          marks: [{ type: "link", attrs: { href: trimmed } }],
        })
        .run();
    } else {
      // Text selected, or editing an existing link: apply to that range.
      editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
    }
    setOpen(false);
  }

  function remove() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setOpen(false);
  }

  return (
    <>
      <Tb label="Link" active={isActive} disabled={disabled} onClick={openDialog}>
        <LinkIcon className="size-4" />
      </Tb>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isActive ? "Edit link" : "Add link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              value={url}
              autoFocus
              placeholder="https://example.com"
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {isActive ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={remove}>
                <Trash2 className="size-4" /> Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={apply}>
                {isActive ? "Update" : "Add link"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Custom image dialog: upload from the device (base64) or insert by URL. */
function ImageButton({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function insert(src: string) {
    editor.chain().focus().setImage({ src }).run();
    setOpen(false);
    setUrl("");
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024)} KB). Use a smaller file or a URL.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => insert(reader.result as string);
    reader.onerror = () => toast.error("Could not read that image.");
    reader.readAsDataURL(file);
  }

  return (
    <>
      <Tb label="Image" disabled={disabled} onClick={() => setOpen(true)}>
        <ImageIcon className="size-4" />
      </Tb>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Insert image</DialogTitle>
          </DialogHeader>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" /> Choose from device
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or paste a URL
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="image-url">Image URL</Label>
            <Input
              id="image-url"
              value={url}
              placeholder="https://example.com/photo.jpg"
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && url.trim() && insert(url.trim())}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!url.trim()} onClick={() => insert(url.trim())}>
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
