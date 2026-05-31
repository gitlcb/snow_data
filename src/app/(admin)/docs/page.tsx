"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Sparkles, KeyRound, BookOpen } from "lucide-react";
import { api } from "@/lib/api-client";
import { useApps } from "@/hooks/use-apps";
import { useSiteUrl } from "@/hooks/use-site-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ENDPOINTS,
  GROUP_ORDER,
  DEFAULT_COLLECTION,
  KEY_PLACEHOLDER,
  type ExampleCtx,
  type EndpointExample,
} from "@/lib/api-examples";
import { buildAiSystemPrompt } from "@/lib/ai-prompt";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  keyPlain?: string | null;
  scope: string;
}

interface CreatedKey extends ApiKeyItem {
  plainKey: string;
}

interface CollectionItem {
  collection: string;
  count: number;
}

const METHOD_COLOR: Record<string, string> = {
  GET: "bg-emerald-600",
  POST: "bg-blue-600",
  PATCH: "bg-amber-600",
  DELETE: "bg-rose-600",
};

export default function DocsPage() {
  const queryClient = useQueryClient();
  const { data: apps } = useApps();

  const [appId, setAppId] = useState("");
  const [apiKey, setApiKey] = useState(""); // 完整 key（粘贴或生成），仅前端内存
  const [showKey, setShowKey] = useState(false);
  // Base URL 优先用超管配置的网站地址，未配置回退到浏览器 origin（hydration 安全）
  const baseUrl = useSiteUrl();

  // 该 App 的 Key 列表（只用于对照展示，前缀不可直接调用）
  const { data: keys } = useQuery<ApiKeyItem[]>({
    queryKey: ["docs", "keys", appId],
    queryFn: () =>
      api.get(`/admin/apps/${appId}/keys`).then((r) => r.data.data ?? []),
    enabled: !!appId,
  });

  // 该 App 的集合名（用于把真实集合填进提示词与示例）
  const { data: collections } = useQuery<CollectionItem[]>({
    queryKey: ["docs", "collections", appId],
    queryFn: () =>
      api
        .get(`/admin/apps/${appId}/collections`)
        .then((r) => r.data.data ?? []),
    enabled: !!appId,
  });

  const genKey = useMutation({
    mutationFn: () =>
      api
        .post(`/admin/apps/${appId}/keys`, {
          name: `文档生成 ${new Date().toLocaleString("zh-CN")}`,
          scope: "readwrite",
        })
        .then((r) => r.data.data as CreatedKey),
    onSuccess: (data) => {
      setApiKey(data.plainKey);
      setShowKey(true);
      queryClient.invalidateQueries({ queryKey: ["docs", "keys", appId] });
      toast.success("已生成并填入，请到应用页妥善保管此 Key");
    },
    onError: () => toast.error("生成 Key 失败"),
  });

  const collectionNames = useMemo(
    () => (collections ?? []).map((c) => c.collection),
    [collections],
  );

  const sampleCollection = collectionNames[0] ?? DEFAULT_COLLECTION;

  const ctx: ExampleCtx = {
    baseUrl,
    apiKey: apiKey.trim() || KEY_PLACEHOLDER,
    collection: sampleCollection,
  };

  const aiPrompt = useMemo(
    () =>
      buildAiSystemPrompt({
        baseUrl,
        apiKey: apiKey.trim() || KEY_PLACEHOLDER,
        collections: collectionNames,
      }),
    [baseUrl, apiKey, collectionNames],
  );

  const hasRealKey = !!apiKey.trim();

  return (
    <div className="space-y-6">
      {/* 标题 + 复制提示词 */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">API 文档</h1>
            <p className="text-sm text-muted-foreground">
              选择应用与密钥，下方示例会自动填入；右侧可复制 AI 提示词，交给
              ChatGPT / Claude 等直接操作你的数据。
            </p>
          </div>
        </div>
        <CopyButton
          value={aiPrompt}
          label="复制 AI 提示词"
          variant="default"
          successMessage="提示词已复制，粘到 AI 对话框即可"
          className="shrink-0"
        />
      </div>

      {/* 配置区 */}
      <Card>
        <CardHeader>
          <CardTitle>接入配置</CardTitle>
          <CardDescription>
            Base URL：<code className="rounded bg-muted px-1.5 py-0.5">{baseUrl}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>选择应用</Label>
              <Select
                value={appId}
                onValueChange={(v) => {
                  setAppId(v);
                  setApiKey("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择一个应用" />
                </SelectTrigger>
                <SelectContent>
                  {(apps ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>选择已有密钥</Label>
              <Select
                value=""
                disabled={!appId}
                onValueChange={(kid) => {
                  const k = (keys ?? []).find((x) => x.id === kid);
                  if (k?.keyPlain) {
                    setApiKey(k.keyPlain);
                    setShowKey(false);
                    toast.success(`已选用密钥「${k.name}」`);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !appId
                        ? "请先选应用"
                        : keys && keys.length > 0
                          ? `${keys.length} 个密钥`
                          : "该应用暂无密钥"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(keys ?? []).map((k) => (
                    <SelectItem
                      key={k.id}
                      value={k.id}
                      disabled={!k.keyPlain}
                    >
                      {k.name} ·{" "}
                      {k.keyPlain ? k.keyPrefix : `${k.keyPrefix}（旧 Key 不可选）`}{" "}
                      · {k.scope === "readwrite" ? "读写" : "只读"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                选中即填入下方示例。旧 Key 未存明文不可选，可重新生成一个。
              </p>
            </div>
          </div>

          {/* 完整 Key 输入 + 生成 */}
          <div className="space-y-2">
            <Label htmlFor="full-key">完整 API Key（用于填充下方示例）</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="full-key"
                  type={showKey ? "text" : "password"}
                  placeholder="粘贴完整 Key（sk_live_...），或点右侧生成"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? "隐藏" : "显示"}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button
                variant="outline"
                disabled={!appId || genKey.isPending}
                onClick={() => genKey.mutate()}
              >
                <Sparkles className="h-4 w-4" />
                {genKey.isPending ? "生成中..." : "生成新 Key"}
              </Button>
            </div>
            {hasRealKey ? (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <KeyRound className="h-3.5 w-3.5" />
                示例与提示词已嵌入此真实 Key，注意不要公开分享。
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                未填写时，示例使用占位符 {KEY_PLACEHOLDER}，需手动替换后才能调用。
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 文档主体：左导航 + 右内容 */}
      <div className="flex gap-6">
        <DocsNav />
        <div className="min-w-0 flex-1 space-y-8">
          {GROUP_ORDER.map((group) => (
            <div key={group} className="space-y-4">
              <h2
                id={`group-${slug(group)}`}
                className="scroll-mt-4 text-lg font-semibold tracking-tight"
              >
                {group}
              </h2>
              {ENDPOINTS.filter((e) => e.group === group).map((ep) => (
                <EndpointCard key={ep.id} ep={ep} ctx={ctx} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function slug(s: string): string {
  return encodeURIComponent(s.replace(/\s+/g, "-"));
}

function DocsNav() {
  return (
    <nav className="sticky top-4 hidden h-fit w-52 shrink-0 space-y-4 lg:block">
      {GROUP_ORDER.map((group) => (
        <div key={group}>
          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            {group}
          </p>
          <ul className="space-y-0.5">
            {ENDPOINTS.filter((e) => e.group === group).map((ep) => (
              <li key={ep.id}>
                <a
                  href={`#ep-${ep.id}`}
                  className="block rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {ep.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function EndpointCard({ ep, ctx }: { ep: EndpointExample; ctx: ExampleCtx }) {
  const curl = ep.curl(ctx);
  const js = ep.js(ctx);

  return (
    <Card id={`ep-${ep.id}`} className="scroll-mt-4">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-bold text-white ${METHOD_COLOR[ep.method]}`}
          >
            {ep.method}
          </span>
          <code className="text-sm font-medium">{ep.path}</code>
          {ep.needWrite && (
            <Badge variant="secondary" className="text-xs">
              需读写权限
            </Badge>
          )}
        </div>
        <CardTitle className="pt-1 text-base">{ep.title}</CardTitle>
        <CardDescription>{ep.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ep.params && ep.params.length > 0 && (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-1.5 font-medium">参数</th>
                  <th className="px-3 py-1.5 font-medium">必填</th>
                  <th className="px-3 py-1.5 font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {ep.params.map((p) => (
                  <tr key={p.name} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-mono text-xs">{p.name}</td>
                    <td className="px-3 py-1.5 text-xs">
                      {p.required ? "是" : "否"}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {p.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Tabs defaultValue="curl">
          <TabsList>
            <TabsTrigger value="curl">curl</TabsTrigger>
            <TabsTrigger value="js">JavaScript</TabsTrigger>
          </TabsList>
          <TabsContent value="curl">
            <CodeBlock code={curl} />
          </TabsContent>
          <TabsContent value="js">
            <CodeBlock code={js} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-zinc-950 p-4 pr-12 text-xs leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton value={code} variant="secondary" size="icon" />
      </div>
    </div>
  );
}
