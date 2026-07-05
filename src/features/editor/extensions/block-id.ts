import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * BlockId extension.
 *
 * Gives every top-level block a STABLE `blockId` attribute that survives edits
 * and round-trips through `editor.getJSON()`. This identity is the backbone of
 * the block-level CRDT: without it, the merge engine couldn't tell "the user
 * edited this block" from "the user deleted a block and inserted a new one".
 *
 * How it stays stable:
 *  - `blockId` is declared as a global attribute, so ProseMirror preserves it
 *    across ordinary edits and serializes it into JSON.
 *  - `keepOnSplit: false` means when a block is split (pressing Enter), the NEW
 *    block starts with no id; the plugin below then mints a fresh one — so the
 *    original keeps its identity and only the genuinely-new block gets a new id.
 *  - An `appendTransaction` assigns ids to any top-level block missing one (new
 *    blocks, pastes) and de-duplicates ids copied by a split/paste.
 */

const BLOCK_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "bulletList",
  "orderedList",
  "taskList",
  "table",
  "image",
  "horizontalRule",
];

export const BlockId = Extension.create({
  name: "blockId",

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES,
        attributes: {
          blockId: {
            default: null,
            keepOnSplit: false,
            parseHTML: (element) => element.getAttribute("data-block-id"),
            renderHTML: (attributes) =>
              attributes.blockId
                ? { "data-block-id": attributes.blockId as string }
                : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("blockId"),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const tr = newState.tr;
          const seen = new Set<string>();
          let modified = false;

          // Only top-level blocks (direct children of `doc`) carry a blockId.
          newState.doc.forEach((node, offset) => {
            if (!node.type.isBlock) return;
            const id = node.attrs.blockId as string | null;
            if (!id || seen.has(id)) {
              const fresh = crypto.randomUUID();
              seen.add(fresh);
              tr.setNodeAttribute(offset, "blockId", fresh);
              modified = true;
            } else {
              seen.add(id);
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});
