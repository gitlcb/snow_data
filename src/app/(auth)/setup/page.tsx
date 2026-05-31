import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SetupForm } from "./setup-form";

// 依赖数据库查询，必须按请求渲染；否则构建期静态预渲染会因无数据库而失败
export const dynamic = "force-dynamic";

// 已存在超管则不允许再访问初始化页（权威判断在服务端，中间件无法查库）
export default async function SetupPage() {
  const adminCount = await prisma.user.count({ where: { role: "superadmin" } });
  if (adminCount > 0) redirect("/login");
  return <SetupForm />;
}
