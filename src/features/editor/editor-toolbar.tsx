"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, Code2, Link as LinkIcon, ImageIcon,
  Table as TableIcon, Minus, Undo2, Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AiMenu } from "./ai-menu";

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

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") return editor.chain().focus().unsetLink().run();
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt("Image URL");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

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

      <Tb label="Link" active={editor.isActive("link")} disabled={disabled} onClick={setLink}>
        <LinkIcon className="size-4" />
      </Tb>
      <Tb label="Image" disabled={disabled} onClick={addImage}>
        <ImageIcon className="size-4" />
      </Tb>
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
