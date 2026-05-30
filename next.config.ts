import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  async headers() {
    return [
      {
        // 安全头只覆盖 admin 页面与 admin API，避免给对外 /api/v1/* 加 X-Frame-Options
        source: "/((?!api/v1|api/files).*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
