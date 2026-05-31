"use client";

import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api-client";
import { useApps } from "@/hooks/use-apps";
import { useSiteUrl } from "@/hooks/use-site-url";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  Copy,
  FileIcon,
  ImageOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface FileItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  url: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN");
  } catch {
    return iso;
  }
}

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

export default function FilesPage() {
  const queryClient = useQueryClient();
  const [appId, setAppId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FileItem | null>(null);

  const { data: apps } = useApps();
  const siteUrl = useSiteUrl();

  const filesKey = ["files", appId] as const;
  const {
    data: files,
    isLoading: filesLoading,
  } = useQuery<FileItem[]>({
    queryKey: filesKey,
    enabled: !!appId,
    queryFn: async () => {
      const res = await api.get<ApiResponse<FileItem[]>>(
        `/admin/apps/${appId}/files`,
        { params: { page: 1, limit: 100 } },
      );
      return res.data.data ?? [];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post<ApiResponse<FileItem>>(
        `/admin/apps/${appId}/files`,
        form,
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success("上传成功");
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["files", appId] });
    },
    onError: () => {
      toast.error("上传失败，请重试");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await api.delete(`/admin/apps/${appId}/files/${fileId}`);
    },
    onSuccess: () => {
      toast.success("已删除");
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["files", appId] });
    },
    onError: () => {
      toast.error("删除失败，请重试");
    },
  });

  const handleCopyUrl = async (url: string) => {
    const full = `${siteUrl}${url}`;
    try {
      await navigator.clipboard.writeText(full);
      toast.success("URL 已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">文件管理</h1>
        <div className="w-64">
          <Select value={appId} onValueChange={setAppId}>
            <SelectTrigger>
              <SelectValue placeholder="选择应用" />
            </SelectTrigger>
            <SelectContent>
              {(apps ?? []).map((app) => (
                <SelectItem key={app.id} value={app.id}>
                  {app.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!appId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <FileIcon className="h-10 w-10 opacity-40" />
            <p>请先在右上角选择一个应用以管理其文件。</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <Input
                type="file"
                className="sm:max-w-sm"
                onChange={(e) =>
                  setSelectedFile(e.target.files?.[0] ?? null)
                }
              />
              <Button
                disabled={!selectedFile || uploadMutation.isPending}
                onClick={() =>
                  selectedFile && uploadMutation.mutate(selectedFile)
                }
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Upload />
                )}
                上传
              </Button>
            </CardContent>
          </Card>

          {filesLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              加载中...
            </div>
          ) : (files?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                <ImageOff className="h-10 w-10 opacity-40" />
                <p>该应用还没有文件，上传一个试试吧。</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(files ?? []).map((file) => (
                <Card key={file.id} className="overflow-hidden">
                  <div className="flex h-40 items-center justify-center bg-muted/40">
                    {isImage(file.mimeType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.url}
                        alt={file.filename}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <FileIcon className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <CardContent className="space-y-2 p-3">
                    <p
                      className="truncate text-sm font-medium"
                      title={file.filename}
                    >
                      {file.filename}
                    </p>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{formatSize(file.size)}</span>
                      <span className="truncate">{file.mimeType}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(file.createdAt)}
                    </p>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleCopyUrl(file.url)}
                      >
                        <Copy />
                        复制 URL
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => setPendingDelete(file)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除文件</DialogTitle>
            <DialogDescription>
              确定要删除「{pendingDelete?.filename}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                pendingDelete && deleteMutation.mutate(pendingDelete.id)
              }
            >
              {deleteMutation.isPending && (
                <Loader2 className="animate-spin" />
              )}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
