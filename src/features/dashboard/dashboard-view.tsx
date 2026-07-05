"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useDebounce } from "@/hooks/use-debounce";
import { DocumentCard } from "./document-card";
import { useCreateDocument, useDocuments } from "./hooks";

export function DashboardView({ userId }: { userId: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const { data: docs, isLoading, isError } = useDocuments(debounced);
  const create = useCreateDocument();

  async function onCreate() {
    try {
      const doc = await create.mutateAsync("Untitled document");
      toast.success("Document created");
      router.push(`/documents/${doc.id}`);
    } catch {
      toast.error("Could not create document");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your documents</h1>
          <p className="text-sm text-muted-foreground">
            Your local-first workspace. Everything you open works offline.
          </p>
        </div>
        <Button onClick={onCreate} disabled={create.isPending}>
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          New document
        </Button>
      </div>

      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search documents"
        />
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-36 animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Could not load documents.</p>
        ) : !docs || docs.length === 0 ? (
          <EmptyState onCreate={onCreate} searching={Boolean(debounced)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} currentUserId={userId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  onCreate,
  searching,
}: {
  onCreate: () => void;
  searching: boolean;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <FileText className="size-6" />
      </div>
      <div>
        <p className="font-medium">
          {searching ? "No matching documents" : "No documents yet"}
        </p>
        <p className="text-sm text-muted-foreground">
          {searching ? "Try a different search." : "Create your first document to get started."}
        </p>
      </div>
      {!searching && (
        <Button onClick={onCreate} className="mt-1">
          <Plus className="size-4" /> New document
        </Button>
      )}
    </Card>
  );
}
