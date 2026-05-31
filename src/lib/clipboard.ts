// 复制文本到剪贴板，兼容非安全上下文（纯 HTTP / 裸 IP）。
//
// navigator.clipboard 仅在安全上下文（HTTPS 或 localhost）可用；在 http://裸IP
// 部署下 navigator.clipboard 为 undefined，调用会抛错。此处回退到 execCommand
// 方案：临时插入 textarea、选中、execCommand("copy")。必须在用户手势的同步调用
// 栈内执行，故调用方应在 onClick 中尽早调用（值需已就绪，勿在 await 之后）。
export async function copyText(text: string): Promise<boolean> {
  // 优先用标准 API（安全上下文）
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 继续尝试回退方案
    }
  }
  // 回退：textarea + execCommand（非安全上下文唯一可用路径）
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    // 移出视口又保持可聚焦，避免页面滚动跳动
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    ta.setAttribute("readonly", "");
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length); // iOS Safari 需要显式 range
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
