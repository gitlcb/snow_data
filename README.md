# Snow Admin — 通用数据存储系统（迷你 BaaS）

一个跑在 MySQL 上的通用数据存储后端，给个人小 demo 当统一数据仓库。
demo 通过 HTTP API + API Key 读写任意 JSON 数据，你通过 admin 后台管理应用、浏览数据、看统计。

> 完整架构与约定见 [`AGENTS.md`](./AGENTS.md)。

## 技术栈

Next.js 15 (App Router) · React 19 · TypeScript · Prisma · MySQL · shadcn/ui · Tailwind 4 · TanStack Query/Table · recharts · zustand

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 确认 .env 中的 DATABASE_URL（默认本机 root/root）
#    DATABASE_URL="mysql://root:root@127.0.0.1:3306/snow_admin"

# 3. 生成 Prisma client 并建表
npm run db:generate
npm run db:push

# 4. （可选）灌入示例数据 + 创建登录账号
npm run db:seed
#    -> 账号 admin@snow.dev / 密码 admin123

# 5. 启动
npm run dev
#    打开 http://localhost:3000
```

## 数据模型

```
User → App（一个 demo 一个 App）→ Collection（自动创建）→ Record（任意 JSON）
```

## 对外 API（给你的 demo 调用）

请求头带 `Authorization: Bearer <你的 API Key>`。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/{collection}` | 写入一条记录 |
| GET | `/api/v1/{collection}` | 列表（分页 + 字段过滤 + 排序）|
| GET | `/api/v1/{collection}/{id}` | 取单条 |
| PATCH | `/api/v1/{collection}/{id}` | 更新（浅合并）|
| DELETE | `/api/v1/{collection}/{id}` | 删除 |
| POST | `/api/v1/files` | 上传文件（multipart）|

### 查询示例

```bash
# 写入
curl -X POST http://localhost:3000/api/v1/todos \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"title":"buy milk","done":false,"priority":2}'

# 过滤 + 排序
curl "http://localhost:3000/api/v1/todos?filter=done:false,priority_gte:2&sort=-priority&page=1&limit=20" \
  -H "Authorization: Bearer sk_live_xxx"
```

过滤算子：`eq`(默认) `ne` `gt` `gte` `lt` `lte` `like`，写法 `字段:值` / `字段_gt:值`。
排序：`sort=字段`(升) / `sort=-字段`(降)。

## Admin 后台

- `/dashboard` 概览仪表盘（统计 + 趋势图）
- `/apps` 应用管理 + API Key 生成/吊销
- `/data` 数据浏览器（增删改查任意记录）
- `/files` 文件管理
