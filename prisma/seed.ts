import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

function genKey() {
  const raw = randomBytes(24).toString("hex");
  const plain = `sk_live_${raw}`;
  return {
    plain,
    keyHash: createHash("sha256").update(plain).digest("hex"),
    keyPrefix: `${plain.slice(0, 12)}...`,
  };
}

async function main() {
  // 生产环境默认跳过整套示例数据；但允许用 SEED_ADMIN_FORCE=1 仅创建超管账号
  const isProd = process.env.NODE_ENV === "production";
  const force = process.env.SEED_ADMIN_FORCE === "1";
  if (isProd && !force) {
    console.log("生产环境禁止运行 seed，已跳过。");
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@snow.dev";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // 确保已存在的种子账号是超级管理员
    if (existing.role !== "superadmin") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "superadmin" },
      });
      console.log("已将种子账号升级为超级管理员。");
    }
    console.log("种子用户已存在，跳过。");
    return;
  }

  const user = await prisma.user.create({
    data: {
      id: nanoid(),
      email,
      password: await bcrypt.hash(password, 10),
      name: "Admin",
      role: "superadmin",
    },
  });

  // 生产环境（force 模式）只建超管账号，不灌示例 App/数据
  if (isProd) {
    console.log("已创建超级管理员账号：");
    console.log(`  登录账号: ${email} / ${password}`);
    return;
  }


  const app = await prisma.app.create({
    data: {
      id: nanoid(),
      userId: user.id,
      name: "示例待办 Demo",
      description: "演示用应用，含一个 todos 集合",
    },
  });

  const key = genKey();
  await prisma.apiKey.create({
    data: {
      id: nanoid(),
      appId: app.id,
      name: "默认 Key",
      keyHash: key.keyHash,
      keyPrefix: key.keyPrefix,
      keyPlain: key.plain,
    },
  });

  const sampleTodos = [
    { title: "学习 Snow Admin", done: true, priority: 1 },
    { title: "写第一个 demo", done: false, priority: 2 },
    { title: "接入 API", done: false, priority: 3 },
  ];
  for (const t of sampleTodos) {
    await prisma.record.create({
      data: { id: nanoid(), appId: app.id, collection: "todos", data: t },
    });
  }

  console.log("种子完成：");
  console.log(`  登录账号: ${email} / ${password}`);
  console.log("  示例 App:", app.name);
  console.log("  完整 API Key（仅此一次）:", key.plain);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
