"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { FileText, LogOut, User as UserIcon } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";

interface AppHeaderProps {
  user: { name: string | null; email: string | null };
  /** Optional center slot (e.g. the document title in the editor). */
  center?: React.ReactNode;
}

export function AppHeader({ user, center }: AppHeaderProps) {
  const router = useRouter();
  const initials = (user.name ?? user.email ?? "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <FileText className="size-4" />
        </span>
        <span className="hidden sm:inline">{siteConfig.name}</span>
      </Link>

      <div className="flex min-w-0 flex-1 items-center justify-center">{center}</div>

      <div className="flex items-center gap-2">
        <SyncStatusIndicator />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2">
              <UserIcon className="size-4" />
              <div className="min-w-0">
                <p className="truncate text-sm">{user.name ?? "Account"}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={async () => {
                await signOut({ redirect: false });
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
