"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  KeyRound,
  Users,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CopyButton } from "@/components/copy-button";

interface AppDetail {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  _count?: { records: number; apiKeys: number };
}

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  keyPlain?: string | null;
  scope: string;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
}

interface CreatedKey extends ApiKeyItem {
  plainKey: string;
}

interface EndUserItem {
  id: string;
  email: string;
  recordCount: number;
  createdAt: string;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN") : "—";
}

// 密钥单元格：有明文则可显示/隐藏/复制完整 Key；老 key 无明文，仅展示前缀并提示重新生成
function KeyCell({ item }: { item: ApiKeyItem }) {
  const [show, setShow] = useState(false);
  if (!item.keyPlain) {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="secondary" className="w-fit font-mono">
          {item.keyPrefix}
        </Badge>
        <span className="text-xs text-muted-foreground">
          旧 Key 不可查看，重新生成可显示完整值
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
        {show ? item.keyPlain : `${item.keyPrefix}••••`}
      </code>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        type="button"
        onClick={() => setShow((s) => !s)}
        title={show ? "隐藏" : "显示"}
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      <CopyButton value={item.keyPlain} variant="ghost" size="icon" />
    </div>
  );
}

export default function AppDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: app, isLoading } = useQuery<AppDetail>({
    queryKey: ["app", id],
    queryFn: () => api.get(`/admin/apps/${id}`).then((r) => r.data.data),
  });

  const { data: keys } = useQuery<ApiKeyItem[]>({
    queryKey: ["app", id, "keys"],
    queryFn: () => api.get(`/admin/apps/${id}/keys`).then((r) => r.data.data),
  });

  const { data: endUsers } = useQuery<EndUserItem[]>({
    queryKey: ["app", id, "users"],
    queryFn: () => api.get(`/admin/apps/${id}/users`).then((r) => r.data.data),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newKeyOpen, setNewKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScope, setNewKeyScope] = useState("readwrite");
  const [newKeyExpiry, setNewKeyExpiry] = useState("");
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<ApiKeyItem | null>(
    null,
  );
  const [pendingDeleteUser, setPendingDeleteUser] =
    useState<EndUserItem | null>(null);

  const editMutation = useMutation({
    mutationFn: (payload: { name: string; description?: string }) =>
      api.patch(`/admin/apps/${id}`, payload).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app", id] });
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      toast.success("已更新");
      setEditOpen(false);
    },
    onError: () => toast.error("更新失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/apps/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      toast.success("应用已删除");
      router.push("/apps");
    },
    onError: () => toast.error("删除失败"),
  });

  const createKeyMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      scope: string;
      expiresAt?: string | null;
    }) =>
      api
        .post(`/admin/apps/${id}/keys`, payload)
        .then((r) => r.data.data as CreatedKey),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["app", id, "keys"] });
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      queryClient.invalidateQueries({ queryKey: ["app", id] });
      setNewKeyOpen(false);
      setNewKeyName("");
      setNewKeyScope("readwrite");
      setNewKeyExpiry("");
      setCreatedKey(data);
    },
    onError: () => toast.error("生成 Key 失败"),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (keyId: string) =>
      api.delete(`/admin/apps/${id}/keys/${keyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app", id, "keys"] });
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      queryClient.invalidateQueries({ queryKey: ["app", id] });
      toast.success("Key 已删除");
      setPendingDeleteKey(null);
    },
    onError: () => toast.error("删除 Key 失败"),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) =>
      api
        .delete(`/admin/apps/${id}/users/${userId}`)
        .then((r) => r.data.data as { deletedRecords: number }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["app", id, "users"] });
      queryClient.invalidateQueries({ queryKey: ["app", id] });
      toast.success(`终端用户已删除，连带清理 ${data.deletedRecords} 条记录`);
      setPendingDeleteUser(null);
    },
    onError: () => toast.error("删除终端用户失败"),
  });

  function openEdit() {
    setEditName(app?.name ?? "");
    setEditDesc(app?.description ?? "");
    setEditOpen(true);
  }

  function handleEdit() {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("请输入应用名称");
      return;
    }
    editMutation.mutate({ name: trimmed, description: editDesc.trim() });
  }

  function handleCreateKey() {
    const trimmed = newKeyName.trim();
    if (!trimmed) {
      toast.error("请输入 Key 名称");
      return;
    }
    createKeyMutation.mutate({
      name: trimmed,
      scope: newKeyScope,
      // datetime-local 值转 ISO；为空则不过期
      expiresAt: newKeyExpiry ? new Date(newKeyExpiry).toISOString() : null,
    });
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">加载中...</p>;
  }
  if (!app) {
    return <p className="text-sm text-muted-foreground">应用不存在</p>;
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-host";
  const sampleKey = keys?.[0]?.keyPrefix
    ? `${keys[0].keyPrefix}（你的完整 Key）`
    : "sk_live_xxxxxxxxxxxx";
  const curlSample = `curl -X POST ${origin}/api/v1/posts \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"hello","body":"world"}'`;

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 text-muted-foreground"
          onClick={() => router.push("/apps")}
        >
          <ArrowLeft className="h-4 w-4" />
          返回应用列表
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {app.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {app.description || "暂无描述"}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={openEdit}>
              <Pencil className="h-4 w-4" />
              编辑
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              删除
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>接入信息</CardTitle>
          <CardDescription>
            通过对外 API 读写该应用的数据，请求需带上 API Key 鉴权。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 text-sm">
            <p className="text-muted-foreground">请求地址</p>
            <code className="block rounded-md bg-muted px-3 py-2 font-mono">
              POST {origin}/api/v1/{"{collection}"}
            </code>
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="text-muted-foreground">鉴权头</p>
            <code className="block rounded-md bg-muted px-3 py-2 font-mono">
              Authorization: Bearer &lt;your-api-key&gt;
            </code>
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="text-muted-foreground">curl 示例</p>
            <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
              {curlSample}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle>API Key 管理</CardTitle>
            <CardDescription>
              用于对外 API 鉴权，请妥善保管。明文仅在创建时显示一次。
            </CardDescription>
          </div>
          <Button onClick={() => setNewKeyOpen(true)}>
            <Plus className="h-4 w-4" />
            生成新 Key
          </Button>
        </CardHeader>
        <CardContent>
          {!keys || keys.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              还没有 API Key。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>权限</TableHead>
                  <TableHead>过期</TableHead>
                  <TableHead>最后使用</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => {
                  const expired =
                    key.expiresAt && new Date(key.expiresAt) <= new Date();
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <KeyCell item={key} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            key.scope === "readonly" ? "outline" : "default"
                          }
                        >
                          {key.scope === "readonly" ? "只读" : "读写"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {key.expiresAt ? (
                          <span className={expired ? "text-destructive" : ""}>
                            {formatDate(key.expiresAt)}
                            {expired ? "（已过期）" : ""}
                          </span>
                        ) : (
                          "永不"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(key.lastUsedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDeleteKey(key)}
                          disabled={
                            deleteKeyMutation.isPending &&
                            deleteKeyMutation.variables === key.id
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            终端用户
          </CardTitle>
          <CardDescription>
            通过 App Key 调用 /api/v1/auth/register 与 login
            注册登录的最终用户，其数据按 owner 隔离，互不可见。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!endUsers || endUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              还没有终端用户。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>邮箱</TableHead>
                  <TableHead>记录数</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.recordCount}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPendingDeleteUser(u)}
                        disabled={
                          deleteUserMutation.isPending &&
                          deleteUserMutation.variables === u.id
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑应用</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">名称</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">描述</Label>
              <Textarea
                id="edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editMutation.isPending}
            >
              取消
            </Button>
            <Button onClick={handleEdit} disabled={editMutation.isPending}>
              {editMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除应用</DialogTitle>
            <DialogDescription>
              确定要删除「{app.name}」吗？该应用下的所有记录、API Key
              和文件都将被一并删除，此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newKeyOpen} onOpenChange={setNewKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成新 API Key</DialogTitle>
            <DialogDescription>为这个 Key 起一个便于识别的名称。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="key-name">名称</Label>
            <Input
              id="key-name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="例如：生产环境"
            />
          </div>
          <div className="space-y-2">
            <Label>权限范围</Label>
            <Select value={newKeyScope} onValueChange={setNewKeyScope}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="readwrite">读写（可读可写）</SelectItem>
                <SelectItem value="readonly">只读（仅查询）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="key-expiry">过期时间（留空=永不过期）</Label>
            <Input
              id="key-expiry"
              type="datetime-local"
              value={newKeyExpiry}
              onChange={(e) => setNewKeyExpiry(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewKeyOpen(false)}
              disabled={createKeyMutation.isPending}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateKey}
              disabled={createKeyMutation.isPending}
            >
              {createKeyMutation.isPending ? "生成中..." : "生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!createdKey}
        onOpenChange={(o) => !o && setCreatedKey(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Key 已生成
            </DialogTitle>
            <DialogDescription>
              请立即复制保存，关闭后将不再显示完整 Key。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              这是你唯一一次看到该 Key 的明文，请妥善保存。
            </div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">
                {createdKey?.plainKey}
              </code>
              {createdKey && <CopyButton value={createdKey.plainKey} />}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>我已保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingDeleteKey}
        onOpenChange={(o) => !o && setPendingDeleteKey(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除 API Key</DialogTitle>
            <DialogDescription>
              确定要删除「{pendingDeleteKey?.name}」吗？使用该 Key
              的集成将立即失效，此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDeleteKey(null)}
              disabled={deleteKeyMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteKeyMutation.isPending}
              onClick={() =>
                pendingDeleteKey &&
                deleteKeyMutation.mutate(pendingDeleteKey.id)
              }
            >
              {deleteKeyMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingDeleteUser}
        onOpenChange={(o) => !o && setPendingDeleteUser(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除终端用户</DialogTitle>
            <DialogDescription>
              确定要删除「{pendingDeleteUser?.email}」吗？该用户拥有的{" "}
              {pendingDeleteUser?.recordCount ?? 0}{" "}
              条记录将被一并删除，此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDeleteUser(null)}
              disabled={deleteUserMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteUserMutation.isPending}
              onClick={() =>
                pendingDeleteUser &&
                deleteUserMutation.mutate(pendingDeleteUser.id)
              }
            >
              {deleteUserMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
