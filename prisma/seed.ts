import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { fromProseMirror, extractText } from "../src/domain/crdt/document";
import type { ProseMirrorNode } from "../src/domain/crdt/types";

/**
 * Seed script: two demo users and a shared document so a reviewer can log in and
 * immediately experience collaboration + roles.
 *
 *   alice@syncwrite.dev / Password123!   (owner)
 *   bob@syncwrite.dev   / Password123!   (editor on Alice's doc)
 */
const prisma = new PrismaClient();

function sampleDoc(): ProseMirrorNode {
  return {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1, blockId: crypto.randomUUID() }, content: [{ type: "text", text: "Welcome to Syncwrite" }] },
      { type: "paragraph", attrs: { blockId: crypto.randomUUID() }, content: [{ type: "text", text: "This document is local-first. Try going offline and editing — it just works, and syncs when you reconnect." }] },
      { type: "paragraph", attrs: { blockId: crypto.randomUUID() }, content: [{ type: "text", text: "Open the History panel to capture and restore snapshots, and use the AI menu to summarize or improve your writing." }] },
    ],
  };
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const alice = await prisma.user.upsert({
    where: { email: "alice@syncwrite.dev" },
    update: {},
    create: { email: "alice@syncwrite.dev", name: "Alice Owner", passwordHash },
  });
  const bob = await prisma.user.upsert({
    where: { email: "bob@syncwrite.dev" },
    update: {},
    create: { email: "bob@syncwrite.dev", name: "Bob Editor", passwordHash },
  });

  const content = fromProseMirror(sampleDoc(), "seed");

  const existing = await prisma.document.findFirst({
    where: { ownerId: alice.id, title: "Getting started with Syncwrite" },
  });

  if (!existing) {
    const doc = await prisma.document.create({
      data: {
        title: "Getting started with Syncwrite",
        ownerId: alice.id,
        content: content as unknown as Prisma.InputJsonValue,
        versionVector: content.versionVector as Prisma.InputJsonValue,
        contentText: extractText(content),
      },
    });
    await prisma.collaborator.create({
      data: { documentId: doc.id, userId: bob.id, role: "EDITOR" },
    });
    console.log(`Seeded document ${doc.id} shared with Bob (EDITOR).`);
  }

  console.log("Seed complete. Login: alice@syncwrite.dev / Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
