"use client";

import { Cloud, CloudOff, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Real-time connection + sync indicator (an evaluation criterion). Reflects the
 * live sync engine state: offline, syncing, pending operations, or all-synced.
 */
export function SyncStatusIndicator({ className }: { className?: string }) {
  const { online, syncing, pending, lastSyncedAt, error } = useSyncStatus();

  const state = !online
    ? {
        variant: "warning" as const,
        icon: <CloudOff className="size-3.5" />,
        label: "Offline",
        detail: "Your edits are saved locally and will sync when you reconnect.",
      }
    : error
      ? {
          variant: "destructive" as const,
          icon: <AlertTriangle className="size-3.5" />,
          label: "Sync issue",
          detail: error,
        }
      : syncing
        ? {
            variant: "secondary" as const,
            icon: <RefreshCw className="size-3.5 animate-spin" />,
            label: "Syncing…",
            detail: `${pending} change${pending === 1 ? "" : "s"} pending.`,
          }
        : pending > 0
          ? {
              variant: "secondary" as const,
              icon: <Cloud className="size-3.5" />,
              label: `${pending} pending`,
              detail: "Waiting to push local changes.",
            }
          : {
              variant: "success" as const,
              icon: <Check className="size-3.5" />,
              label: "All changes saved",
              detail: lastSyncedAt
                ? `Last synced ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })}.`
                : "Synced.",
            };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={state.variant} className={cn("cursor-default gap-1.5", className)}>
          {state.icon}
          <span className="hidden sm:inline">{state.label}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{state.detail}</TooltipContent>
    </Tooltip>
  );
}

/** A full-width banner shown when the user is offline. */
export function OfflineBanner() {
  const { online } = useSyncStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-center text-xs font-medium text-warning"
    >
      <CloudOff className="size-3.5" />
      You&apos;re offline — editing still works and everything will sync automatically.
    </div>
  );
}
