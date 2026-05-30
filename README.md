# Snow Admin — 通用数据存储系统（迷你 BaaS）

一个跑在 MySQL 上的通用数据存储后端，给个人的各种小 demo 当统一数据仓库。

- **demo 侧**：通过 HTTP API + API Key 读写任意 JSON 数据、上传文件，无需各自建后端建库。
- **管理侧**：通过精致的 admin 后台管理应用、浏览数据、查看用量统计、配置系统。

一句话：**一个自建的、精简版的 Supabase / Firebase，专为个人 demo 的数据存取服务。**

> 完整架构蓝图与编码约定见 [`AGENTS.md`](./AGENTS.md)。

## 特性

- **多租户数据存储**：`User → App → Collection → Record`，所有数据共用一批表，靠 `app_id` / `owner_id` 逻辑隔离。Collection 写入时自动创建，无需预声明。
- **App API Key**：每个 App 可生成多把 Key，支持 `readonly` / `readwrite` 权限范围与过期时间。
- **终端用户认证**：App 可为「自己的用户」提供注册/登录（JWT），数据按 `owner` 隔离 —— 终端用户只能看到自己的记录。
- **查询能力**：字段过滤（7 种算子）、排序、分页、字段投影、聚合统计（count/sum/avg/min/max + 分组）、CSV/JSON 导出导入。
- **文件存储**：multipart 上传到服务器本地磁盘，DB 只存元数据；按 Key 或登录态鉴权访问。
- **Admin 后台**：仪表盘、应用管理、数据浏览器、文件管理、用量统计、交互式 API 文档页。
- **超管治理**：用户管理（禁用/删除/角色）、注册开关、上传大小/类型限制、Linux Do OAuth 配置。
- **安全**：密码 bcrypt、Key sha256 校验、zod 输入校验、参数化查询、限流、CSRF 同源校验、统一响应信封。

## 技术栈

| 层 | 选型 |
|---|---|
| 全栈框架 | Next.js 15 (App Router) · React 19 · TypeScript |
| 数据层 | Prisma · MySQL（JSON 列存文档，复杂查询用 `queryRaw`）|
| UI | shadcn/ui · Tailwind CSS 4 · Radix UI · lucide-react |
| 数据请求 | TanStack Query · axios |
| 图表 | recharts |
| 鉴权 | jose（JWT）· bcryptjs · cookie session |
| 校验 | zod |
| 部署 | Docker Compose（Next.js standalone + MySQL 8）|

## 快速开始

### 前置要求

- Node.js 22（Docker 镜像基于 `node:22-alpine`）
- MySQL 8（本地或 Docker）

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（复制模板后填写）
cp .env.example .env
#    DATABASE_URL="mysql://root:你的密码@127.0.0.1:3306/snow_admin"
#    JWT_SECRET   用 openssl rand -hex 32 生成（必须 >=32 字符且非占位值）

# 3. 建表（开发用 migrate dev，会创建库并应用全部迁移 + 生成 Prisma client）
npm run db:migrate
#    或纯 SQL 建库： mysql -u root -p < prisma/init.sql

# 4. 灌入示例数据 + 创建登录账号
npm run db:seed
#    -> 超管账号 admin@snow.dev / 密码 admin123
#       （可用 SEED_ADMIN_PASSWORD 覆盖；NODE_ENV=production 时 seed 自动跳过）

# 5. 启动开发服务器
npm run dev
#    打开 http://localhost:3000
```

### 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | MySQL 连接串，必须以 `mysql://` 开头。启动时 fail-fast 校验。 |
| `JWT_SECRET` | 是 | JWT 与 session cookie 的签名密钥，`>=32` 字符且非占位值。`openssl rand -hex 32` 生成。 |
| `NODE_ENV` | 否 | `development`（默认）/ `test` / `production`。影响 cookie secure、日志级别、seed 跳过等。 |
| `CORS_ALLOW_ORIGINS` | 否 | 对外 `/api/v1` 允许的跨域来源，逗号分隔。默认 `*`，生产建议收敛。 |
| `SEED_ADMIN_PASSWORD` | 否 | 仅 `db:seed` 读取，覆盖种子超管的初始密码（默认 `admin123`）。 |

> **Linux Do OAuth 凭据不走环境变量** —— Client ID / Secret / 启用开关存在数据库 `system_config` 单行表，由超管在 `/admin-console` 控制台运行时配置。

### 常用脚本

```bash
npm run dev          # 开发服务器（端口 3000）
npm run build        # prisma generate + next build
npm run start        # 生产服务器
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run format       # prettier --write .
npm run db:migrate   # 开发：创建/应用迁移（migrate dev）
npm run db:deploy    # 生产：幂等应用迁移（migrate deploy）
npm run db:generate  # 仅生成 Prisma client
npm run db:push      # 不留迁移记录直接同步 schema（快速原型用）
npm run db:seed      # 灌入种子数据
```

## 数据模型

```
User（多用户，按用户隔离）
 └─ App（一个 demo = 一个 App）
      ├─ ApiKey（绑定到 App，sha256 校验，含 scope/过期）
      ├─ Record（任意 JSON，collection 字段区分集合；owner_id 归属终端用户）
      ├─ FileAsset（文件元数据，实体存本地磁盘）
      ├─ EndUser（App 维度的终端用户，邮箱+密码）
      └─ UsageStat（按小时桶聚合的 API 调用计数）

SystemConfig（全局单行表：注册开关 / OAuth 配置 / 上传限制）
```

主键全部为应用层 `nanoid`（短、URL 友好），非数据库自增。所有子表对 App 级联删除。集合（Collection）不是独立表，而是 `Record.collection` 字符串字段。

## 对外 API

所有 `/api/v1/*` 端点用请求头鉴权：

```
Authorization: Bearer <token>
```

- token 以 `sk_live_` 开头 → 按 **App Key** 解析（可见该 App 全部数据，权限由 Key 的 scope 决定）。
- 否则 → 按 **终端用户 JWT** 解析（仅可见 / 操作自己 `owner_id` 的记录，权限恒为 readwrite）。

> 终端用户身份仅 `GET/POST /api/v1/{collection}` 与 `GET/PATCH/DELETE /api/v1/{collection}/{id}` 支持；`meta/*`、`files`、`auth/*` 仅接受 App Key。

### 数据 CRUD

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/v1/{collection}` | 列表：分页 + 过滤 + 排序 + 字段投影 |
| `GET` | `/api/v1/{collection}/{id}` | 取单条（不存在返回 404）|
| `POST` | `/api/v1/{collection}` | 创建：JSON 对象单条，或 JSON 数组批量（≤100）。需 readwrite |
| `PATCH` | `/api/v1/{collection}/{id}` | 浅合并更新（保留未传字段）。需 readwrite |
| `DELETE` | `/api/v1/{collection}/{id}` | 删除。需 readwrite |

**列表查询参数**：

| 参数 | 说明 |
|---|---|
| `filter` | 逗号分隔，`field:value`（eq）或 `field_op:value`。算子：`eq` `ne` `gt` `gte` `lt` `lte` `like` |
| `sort` | `field`（升序）或 `-field`（降序），默认 `-created_at` |
| `page` | 页码，默认 1 |
| `limit` | 每页条数，默认 20，最大 100 |
| `fields` | 字段投影，逗号分隔，仅返回 `data` 中指定键 |

### 查询与聚合 / 导出导入（仅 App Key）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/v1/meta/collections` | 列出本 App 所有集合及记录数 |
| `GET` | `/api/v1/meta/aggregate` | 聚合：`?collection=&op=count\|sum\|avg\|min\|max&field=&groupBy=`（分组结果按值降序，≤50 组）|
| `GET` | `/api/v1/meta/export` | 导出：`?collection=&format=csv\|json`（≤10000 条，直接下载文件）|
| `POST` | `/api/v1/meta/import` | 导入：body JSON 数组（≤1000），兼容导出格式。需 readwrite |

### 文件

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/v1/files` | 上传：`multipart/form-data`，字段名 `file`。需 readwrite。返回 `{id,filename,url,size,mimeType}` |
| `GET` | `/api/files/{id}` | 访问/下载：图片内联展示，其余强制下载。App Key 或登录态均可访问 |

### 终端用户认证

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/v1/auth/register` | 用 App Key 标识 App，body `{email,password}`（密码 8-128 位）→ `{id,email,token}` |
| `POST` | `/api/v1/auth/login` | body `{email,password}` → `{id,email,token}`。token 有效期 30 天，可代替 Key 调数据接口，仅见自己的数据 |

### 调用示例

```bash
# 写入一条记录
curl -X POST http://localhost:3000/api/v1/todos \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"title":"buy milk","done":false,"priority":2}'

# 过滤 + 排序 + 分页
curl "http://localhost:3000/api/v1/todos?filter=done:false,priority_gte:2&sort=-priority&page=1&limit=20" \
  -H "Authorization: Bearer sk_live_xxx"

# 聚合：按 done 分组计数
curl "http://localhost:3000/api/v1/meta/aggregate?collection=todos&op=count&groupBy=done" \
  -H "Authorization: Bearer sk_live_xxx"

# 上传文件
curl -X POST http://localhost:3000/api/v1/files \
  -H "Authorization: Bearer sk_live_xxx" \
  -F "file=@./photo.png"
```

> 登录后台 → **API 文档** 页可选择应用与密钥，示例会自动填入真实 base URL 与 Key，并可一键复制「AI 提示词」交给 ChatGPT / Claude 直接操作你的数据。

### 统一响应格式

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: { total: number; page: number; limit: number } // 列表才有
}
```

成功 `{ success: true, data, meta? }`；失败 `{ success: false, error }`。

### 错误码

| 状态码 | 含义 |
|---|---|
| `400` | 参数错误（非法 JSON / 批量越界 / 聚合参数缺失等）|
| `401` | 鉴权失败（无效的 API Key 或令牌）|
| `403` | 只读 Key 执行写操作 / 跨站请求被拒 / 权限不足 |
| `404` | 记录或文件不存在 |
| `413` | 请求体过大（JSON 1MB / 导入 5MB / 文件超上限）|
| `415` | 不支持的文件类型 |
| `429` | 请求过于频繁（响应带 `Retry-After` 头）|

### 限流

单实例内存固定窗口（每 IP / Key）。默认配额：数据接口 **120 次 / 60s**；文件上传 30、导出/导入各 20、终端登录 10、注册 5。

## Admin 后台

| 路由 | 功能 |
|---|---|
| `/dashboard` | 仪表盘：应用/记录/Key/文件统计卡 + 写入趋势 + 集合分布 + 最近活动 |
| `/apps` | 应用管理：列表、新建；进入详情可管理 API Key、终端用户 |
| `/apps/{id}` | 应用详情：接入信息、Key 生成/删除/查看明文、终端用户管理 |
| `/data` | 数据浏览器：选应用 → 选集合 → 增删改查记录、搜索、导出/导入 |
| `/files` | 文件管理：上传、预览、复制 URL、删除 |
| `/usage` | 用量统计：调用总数、状态码分布、按方法分布、近 30 天趋势 |
| `/docs` | 交互式 API 文档：自动填充示例、复制 AI 提示词 |
| `/admin-console` | **超管专属**：用户管理、系统设置（注册开关/上传限制）、Linux Do OAuth 配置 |

后台支持邮箱密码登录与 Linux Do OAuth；暗色模式（亮/暗/跟随系统）。

## 部署（Docker Compose）

```bash
# 1. 配置 compose 所需环境变量（MYSQL_ROOT_PASSWORD 等，见 .env.example 末尾）
# 2. 构建并启动
docker compose up -d --build
```

- `app` 容器启动时执行 `prisma migrate deploy`（幂等应用迁移）后运行 Next.js standalone。
- `db` 容器为 MySQL 8，数据持久化到命名卷；不对宿主暴露端口。
- 上传文件持久化到 `uploads` 命名卷（挂载到 `/app/uploads`）。

## 安全说明

- 密码 bcrypt hash 存储；API Key 以 sha256 校验。
- 所有外部输入经 zod 校验；`queryRaw` 全部参数化，字段名走白名单。
- admin 写请求做 CSRF 同源校验；session cookie 为 httpOnly，生产环境 secure。
- **已知权衡**：API Key 明文（`keyPlain`）持久化存库，便于在后台随时查看/选用 —— 适用于个人自建场景。早期创建的 Key 未存明文，不可回填。
- 切勿提交真实 `.env`（已在 `.gitignore`），用 `.env.example` 作模板。

## 许可

个人项目，未附许可证。
