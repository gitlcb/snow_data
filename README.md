# Snow Data — 通用数据存储系统（迷你 BaaS）

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
- **开箱即用**：首次部署无需手动建账号 —— 访问站点会自动引导到初始化页，在网页上创建第一个超级管理员（用户名 + 密码）。
- **超管治理**：用户管理（禁用/删除/角色）、注册开关、上传大小/类型限制、Linux Do OAuth 配置、对外站点地址。
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

# 4. 启动开发服务器
npm run dev
#    打开 http://localhost:3000

# 5. 首次访问会自动跳到 /setup —— 在网页上创建第一个超级管理员（用户名 + 密码）
#    之后用该账号登录后台即可。
```

> **可选**：想直接灌入示例 App + 数据，可改跑 `npm run db:seed`
> （创建超管 `admin@snow.dev` / `admin123`，可用 `SEED_ADMIN_PASSWORD` 覆盖）。
> 跑过 seed 后，由于已存在超管，`/setup` 初始化页会自动失效。两种方式二选一即可。

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
| `/setup` | **首次初始化**：仅当库中无超管时可访问，创建第一个超级管理员；初始化后自动失效 |
| `/admin-console` | **超管专属**：用户管理、系统设置（注册开关/上传限制/站点地址）、Linux Do OAuth 配置 |

后台支持邮箱密码登录与 Linux Do OAuth；暗色模式（亮/暗/跟随系统）。

## 部署

提供两套 Docker 方案，按你是否已有 MySQL 选择：

| 方案 | 适用 | compose 文件 | MySQL |
|---|---|---|---|
| **A. 一体化** | 全新机器，想连 MySQL 一起拉起 | `docker-compose.yml` | 容器内置 MySQL 8 |
| **B. 接管自有 MySQL** | 机器上已有 MySQL（与其他服务共用） | `docker-compose.prod.yml` | 复用宿主机现有 MySQL |

两套都把 Next.js 以 standalone 模式打包进镜像，上传文件持久化到 `uploads` 命名卷。

> ⚠️ **迁移要单独跑**：standalone 运行镜像为减体积，不含完整的 Prisma CLI 依赖，**无法在 app 容器内执行 `prisma migrate deploy`**。请按下文用「builder 阶段镜像」跑一次性迁移，再启动 app。

### 方案 A：一体化（内置 MySQL）

```bash
# 1. 准备环境变量
cp .env.example .env
# 编辑 .env，至少设置：
#   MYSQL_ROOT_PASSWORD="一个强密码"
#   MYSQL_DATABASE="snow_admin"
#   DATABASE_URL="mysql://root:上面的强密码@db:3306/snow_admin"   # 注意 host 是服务名 db
#   JWT_SECRET="$(openssl rand -hex 32)"

# 2. 构建运行镜像 + builder 阶段镜像（后者用于迁移）
docker compose build
docker build --target builder -t snow_data-migrate .

# 3. 先启动 db（app 先不急），并应用迁移
docker compose up -d db
docker run --rm --network "$(basename "$PWD" | tr '[:upper:]' '[:lower:]')_default" \
  -e DATABASE_URL="mysql://root:上面的强密码@db:3306/snow_admin" \
  snow_data-migrate node_modules/.bin/prisma migrate deploy
#    --network 为 compose 默认网络名（通常是 <目录名小写>_default）；
#    可用 `docker network ls | grep default` 确认实际名称。

# 4. 启动 app
docker compose up -d

# 5. 打开 http://<服务器IP>:3000 —— 会自动跳到 /setup 创建第一个管理员
```

> 内置 db 不对宿主暴露 3306（仅 compose 内网用服务名 `db` 访问）。如需外部连库，临时给 db 加 `ports: ["127.0.0.1:3306:3306"]`。

### 方案 B：接管已有 MySQL（推荐用于共享服务器）

适用于机器上已经跑着 MySQL（可能还有 nginx 反代、其他服务）的场景。app 容器经 `host.docker.internal` 访问宿主机的 MySQL。

```bash
# 1. 在你现有的 MySQL 里建库（utf8mb4）
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS snow_admin \
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
#    确保连库账号能从 Docker 网段访问（如 root 允许 host '%'，或单独建账号授权）。

# 2. 准备 .env.production（被 .gitignore 忽略，不会入库）
cat > .env.production <<'EOF'
# host.docker.internal 指向宿主机；端口为你宿主机 MySQL 的端口
DATABASE_URL="mysql://root:你的MySQL密码@host.docker.internal:3306/snow_admin"
JWT_SECRET="用 openssl rand -hex 32 生成"
NODE_ENV="production"
CORS_ALLOW_ORIGINS="*"
EOF

# 3. 构建运行镜像 + builder 阶段镜像（后者用于迁移）
docker compose -f docker-compose.prod.yml build
docker build --target builder -t snow_data-migrate .

# 4. 跑一次性迁移（builder 镜像里有完整 Prisma CLI）
docker run --rm --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL="mysql://root:你的MySQL密码@host.docker.internal:3306/snow_admin" \
  -w /app snow_data-migrate node_modules/.bin/prisma migrate deploy

# 5. 启动 app（仅 app 容器，默认发布 3005 → 宿主机）
docker compose -f docker-compose.prod.yml up -d

# 6. 访问 http://<服务器IP>:3005 —— 自动跳 /setup 创建第一个管理员
```

`docker-compose.prod.yml` 关键点（已内置，无需改）：

- `extra_hosts: ["host.docker.internal:host-gateway"]` —— 让容器能解析到宿主机访问其 MySQL。
- `HOSTNAME: "0.0.0.0"` —— Next standalone 默认绑容器主机名，会导致容器内 healthcheck 不通；显式绑全接口修复。
- `ports: ["3005:3000"]` —— 对宿主发布 3005（避开常见占用端口）。改这里调整对外端口。

#### 配在域名 + HTTPS 后面（nginx 反代示例）

app 只监听 HTTP（3005）。用宿主机的 nginx 终止 TLS 并反代：

```nginx
server {
    listen 80;
    server_name data.example.com;
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl;
    http2 on;
    server_name data.example.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    client_max_body_size 50m;   # 文件上传留足余量

    location / {
        proxy_pass http://127.0.0.1:3005;   # Docker 容器发布的端口
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> 用域名访问后，到 `/admin-console` → 系统设置 → **站点地址** 填上 `https://data.example.com`。
> 否则 OAuth 回调、文档示例里的 Base URL 会用容器推断出的地址（可能是 `0.0.0.0`），导致 Linux Do 登录跳转错误。

### 升级（已部署后拉取新代码）

```bash
git pull
docker compose -f docker-compose.prod.yml build          # 或不带 -f 用方案 A
docker build --target builder -t snow_data-migrate .      # 如有新迁移
docker run --rm --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL="...同上..." -w /app \
  snow_data-migrate node_modules/.bin/prisma migrate deploy   # 有新迁移时才需
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

> 迁移是幂等的（`migrate deploy` 只应用未执行过的迁移）；无新迁移时第 3、4 步可跳过。

## 安全说明

- 密码 bcrypt hash 存储；API Key 以 sha256 校验。
- 所有外部输入经 zod 校验；`queryRaw` 全部参数化，字段名走白名单。
- admin 写请求做 CSRF 同源校验；session cookie 为 httpOnly，生产环境 secure。
- **已知权衡**：API Key 明文（`keyPlain`）持久化存库，便于在后台随时查看/选用 —— 适用于个人自建场景。早期创建的 Key 未存明文，不可回填。
- 切勿提交真实 `.env`（已在 `.gitignore`），用 `.env.example` 作模板。

## 许可

[MIT](./LICENSE) © gitlcb
