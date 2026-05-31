"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  // 可选文字标签：不传则纯图标（保持原 apps 页样式）
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
  successMessage?: string;
}

/** 复制到剪贴板按钮：复制成功 1.5s 内显示对勾，并弹 toast。 */
export function CopyButton({
  value,
  label,
  variant = "outline",
  size,
  className,
  successMessage = "已复制",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (await copyText(value)) {
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("复制失败");
    }
  }

  const Icon = copied ? Check : Copy;

  return (
    <Button
      variant={variant}
      size={size ?? (label ? "default" : "icon")}
      onClick={copy}
      type="button"
      className={cn(className)}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}
