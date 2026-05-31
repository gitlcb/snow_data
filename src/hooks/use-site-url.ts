"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface PublicConfig {
  siteUrl: string;
  registrationOpen: boolean;
  linuxdoEnabled: boolean;
}

/**
 * 文档/示例用的对外 Base URL。优先级：
 *   超管配置的网站地址 > 浏览器当前 origin（挂载后）> 占位
 * window.location.origin 放 useEffect 填充，避免 SSR/首次渲染 hydration mismatch。
 */
export function useSiteUrl(): string {
  const [mountedOrigin, setMountedOrigin] = useState("");
  useEffect(() => {
    setMountedOrigin(window.location.origin);
  }, []);

  const { data } = useQuery<PublicConfig>({
    queryKey: ["public-config"],
    queryFn: () => api.get("/auth/public-config").then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  return (data?.siteUrl || mountedOrigin || "https://your-host").replace(/\/+$/, "");
}
