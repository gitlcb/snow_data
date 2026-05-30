"use client";

import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Trash2, Ban, CheckCircle2, BarChart3, Megaphone, Plus, Pencil } from "lucide-react";
import { api, type ApiResponse } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

interface PlatformUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  disabled: boolean;
  oauthProvider: string | null;
  createdAt: string;
  _count: { apps: number };
}

interface UserStats {
  user: { id: string; email: string; name: string | null };
  totals: {
    apps: number;
    records: number;
    keys: number;
    files: number;
    endUsers: number;
  };
  apps: { id: string; name: string; _count: { records: number } }[];
  collectionDistribution: { collection: string; count: number }[];
}

interface SysConfig {
  registrationOpen: boolean;
  linuxdoEnabled: boolean;
  linuxdoClientId: string;
  linuxdoClientSecretSet: boolean;
  uploadMaxBytes: number;
  uploadAllowedMime: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: string;
  published: boolean;
  createdAt: string;
}

const ANN_TYPES = [
  { value: "info", label: "通知" },
  { value: "warning", label: "警告" },
  { value: "danger", label: "危险" },
] as const;

function annTypeLabel(t: string) {
  return ANN_TYPES.find((x) => x.value === t)?.label ?? t;
}

function formatDate(v: string) {
  return new Date(v).toLocaleString("zh-CN");
}

export function AdminConsole() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">超级管理</h1>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="announcements">公告</TabsTrigger>
          <TabsTrigger value="settings">系统设置</TabsTrigger>
          <TabsTrigger value="linuxdo">Linux Do</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="announcements">
          <AnnouncementsTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="linuxdo">
          <LinuxDoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AnnouncementsTab() {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<{
    id: string | null;
    title: string;
    body: string;
    type: string;
    published: boolean;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const { data: list, isLoading } = useQuery<Announcement[]>({
    queryKey: ["superadmin", "announcements"],
    queryFn: () => api.get("/superadmin/announcements").then((r) => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: (vars: {
      id: string | null;
      title: string;
      body: string;
      type: string;
      published: boolean;
    }) => {
      const payload = {
        title: vars.title,
        body: vars.body,
        type: vars.type,
        published: vars.published,
      };
      return vars.id
        ? api.patch(`/superadmin/announcements/${vars.id}`, payload)
        : api.post("/superadmin/announcements", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["superadmin", "announcements"],
      });
      toast.success("已保存");
      setEditor(null);
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: ApiResponse<unknown> } })?.response?.data
          ?.error ?? "保存失败",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/superadmin/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["superadmin", "announcements"],
      });
      toast.success("公告已删除");
      setDeleteTarget(null);
    },
    onError: () => toast.error("删除失败"),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>公告</CardTitle>
            <CardDescription>
              发布的公告会在用户登录进入后台时弹窗展示（每条只弹一次）。草稿不展示。
            </CardDescription>
          </div>
          <Button
            className="shrink-0"
            onClick={() =>
              setEditor({
                id: null,
                title: "",
                body: "",
                type: "info",
                published: true,
              })
            }
          >
            <Plus className="h-4 w-4" />
            发布公告
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            加载中...
          </p>
        ) : !list || list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            暂无公告。
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        a.type === "danger"
                          ? "destructive"
                          : a.type === "warning"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {annTypeLabel(a.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.published ? (
                      <Badge variant="outline">已发布</Badge>
                    ) : (
                      <Badge variant="secondary">草稿</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(a.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="编辑"
                        onClick={() =>
                          setEditor({
                            id: a.id,
                            title: a.title,
                            body: a.body,
                            type: a.type,
                            published: a.published,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="删除"
                        onClick={() => setDeleteTarget(a)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor?.id ? "编辑公告" : "发布公告"}</DialogTitle>
            <DialogDescription>
              公告内容支持纯文本。关闭「发布」开关将存为草稿，不会向用户弹窗。
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ann-title">标题</Label>
                <Input
                  id="ann-title"
                  placeholder="如：系统维护通知"
                  value={editor.title}
                  onChange={(e) =>
                    setEditor({ ...editor, title: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-body">正文</Label>
                <Textarea
                  id="ann-body"
                  rows={5}
                  placeholder="公告正文内容..."
                  value={editor.body}
                  onChange={(e) =>
                    setEditor({ ...editor, body: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Select
                  value={editor.type}
                  onValueChange={(v) => setEditor({ ...editor, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANN_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <Label>立即发布</Label>
                  <p className="text-xs text-muted-foreground">
                    关闭则存为草稿。
                  </p>
                </div>
                <Switch
                  checked={editor.published}
                  onCheckedChange={(v) =>
                    setEditor({ ...editor, published: v })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditor(null)}
              disabled={saveMutation.isPending}
            >
              取消
            </Button>
            <Button
              disabled={
                saveMutation.isPending ||
                !editor?.title.trim() ||
                !editor?.body.trim()
              }
              onClick={() => editor && saveMutation.mutate(editor)}
            >
              {saveMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除公告</DialogTitle>
            <DialogDescription>
              确定删除「{deleteTarget?.title}」吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const [statsTarget, setStatsTarget] = useState<PlatformUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformUser | null>(null);

  const { data: users, isLoading } = useQuery<PlatformUser[]>({
    queryKey: ["superadmin", "users"],
    queryFn: () => api.get("/superadmin/users").then((r) => r.data.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; disabled: boolean }) =>
      api.patch(`/superadmin/users/${vars.id}`, { disabled: vars.disabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "users"] });
      toast.success("已更新用户状态");
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: ApiResponse<unknown> } })?.response?.data
          ?.error ?? "操作失败",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/superadmin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "users"] });
      toast.success("用户已删除");
      setDeleteTarget(null);
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: ApiResponse<unknown> } })?.response?.data
          ?.error ?? "删除失败",
      ),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>平台用户</CardTitle>
        <CardDescription>
          管理所有注册到平台的用户。可禁用、查看其数据统计或删除。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            加载中...
          </p>
        ) : !users || users.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            暂无用户。
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>应用数</TableHead>
                <TableHead>注册方式</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={u.role === "superadmin" ? "default" : "secondary"}
                    >
                      {u.role === "superadmin" ? "超管" : "用户"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.disabled ? (
                      <Badge variant="destructive">已禁用</Badge>
                    ) : (
                      <Badge variant="outline">正常</Badge>
                    )}
                  </TableCell>
                  <TableCell>{u._count.apps}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.oauthProvider === "linuxdo" ? "Linux Do" : "邮箱"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="查看统计"
                        onClick={() => setStatsTarget(u)}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={u.disabled ? "启用" : "禁用"}
                        disabled={
                          u.role === "superadmin" || toggleMutation.isPending
                        }
                        onClick={() =>
                          toggleMutation.mutate({
                            id: u.id,
                            disabled: !u.disabled,
                          })
                        }
                      >
                        {u.disabled ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Ban className="h-4 w-4 text-amber-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="删除"
                        disabled={u.role === "superadmin"}
                        onClick={() => setDeleteTarget(u)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <UserStatsDialog
        target={statsTarget}
        onClose={() => setStatsTarget(null)}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除用户</DialogTitle>
            <DialogDescription>
              确定删除「{deleteTarget?.email}」吗？该用户的所有应用、记录、
              API Key、文件都将被级联删除，不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function UserStatsDialog({
  target,
  onClose,
}: {
  target: PlatformUser | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<UserStats>({
    queryKey: ["superadmin", "userStats", target?.id],
    queryFn: () =>
      api.get(`/superadmin/users/${target!.id}/stats`).then((r) => r.data.data),
    enabled: !!target,
  });

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>用户统计 — {target?.email}</DialogTitle>
          <DialogDescription>该用户的应用与数据概览。</DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            加载中...
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="应用" value={data.totals.apps} />
              <StatBox label="记录" value={data.totals.records} />
              <StatBox label="API Key" value={data.totals.keys} />
              <StatBox label="文件" value={data.totals.files} />
              <StatBox label="终端用户" value={data.totals.endUsers} />
            </div>
            {data.apps.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">应用列表</p>
                <div className="space-y-1">
                  {data.apps.map((a) => (
                    <div
                      key={a.id}
                      className="flex justify-between rounded-md border px-3 py-1.5 text-sm"
                    >
                      <span>{a.name}</span>
                      <span className="text-muted-foreground">
                        {a._count.records} 条记录
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function SettingsTab() {
  const queryClient = useQueryClient();
  const { data: cfg, isLoading } = useQuery<SysConfig>({
    queryKey: ["superadmin", "config"],
    queryFn: () => api.get("/superadmin/config").then((r) => r.data.data),
  });

  const [maxMb, setMaxMb] = useState("");
  const [mime, setMime] = useState("");

  const mutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api.patch("/superadmin/config", patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config"] });
      toast.success("已保存");
    },
    onError: () => toast.error("保存失败"),
  });

  if (isLoading || !cfg) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          加载中...
        </CardContent>
      </Card>
    );
  }

  const currentMb = (cfg.uploadMaxBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>注册设置</CardTitle>
          <CardDescription>控制是否允许新用户注册平台账号。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>开放注册</Label>
              <p className="text-sm text-muted-foreground">
                关闭后，邮箱注册与 Linux Do 新用户建号都会被拒绝。
              </p>
            </div>
            <Switch
              checked={cfg.registrationOpen}
              onCheckedChange={(v) =>
                mutation.mutate({ registrationOpen: v })
              }
              disabled={mutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>文件上传限制</CardTitle>
          <CardDescription>
            全局限制所有应用的文件上传大小与类型。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="max-mb">
              最大文件大小（MB），当前 {currentMb}MB
            </Label>
            <div className="flex gap-2">
              <Input
                id="max-mb"
                type="number"
                min={1}
                placeholder={currentMb}
                value={maxMb}
                onChange={(e) => setMaxMb(e.target.value)}
                className="max-w-[200px]"
              />
              <Button
                variant="outline"
                disabled={!maxMb || mutation.isPending}
                onClick={() => {
                  const mb = Number(maxMb);
                  if (mb > 0)
                    mutation.mutate({
                      uploadMaxBytes: Math.round(mb * 1024 * 1024),
                    });
                  setMaxMb("");
                }}
              >
                保存
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mime">
              允许的 MIME 类型（逗号分隔，留空=不限制）
            </Label>
            <p className="text-xs text-muted-foreground">
              当前：{cfg.uploadAllowedMime || "（不限制）"}
            </p>
            <div className="flex gap-2">
              <Input
                id="mime"
                placeholder="image/png,image/jpeg,application/pdf"
                value={mime}
                onChange={(e) => setMime(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ uploadAllowedMime: mime })}
              >
                保存
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LinuxDoTab() {
  const queryClient = useQueryClient();
  const { data: cfg, isLoading } = useQuery<SysConfig>({
    queryKey: ["superadmin", "config"],
    queryFn: () => api.get("/superadmin/config").then((r) => r.data.data),
  });

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const mutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api.patch("/superadmin/config", patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config"] });
      toast.success("已保存");
      setClientSecret("");
    },
    onError: () => toast.error("保存失败"),
  });

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-host";
  const callbackUrl = `${origin}/api/auth/oauth/linuxdo/callback`;

  if (isLoading || !cfg) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          加载中...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linux Do 登录</CardTitle>
        <CardDescription>
          配置 Linux Do Connect OAuth，允许用户用 Linux Do 账号登录。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>启用 Linux Do 登录</Label>
            <p className="text-sm text-muted-foreground">
              需先填写并保存 Client ID / Secret。
            </p>
          </div>
          <Switch
            checked={cfg.linuxdoEnabled}
            onCheckedChange={(v) => mutation.mutate({ linuxdoEnabled: v })}
            disabled={mutation.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label>回调地址（填到 Linux Do 应用后台）</Label>
          <code className="block break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
            {callbackUrl}
          </code>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-id">Client ID</Label>
          <Input
            id="client-id"
            placeholder={cfg.linuxdoClientId || "未配置"}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-secret">Client Secret</Label>
          <Input
            id="client-secret"
            type="password"
            placeholder={cfg.linuxdoClientSecretSet ? "已配置（留空不修改）" : "未配置"}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
          />
        </div>

        <Button
          disabled={mutation.isPending}
          onClick={() => {
            const patch: Record<string, unknown> = {};
            if (clientId) patch.linuxdoClientId = clientId;
            if (clientSecret) patch.linuxdoClientSecret = clientSecret;
            if (Object.keys(patch).length === 0) {
              toast.info("没有要保存的修改");
              return;
            }
            mutation.mutate(patch);
            setClientId("");
          }}
        >
          {mutation.isPending ? "保存中..." : "保存凭证"}
        </Button>
      </CardContent>
    </Card>
  );
}
