"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Database,
  FileImage,
  Activity,
  BookOpen,
  Shield,
  LogOut,
  Snowflake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnnouncementPopup } from "@/components/announcement-popup";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

const NAV = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/apps", label: "应用管理", icon: Boxes },
  { href: "/data", label: "数据浏览", icon: Database },
  { href: "/files", label: "文件管理", icon: FileImage },
  { href: "/usage", label: "用量", icon: Activity },
  { href: "/docs", label: "API 文档", icon: BookOpen },
];

export function AdminShell({
  email,
  role,
  children,
}: {
  email: string;
  role?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const nav =
    role === "superadmin"
      ? [...NAV, { href: "/admin-console", label: "超级管理", icon: Shield }]
      : NAV;

  async function logout() {
    try {
      await api.post("/auth/logout");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("退出失败");
    }
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-5">
          <Snowflake className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">Snow Admin</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t p-3">
          <div className="mb-2 flex items-center justify-between gap-2 px-2">
            <span className="truncate text-xs text-muted-foreground">
              {email}
            </span>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </Button>
        </div>
      </aside>
      <main className="h-screen flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-8">{children}</div>
      </main>
      <AnnouncementPopup />
    </div>
  );
}
