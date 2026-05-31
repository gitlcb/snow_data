/**
 * 解析对外站点 origin：优先用超管配置的网站地址（去尾斜杠），
 * 未配置时回退到请求推断（保持原行为）。
 *
 * 存在意义：容器里 Next standalone 绑 HOSTNAME=0.0.0.0，使得
 * `new URL(req.url).origin` 会得到 http://0.0.0.0:3000，污染 OAuth 回调等对外 URL。
 * 配置网站地址后即与请求/容器绑定地址解耦。
 */
export function resolveOrigin(
  siteUrl: string | null | undefined,
  req: { url: string },
): string {
  const s = (siteUrl ?? "").trim().replace(/\/+$/, "");
  if (s) return s;
  return new URL(req.url).origin;
}
