import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import type { Extensions } from "@tiptap/core";
import { BlockId } from "./block-id";

/** Syntax-highlighting engine (highlight.js common languages) for code blocks. */
const lowlight = createLowlight(common);

/**
 * The editor's extension set. StarterKit (v3) already bundles bold/italic/
 * strike/code, headings, lists, blockquote, code block, link, and underline, so
 * we configure those in place and only ADD what it lacks (task lists, tables,
 * images, placeholder) plus our BlockId identity layer.
 */
export function buildExtensions(placeholder: string): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Replaced below by CodeBlockLowlight for syntax highlighting.
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
    Placeholder.configure({ placeholder }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Image.configure({ inline: false, allowBase64: true }),
    BlockId,
  ];
}
