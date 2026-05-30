"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Snowflake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, type ApiResponse } from "@/lib/api-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AuthData {
  id: string;
  email: string;
}

interface PublicConfig {
  registrationOpen: boolean;
  linuxdoEnabled: boolean;
}

const OAUTH_ERROR_MSG: Record<string, string> = {
  state: "登录会话失效，请重试",
  token: "Linux Do 授权失败，请重试",
  profile: "无法获取 Linux Do 用户信息",
  disabled: "Linux Do 登录未启用",
  disabled_user: "账号已被禁用，请联系管理员",
  registration_closed: "注册已关闭，无法创建新账号",
  server: "登录失败，请稍后重试",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<PublicConfig | null>(null);

  useEffect(() => {
    api
      .get<ApiResponse<PublicConfig>>("/auth/public-config")
      .then((r) => setConfig(r.data.data ?? null))
      .catch(() => setConfig(null));

    // 处理 OAuth 回调带回的错误
    const params = new URLSearchParams(window.location.search);
    const err = params.get("oauth_error");
    if (err) {
      toast.error(OAUTH_ERROR_MSG[err] ?? "登录失败");
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await api.post<ApiResponse<AuthData>>("/auth/login", {
        email,
        password,
      });
      if (!data.success) {
        toast.error(data.error ?? "登录失败");
        return;
      }
      toast.success("登录成功");
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: ApiResponse<unknown> } })?.response?.data
          ?.error ?? "登录失败，请稍后重试";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm bg-gradient-to-b from-sky-50/60 to-transparent rounded-2xl p-1">
      <div className="flex flex-col items-center gap-2 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Snowflake className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Snow Admin</h1>
      </div>
      <Card className="shadow-xl border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">欢迎回来</CardTitle>
          <CardDescription>登录你的账号以继续</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "处理中…" : "登录"}
            </Button>
            {config?.linuxdoEnabled && (
              <>
                <div className="flex w-full items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  或
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    window.location.href = "/api/auth/oauth/linuxdo";
                  }}
                >
                  使用 Linux Do 登录
                </Button>
              </>
            )}
            {config?.registrationOpen !== false && (
              <p className="text-sm text-muted-foreground">
                没有账号？{" "}
                <Link
                  href="/register"
                  className="text-primary font-medium hover:underline"
                >
                  去注册
                </Link>
              </p>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
