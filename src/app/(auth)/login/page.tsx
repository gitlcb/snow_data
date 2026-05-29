"use client";

import { useState } from "react";
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
            <p className="text-sm text-muted-foreground">
              没有账号？{" "}
              <Link
                href="/register"
                className="text-primary font-medium hover:underline"
              >
                去注册
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
