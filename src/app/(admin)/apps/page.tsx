"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Database, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useApps, type App } from "@/hooks/use-apps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

export default function AppsPage() {
  const { data: apps, isLoading } = useApps();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string }) =>
      api.post("/admin/apps", payload).then((r) => r.data.data as App),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      toast.success("应用已创建");
      setOpen(false);
      setName("");
      setDescription("");
    },
    onError: () => toast.error("创建应用失败"),
  });

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("请输入应用名称");
      return;
    }
    createMutation.mutate({
      name: trimmed,
      description: description.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">应用管理</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          新建应用
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : !apps || apps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              还没有应用，点击右上角新建一个吧。
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Link key={app.id} href={`/apps/${app.id}`} className="block">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="truncate">{app.name}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                    {app.description || "暂无描述"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Database className="h-4 w-4" />
                      {app._count?.records ?? 0} 条记录
                    </span>
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="h-4 w-4" />
                      {app._count?.apiKeys ?? 0} 个 Key
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    创建于 {formatDate(app.createdAt)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建应用</DialogTitle>
            <DialogDescription>
              创建一个应用以管理其数据记录与 API Key。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="app-name">名称</Label>
              <Input
                id="app-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="我的应用"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-desc">描述（可选）</Label>
              <Textarea
                id="app-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简单描述这个应用的用途"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending}
            >
              取消
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
