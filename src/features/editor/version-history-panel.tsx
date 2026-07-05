"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { History, Camera, RotateCcw, Loader2, GitCommitHorizontal } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { listVersionsApi, restoreVersionApi, snapshotApi } from "./api";
import { syncEngine } from "@/lib/sync/sync-engine";

/**
 * Version history & time-travel. Snapshots are immutable; restore is
 * non-destructive (it appends a new "restore" operation the sync engine pulls),
 * so other collaborators converge and no history is ever lost.
 */
export function VersionHistoryPanel({
  documentId,
  canEdit,
}: {
  documentId: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const key = ["versions", documentId];

  const { data: versions, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listVersionsApi(documentId),
    enabled: open,
  });

  const snapshot = useMutation({
    mutationFn: () => snapshotApi(documentId),
    onSuccess: () => {
      toast.success("Snapshot captured");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: () => toast.error("Could not capture snapshot"),
  });

  const restore = useMutation({
    mutationFn: (versionId: string) => restoreVersionApi(documentId, versionId),
    onSuccess: async () => {
      toast.success("Restored — a new version was created");
      await syncEngine.pullNow(documentId);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: () => toast.error("Could not restore version"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <History className="size-4" /> <span className="hidden sm:inline">History</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Capture snapshots and restore any point — non-destructively.
          </DialogDescription>
        </DialogHeader>

        {canEdit && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => snapshot.mutate()}
            disabled={snapshot.isPending}
          >
            {snapshot.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            Capture snapshot
          </Button>
        )}

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : !versions || versions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No snapshots yet. Capture one to start your timeline.
            </p>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <GitCommitHorizontal className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {v.label ?? `Version ${v.versionNumber}`}
                    </p>
                    {v.origin === "RESTORE" && <Badge variant="secondary">restore</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    v{v.versionNumber} · {v.createdBy.name ?? v.createdBy.email} ·{" "}
                    {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    disabled={restore.isPending}
                    onClick={() => restore.mutate(v.id)}
                  >
                    <RotateCcw className="size-3.5" /> Restore
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
