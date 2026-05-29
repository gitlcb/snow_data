# AGENTS.md — snow_admin 通用数据存储系统

> 本文件是项目的 AI 协作约定与架构蓝图。任何 AI 助手（Claude Code 等）在本仓库工作前**必须先读本文件**，并严格遵守其中的技术选型、数据模型、目录约定与编码规范。

---

## 一、项目定位

**snow_admin** 是一个跑在 MySQL 上的**通用数据存储系统（迷你 BaaS / Backend-as-a-Service）**，用途是给个人的各种小 demo 当统一后端仓库。

- **demo 侧**：通过 HTTP API + API Key 读写任意 JSON 数据，无需各自建后端建库。
- **管理侧**：作者通过精致的 admin 后台管理应用、浏览数据、查看统计。

一句话：**一个自建的、精简版的 Supabase / Firebase，专为个人 demo 的数据存取服务。**

---

## 二、技术栈（已锁定，勿擅自更换）

| 层 | 选型 | 说明 |
|---|---|---|
| 全栈框架 | **Next.js 16 (App Router) + React 19 + TypeScript** | 单仓库、单部署，前后端一体 |
| 数据层 | **Prisma + MySQL** | JSON 列存文档；复杂 JSON 查询用 `queryRaw` 补 |
| UI 体系 | **shadcn/ui + Tailwind CSS 4 + Radix UI** | 复刻 infinite-canvas 前台那种精致、现代、可定制观感 |
| 图标 | **lucide-react** | |
| 动画 | **motion** (Framer Motion) | |
| 表格 | **TanStack Table** | admin 数据浏览 / CRUD 表格自建 |
| 图表 | **recharts** | 仪表盘统计图 |
| 客户端状态 | **zustand** | |
| 数据请求 | **TanStack Query (react-query) + axios** | |
| 部署 | **Docker Compose** | Next.js 容器 + MySQL 容器 + 挂载卷存文件 |

> UI 灵感来源：`github.com/basketikun/infinite-canvas` 的**前台画布**部分（shadcn/Tailwind 风格），**不是**其 admin 端（那部分用的是 Ant Design Pro，本项目不采用 antd）。

---

## 三、数据模型（4 层 + 单库逻辑隔离）

```
User（多用户，数据按用户隔离）
 └─ App（一个 demo = 一个 App）
      └─ Collection（如 todos / posts / users …，写入时自动创建，无需预先声明）
           └─ Record（一坨任意结构的 JSON）
```

**所有租户数据共用同一批表，靠 `app_id` / `user_id` 列做逻辑隔离**（标准 SaaS 多租户做法），不为每个 App 建独立物理表。

### 核心表设计

```
users
  id          主键
  email       唯一
  password    bcrypt hash
  created_at

apps
  id          主键
  user_id     FK -> users.id（归属用户）
  name        应用名
  description
  created_at

api_keys
  id          主键
  app_id      FK -> apps.id（Key 绑定到 App）
  name        Key 备注名
  key_hash    Key 的 hash（明文仅创建时返回一次，库里只存 hash）
  key_prefix  前几位明文，用于 UI 展示识别
  created_at
  last_used_at

records                       ← 系统的核心表
  id          nanoid（短、URL 友好、对外暴露安全；不用自增整数）
  app_id      FK -> apps.id（逻辑隔离键）
  collection  VARCHAR（集合名）
  data        JSON（实际内容）
  created_at
  updated_at
  索引：(app_id, collection, created_at)；视需要对热门 JSON 路径加生成列索引

files
  id          nanoid
  app_id      FK -> apps.id
  filename    原始文件名
  storage_path 本地磁盘相对路径
  mime_type
  size
  created_at
```

---

## 四、鉴权（两套独立体系）

### 1. Admin 后台 —— 多用户登录
- 多用户注册 / 登录，session 或 JWT。
- 每个用户**只能看见和管理自己的 App 及其数据**。
- 密码 bcrypt 加盐 hash 存储。

### 2. Demo 访问 —— App 级 API Key
- 每个 App 可生成一个或多个 API Key。
- Key **绑定到单个 App**，只能访问该 App 的数据，无法跨 App。
- 请求头：`Authorization: Bearer <api_key>`。
- 库里只存 Key 的 hash，明文仅生成时展示一次。

---

## 五、对外 API（给 demo 调用）

> 路径**不带 app 名**——Key 已绑定 App，系统从 Key 反推所属 App。版本前缀 `/v1/` 给未来留余地。

```
POST   /api/v1/{collection}          写入一条记录
GET    /api/v1/{collection}          列表（分页 + 字段过滤 + 排序）
GET    /api/v1/{collection}/{id}     取单条
PATCH  /api/v1/{collection}/{id}     更新（部分）
DELETE /api/v1/{collection}/{id}     删除（硬删除）
POST   /api/v1/files                 上传文件
```

### 查询能力（中等档：字段过滤 + 排序）
基于 MySQL `JSON_EXTRACT` 实现：

```
GET /api/v1/todos?filter=status:done&age_gt:18&sort=-created_at&page=1&limit=20
```

- 算子：`eq`（默认）、`gt`、`gte`、`lt`、`lte`、`like`、`ne`。
- 写法约定：`字段:值`（eq）、`字段_gt:值`、`字段_like:值` 等。
- 排序：`sort=字段`（升序）、`sort=-字段`（降序），支持按任意 JSON 字段或 `created_at`。
- 分页：`page` + `limit`。

### 统一响应格式

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: { total: number; page: number; limit: number }
}
```

---

## 六、Admin 后台页面

1. **登录 / 注册**
2. **仪表盘（首页）**：总 App 数、总记录数、各 App/集合记录量、近 7/30 天写入趋势折线图、最近活动。统计图用 recharts。
3. **应用管理**：App 列表 / 新建 / 编辑；API Key 生成、查看、吊销。
4. **数据浏览器**：选 App → 选 Collection → 表格查看 / 搜索 / 增删改查 JSON 记录（TanStack Table）。
5. **文件管理**：已上传文件列表，本地磁盘存储。

---

## 七、文件存储

- 文件上传 API 将文件存到**服务器本地磁盘**（Docker 挂载卷），DB `files` 表只记元数据。
- 提供静态服务读取文件。
- 零外部依赖；未来如需可平滑迁移到 S3/OSS（DB 改存 URL 即可）。

---

## 八、目录结构约定

```
snow_admin/
├─ AGENTS.md                  ← 本文件
├─ README.md
├─ docker-compose.yml
├─ Dockerfile
├─ prisma/
│  └─ schema.prisma
├─ src/
│  ├─ app/
│  │  ├─ (auth)/              登录 / 注册
│  │  ├─ (admin)/             admin 后台（受登录保护）
│  │  │  ├─ dashboard/
│  │  │  ├─ apps/
│  │  │  ├─ data/             数据浏览器
│  │  │  └─ files/
│  │  └─ api/
│  │     ├─ auth/             admin 鉴权
│  │     └─ v1/               对外 demo API（API Key 鉴权）
│  │        ├─ [collection]/
│  │        └─ files/
│  ├─ components/
│  │  └─ ui/                  shadcn/ui 组件
│  ├─ lib/                    db、auth、apiKey、query 解析等工具
│  ├─ server/                 服务端业务逻辑（repository / service）
│  └─ stores/                 zustand stores
└─ public/
```

---

## 九、编码规范（强制）

> 以下规范与作者全局规则一致，AI 助手必须遵守。

### 不可变性（关键）
始终创建新对象，**绝不修改原对象**：
```typescript
// ✗ 错误
function update(o, name) { o.name = name; return o }
// ✓ 正确
function update(o, name) { return { ...o, name } }
```

### 文件组织
- 多个小文件 > 少量大文件；高内聚低耦合。
- 单文件通常 200–400 行，最多 800 行；函数 < 50 行。
- 按功能/领域组织，而非按类型。

### 错误处理
- 全面 try/catch，对外错误信息友好且**不泄露敏感数据**（堆栈、SQL、密钥）。

### 输入验证
- 所有用户/外部输入用 **zod** 校验后再用。
- 写入 record 时，data 必须是合法 JSON 对象。

### 安全红线
- 无任何硬编码密钥；一律走环境变量（`process.env.*`），缺失即抛错。
- 参数化查询防 SQL 注入；`queryRaw` 必须用占位符，绝不字符串拼接。
- API Key、密码一律 hash 存储。
- 所有 `/api/v1/*` 端点做 Key 校验 + 速率限制。
- 提交代码中**无 `console.log`**、无注释掉的废代码。

### 注释
- 默认不写注释；仅在「为什么」非显而易见时（隐藏约束、绕过特定 bug、反直觉行为）写一行。
- 不写解释「做什么」的注释，不写多段 docstring。

---

## 十、AI 助手协作指引

1. **改代码前先读本文件**，确认技术选型与数据模型，不擅自引入新依赖或更换框架。
2. **复杂功能先规划**：用 planner agent 出实现计划，分阶段。
3. **TDD 优先**：新功能/Bug 修复先写测试（红→绿→重构），覆盖率目标 80%+。测试分单元 / 集成（API 端点 + DB）/ E2E（Playwright 关键流程）。
4. **写完代码立即 code review**：用 code-reviewer agent，解决 Critical/High，尽量修 Medium。
5. **提交前安全检查**：用 security-reviewer agent 过一遍安全红线。
6. **独立任务并行执行**：互不依赖的分析/审查用并行 agent。
7. **Git 提交规范**：`<type>: <描述>`（feat/fix/refactor/docs/test/chore/perf/ci）。提交信息只含信息本身，**不加任何 AI 署名 / emoji / Co-Authored-By**。
8. **风险操作先确认**：删库、force push、reset --hard、改 CI 等不可逆/影响共享状态的操作，执行前必须征得作者同意。

---

## 十一、当前进度

- [x] 需求访谈与架构设计（已完成，固化于本文件）
- [ ] 项目脚手架（Next.js + Prisma + shadcn/ui 初始化）
- [ ] Prisma schema 与 MySQL 迁移
- [ ] Admin 鉴权（多用户登录/注册）
- [ ] App 与 API Key 管理
- [ ] 对外 v1 数据 API（CRUD + 字段过滤排序）
- [ ] 数据浏览器界面
- [ ] 文件上传与管理
- [ ] 仪表盘统计
- [ ] Docker Compose 部署配置
