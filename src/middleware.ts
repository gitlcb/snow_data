import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me-in-production-please-32chars",
);
const COOKIE_NAME = "snow_session";

async function isValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
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
    pathname.startsWith("/files");
  const isAdminApi = pathname.startsWith("/api/admin");

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
    "/api/admin/:path*",
    "/login",
    "/register",
  ],
};
