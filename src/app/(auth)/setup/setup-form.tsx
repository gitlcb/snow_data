"use client";

import { useState } from "react";
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

export function SetupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) {
      toast.error("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<ApiResponse<AuthData>>("/auth/setup", {
        username,
        password,
        confirm,
      });
      if (!data.success) {
        toast.error(data.error ?? "初始化失败");
        return;
      }
      toast.success("管理员账号已创建");
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: ApiResponse<unknown> } })?.response?.data
          ?.error ?? "初始化失败，请稍后重试";
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
        <h1 className="text-xl font-semibold tracking-tight">Snow Data</h1>
      </div>
      <Card className="shadow-xl border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">初始化管理员</CardTitle>
          <CardDescription>
            这是首次部署，请创建第一个管理员账号。该账号拥有最高权限。
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="登录用的账号，如 admin"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="至少 8 位"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">确认密码</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="再次输入密码"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "处理中…" : "创建管理员并进入"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
