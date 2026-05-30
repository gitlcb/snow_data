"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, AlertTriangle, AlertOctagon } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: string;
  createdAt: string;
}

const SEEN_KEY = "snow_seen_announcements";

const TYPE_STYLE: Record<
  string,
  { icon: typeof Info; cls: string; iconCls: string }
> = {
  info: {
    icon: Info,
    cls: "border-blue-500/40 bg-blue-500/10",
    iconCls: "text-blue-600 dark:text-blue-400",
  },
  warning: {
    icon: AlertTriangle,
    cls: "border-amber-500/40 bg-amber-500/10",
    iconCls: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    icon: AlertOctagon,
    cls: "border-rose-500/40 bg-rose-500/10",
    iconCls: "text-rose-600 dark:text-rose-400",
  },
};

function readSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function AnnouncementPopup() {
  // seen 在客户端挂载后才读 localStorage，避免 SSR/首屏 hydration mismatch
  const [seen, setSeen] = useState<string[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  const { data } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: () => api.get("/admin/announcements").then((r) => r.data.data ?? []),
  });

  const unseen = useMemo(() => {
    if (!data || seen === null) return [];
    const seenSet = new Set(seen);
    return data.filter((a) => !seenSet.has(a.id));
  }, [data, seen]);

  const open = !dismissed && unseen.length > 0;

  function dismiss() {
    try {
      const merged = Array.from(
        new Set([...(seen ?? []), ...unseen.map((a) => a.id)]),
      );
      localStorage.setItem(SEEN_KEY, JSON.stringify(merged));
      setSeen(merged);
    } catch {
      // localStorage 不可用时仅本次会话内关闭
    }
    setDismissed(true);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            系统公告{unseen.length > 1 ? `（${unseen.length}）` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {unseen.map((a) => {
            const style = TYPE_STYLE[a.type] ?? TYPE_STYLE.info;
            const Icon = style.icon;
            return (
              <div
                key={a.id}
                className={`rounded-lg border p-4 ${style.cls}`}
              >
                <div className="flex items-start gap-2">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconCls}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.title}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {a.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={dismiss}>我知道了</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
