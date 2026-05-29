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
  const email = "admin@snow.dev";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("种子用户已存在，跳过。登录：admin@snow.dev / admin123");
    return;
  }

  const user = await prisma.user.create({
    data: {
      id: nanoid(),
      email,
      password: await bcrypt.hash("admin123", 10),
      name: "Admin",
    },
  });

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
  console.log("  登录账号: admin@snow.dev / admin123");
  console.log("  示例 App:", app.name);
  console.log("  完整 API Key（仅此一次）:", key.plain);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
