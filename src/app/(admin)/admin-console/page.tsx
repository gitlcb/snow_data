import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminConsole } from "./console";

// 服务端守卫：非超管直接跳走（前端兜底，真正鉴权在 /api/superadmin/*）
export default async function AdminConsolePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "superadmin") redirect("/dashboard");

  return <AdminConsole />;
}
