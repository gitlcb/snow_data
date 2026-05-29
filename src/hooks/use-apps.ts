"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface App {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  _count?: { records: number; apiKeys: number };
}

/** 拉取当前用户的应用列表，供其他页面（数据浏览/文件管理）复用 */
export function useApps() {
  return useQuery<App[]>({
    queryKey: ["apps"],
    queryFn: () => api.get("/admin/apps").then((r) => r.data.data),
  });
}
