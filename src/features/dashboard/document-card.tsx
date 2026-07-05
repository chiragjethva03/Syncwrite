"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { FileText, MoreVertical, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteDocument, useRenameDocument } from "./hooks";
import type { DocumentListItem } from "@/types/dto";

export function DocumentCard({
  doc,
  currentUserId,
}: {
  doc: DocumentListItem;
  currentUserId: string;
}) {
  const router = useRouter();
  const rename = useRenameDocument();
  const remove = useDeleteDocument();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(doc.title);

  const isOwner = doc.ownerId === currentUserId;
  const myRole = isOwner
    ? "OWNER"
    : doc.collaborators.find((c) => c.user.id === currentUserId)?.role ?? "VIEWER";
  const collaboratorCount = doc.collaborators.length;

  async function submitRename() {
    if (!title.trim() || title === doc.title) return setRenaming(false);
    try {
      await rename.mutateAsync({ id: doc.id, title: title.trim() });
      toast.success("Renamed");
    } catch {
      toast.error("Could not rename");
    } finally {
      setRenaming(false);
    }
  }

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card
          className="group flex h-full cursor-pointer flex-col justify-between p-4 transition-shadow hover:shadow-md"
          onClick={() => router.push(`/documents/${doc.id}`)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4.5" />
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                    aria-label="Document actions"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setRenaming(true)} disabled={myRole === "VIEWER"}>
                    <Pencil className="size-4" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={!isOwner}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-3 min-w-0">
            <h3 className="truncate font-medium">{doc.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Edited {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Badge variant={myRole === "OWNER" ? "default" : "secondary"}>{myRole}</Badge>
            {collaboratorCount > 0 && (
              <Badge variant="outline" className="gap-1">
                <Users className="size-3" /> {collaboratorCount}
              </Badge>
            )}
          </div>
        </Card>
      </motion.div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={rename.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete “{doc.title}”?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This moves the document to a deleted state. History is preserved but it
            will no longer appear in your dashboard.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={async () => {
                try {
                  await remove.mutateAsync(doc.id);
                  toast.success("Deleted");
                } catch {
                  toast.error("Could not delete");
                } finally {
                  setConfirmDelete(false);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
