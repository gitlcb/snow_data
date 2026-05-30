"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 仅开发期在控制台留痕，便于排查
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div>
        <h2 className="text-lg font-semibold">页面加载出错了</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          可能是网络波动或临时故障，请重试。
        </p>
      </div>
      <Button onClick={reset}>重试</Button>
    </div>
  );
}
