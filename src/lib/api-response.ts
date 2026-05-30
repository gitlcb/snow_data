import { NextResponse } from "next/server";

export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: ApiMeta;
}

export function ok<T>(data: T, meta?: ApiMeta, status = 200) {
  const body: ApiResponse<T> = { success: true, data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status });
}

export function fail(error: string, status = 400) {
  const body: ApiResponse<never> = { success: false, error };
  return NextResponse.json(body, { status });
}

export function tooMany(retryAfter: number) {
  const body: ApiResponse<never> = { success: false, error: "请求过于频繁，请稍后再试" };
  return NextResponse.json(body, {
    status: 429,
    headers: { "Retry-After": String(retryAfter) },
  });
}
