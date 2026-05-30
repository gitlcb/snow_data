import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_NAME, getJwtSecret } from "@/lib/auth-secret";

async function isValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getJwtSecret());
    return true;
  } catch {
    return false;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** 同源校验：阻止跨站携带 cookie 的写操作（CSRF 防御）。 */
function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // 非浏览器发起（如 curl）无 Origin，放行交由鉴权处理
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const valid = await isValid(token);

  // 受保护的 admin 页面与 admin API
  const isProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/apps") ||
    pathname.startsWith("/data") ||
    pathname.startsWith("/files") ||
    pathname.startsWith("/usage") ||
    pathname.startsWith("/docs") ||
    pathname.startsWith("/admin-console");
  const isAdminApi =
    pathname.startsWith("/api/admin") || pathname.startsWith("/api/superadmin");

  // CSRF：cookie 鉴权的 admin 写请求必须同源
  if (isAdminApi && !SAFE_METHODS.has(req.method) && !isSameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: "跨站请求被拒绝" },
      { status: 403 },
    );
  }

  if ((isProtectedPage || isAdminApi) && !valid) {
    if (isAdminApi) {
      return NextResponse.json(
        { success: false, error: "未登录" },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 已登录访问登录/注册页 -> 跳转仪表盘
  if (valid && (pathname === "/login" || pathname === "/register")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/apps/:path*",
    "/data/:path*",
    "/files/:path*",
    "/usage/:path*",
    "/docs/:path*",
    "/admin-console/:path*",
    "/api/admin/:path*",
    "/api/superadmin/:path*",
    "/login",
    "/register",
  ],
};
