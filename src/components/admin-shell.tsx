"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Database,
  FileImage,
  LogOut,
  Snowflake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

const NAV = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/apps", label: "应用管理", icon: Boxes },
  { href: "/data", label: "数据浏览", icon: Database },
  { href: "/files", label: "文件管理", icon: FileImage },
];

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

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
      <aside className="flex w-60 flex-col border-r bg-sidebar">
        <div className="flex h-14 items-center gap-2 border-b px-5">
          <Snowflake className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">Snow Admin</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
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
        <div className="border-t p-3">
          <div className="mb-2 truncate px-2 text-xs text-muted-foreground">
            {email}
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
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-8">{children}</div>
      </main>
    </div>
  );
}
