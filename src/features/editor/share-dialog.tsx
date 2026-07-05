"use client";

import { useState } from "react";
import { UserPlus, Loader2, Crown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addCollaboratorApi } from "./api";
import { ApiClientError } from "@/lib/api-client";
import type { DocumentBootstrap } from "./api";

export function ShareDialog({ doc }: { doc: DocumentBootstrap }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("VIEWER");
  const [loading, setLoading] = useState(false);
  const [collaborators, setCollaborators] = useState(doc.collaborators);

  async function invite() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await addCollaboratorApi(doc.id, email.trim(), role);
      toast.success(`Invited ${email} as ${role.toLowerCase()}`);
      setCollaborators((prev) => [
        ...prev.filter((c) => c.user.email !== email),
        { role, user: { id: email, name: null, email } },
      ]);
      setEmail("");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus className="size-4" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>
            Invite collaborators. Editors can edit &amp; sync; viewers are read-only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite()}
              />
              <Select value={role} onValueChange={(v) => setRole(v as "EDITOR" | "VIEWER")}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={invite} disabled={loading} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Invite
          </Button>
        </div>

        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">People with access</p>
          <div className="flex items-center gap-2 rounded-lg border p-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{doc.owner.name ?? doc.owner.email}</p>
            </div>
            <Badge className="gap-1"><Crown className="size-3" /> Owner</Badge>
          </div>
          {collaborators.map((c) => (
            <div key={c.user.id} className="flex items-center gap-2 rounded-lg border p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{c.user.name ?? c.user.email}</p>
              </div>
              <Badge variant="secondary">{c.role}</Badge>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
