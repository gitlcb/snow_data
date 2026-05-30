"use client";

import { useEffect, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { ApiResponse } from "@/lib/api-client";
import { useApps } from "@/hooks/use-apps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface CollectionItem {
  collection: string;
  count: number;
}

interface RecordItem {
  id: string;
  data: unknown;
  createdAt: string;
  updatedAt: string;
}

const PAGE_SIZE = 20;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

export default function DataPage() {
  const qc = useQueryClient();
  const [appId, setAppId] = useState<string>("");
  const [collection, setCollection] = useState<string>("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const q = useDebounce(search, 350);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RecordItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecordItem | null>(null);

  // 复用共享 useApps，单一数据源
  const { data: apps = [] } = useApps();

  const { data: collections = [] } = useQuery<CollectionItem[]>({
    queryKey: ["collections", appId],
    enabled: !!appId,
    queryFn: () =>
      api
        .get<ApiResponse<CollectionItem[]>>(`/admin/apps/${appId}/collections`)
        .then((r) => r.data.data ?? []),
  });

  const recordsQuery = useQuery({
    queryKey: ["records", appId, collection, page, q],
    enabled: !!appId && !!collection,
    queryFn: () =>
      api
        .get<ApiResponse<RecordItem[]>>(`/admin/apps/${appId}/records`, {
          params: { collection, page, limit: PAGE_SIZE, q: q || undefined },
        })
        .then((r) => ({
          rows: r.data.data ?? [],
          total: r.data.meta?.total ?? 0,
        })),
  });

  const records = recordsQuery.data?.rows ?? [];
  const total = recordsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function invalidateRecords() {
    qc.invalidateQueries({ queryKey: ["records", appId, collection] });
    qc.invalidateQueries({ queryKey: ["collections", appId] });
  }

  const createMutation = useMutation({
    mutationFn: (data: unknown) =>
      api.post(`/admin/apps/${appId}/records`, { collection, data }),
    onSuccess: () => {
      toast.success("记录已创建");
      setCreateOpen(false);
      invalidateRecords();
    },
    onError: (e: unknown) => toast.error(extractError(e, "创建失败")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ recordId, data }: { recordId: string; data: unknown }) =>
      api.patch(`/admin/apps/${appId}/records/${recordId}`, { data }),
    onSuccess: () => {
      toast.success("记录已更新");
      setEditTarget(null);
      invalidateRecords();
    },
    onError: (e: unknown) => toast.error(extractError(e, "更新失败")),
  });

  const deleteMutation = useMutation({
    mutationFn: (recordId: string) =>
      api.delete(`/admin/apps/${appId}/records/${recordId}`),
    onSuccess: () => {
      toast.success("记录已删除");
      setDeleteTarget(null);
      invalidateRecords();
    },
    onError: (e: unknown) => toast.error(extractError(e, "删除失败")),
  });

  // 切换 app 时重置 collection 与分页
  function onAppChange(value: string) {
    setAppId(value);
    setCollection("");
    setPage(1);
    setSearch("");
  }
  function onCollectionChange(value: string) {
    setCollection(value);
    setPage(1);
    setSearch("");
  }

  async function handleExport(format: "json" | "csv") {
    try {
      const res = await api.get(
        `/admin/apps/${appId}/records/export`,
        { params: { collection, format }, responseType: "blob" },
      );
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${collection}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("导出失败");
    }
  }

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const json = JSON.parse(text);
      return api.post(`/admin/apps/${appId}/records/import`, json, {
        params: { collection },
      });
    },
    onSuccess: (r) => {
      const n = (r.data as { data?: { imported?: number } })?.data?.imported ?? 0;
      toast.success(`已导入 ${n} 条`);
      invalidateRecords();
    },
    onError: (e: unknown) => toast.error(extractError(e, "导入失败（请检查 JSON 格式）")),
  });

  const ready = !!appId && !!collection;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">数据浏览</h1>
        {ready && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("json")}>
              <Download className="h-4 w-4" />
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <label>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importMutation.mutate(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={importMutation.isPending}
              >
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4" />
                  导入
                </span>
              </Button>
            </label>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              新增记录
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={appId} onValueChange={onAppChange}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="选择应用" />
          </SelectTrigger>
          <SelectContent>
            {apps.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {appId && (
          <Select value={collection} onValueChange={onCollectionChange}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="选择集合" />
            </SelectTrigger>
            <SelectContent>
              {collections.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  暂无集合
                </div>
              ) : (
                collections.map((c) => (
                  <SelectItem key={c.collection} value={c.collection}>
                    {c.collection} ({c.count})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}

        {ready && (
          <div className="relative ml-auto w-72">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="搜索记录内容…"
              className="pl-8"
            />
          </div>
        )}
      </div>

      {!ready ? (
        <EmptyState text="请先选择应用和集合" />
      ) : recordsQuery.isLoading ? (
        <EmptyState text="加载中…" />
      ) : records.length === 0 ? (
        <EmptyState text="暂无记录" />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">ID</TableHead>
                <TableHead>数据预览</TableHead>
                <TableHead className="w-44">创建时间</TableHead>
                <TableHead className="w-28 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {truncate(r.id, 10)}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <span className="font-mono text-xs">
                      {truncate(JSON.stringify(r.data), 120)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditTarget(r)}
                        title="查看 / 编辑"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(r)}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              共 {total} 条 · 第 {page}/{totalPages} 页
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>
      )}

      <RecordDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新增记录"
        description={`向集合 ${collection} 添加一条记录（JSON 对象）`}
        initialJson="{\n  \n}"
        submitting={createMutation.isPending}
        onSubmit={(data) => createMutation.mutate(data)}
      />

      <RecordDialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
        title="编辑记录"
        description={editTarget ? `ID: ${editTarget.id}` : ""}
        initialJson={
          editTarget ? JSON.stringify(editTarget.data, null, 2) : "{}"
        }
        submitting={updateMutation.isPending}
        onSubmit={(data) =>
          editTarget &&
          updateMutation.mutate({ recordId: editTarget.id, data })
        }
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除记录</DialogTitle>
            <DialogDescription>
              确定要删除该记录吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <Badge variant="secondary" className="w-fit font-mono">
              {deleteTarget.id}
            </Badge>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function RecordDialog({
  open,
  onOpenChange,
  title,
  description,
  initialJson,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialJson: string;
  submitting: boolean;
  onSubmit: (data: unknown) => void;
}) {
  const [text, setText] = useState(initialJson);

  // 每次打开时用最新初始值重置编辑框
  useEffect(() => {
    if (open) setText(initialJson);
  }, [open, initialJson]);

  function handleSubmit() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      toast.error("JSON 格式错误，请检查");
      return;
    }
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      toast.error("data 必须是一个 JSON 对象");
      return;
    }
    onSubmit(parsed);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="record-json">记录数据 (JSON)</Label>
          <Textarea
            id="record-json"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[280px] font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button disabled={submitting} onClick={handleSubmit}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function extractError(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: ApiResponse<unknown> } })?.response
    ?.data?.error;
  return msg ?? fallback;
}
