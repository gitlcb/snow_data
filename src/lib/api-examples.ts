// API 文档页用的端点示例数据。纯数据模块（不放 route 目录，避免 Next 路由文件只能导出 handler 的限制）。
// 每个端点提供 curl 与 JavaScript(fetch) 两种可复制片段，运行时注入真实 baseUrl / apiKey / collection。

export interface ExampleCtx {
  baseUrl: string; // 形如 http://localhost:3000，无尾部斜杠
  apiKey: string; // 完整 key 或占位符 sk_live_YOUR_KEY
  collection: string; // 集合名，默认 todos
}

export type EndpointGroup = "数据 CRUD" | "查询与聚合" | "文件" | "终端用户认证";

export interface ParamDoc {
  name: string;
  required: boolean;
  desc: string;
}

export interface EndpointExample {
  id: string; // 锚点用，唯一
  group: EndpointGroup;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string; // 展示用路径模板，如 /api/v1/{collection}/{id}
  title: string;
  desc: string;
  needWrite?: boolean; // 是否需要 readwrite Key
  params?: ParamDoc[];
  curl: (ctx: ExampleCtx) => string;
  js: (ctx: ExampleCtx) => string;
}

export const DEFAULT_COLLECTION = "todos";
export const KEY_PLACEHOLDER = "sk_live_YOUR_KEY";

// 鉴权头片段
function authHeaderCurl(ctx: ExampleCtx): string {
  return `-H "Authorization: Bearer ${ctx.apiKey}"`;
}

const JSON_CT = `-H "Content-Type: application/json"`;

export const ENDPOINTS: EndpointExample[] = [
  // ---------- 数据 CRUD ----------
  {
    id: "list",
    group: "数据 CRUD",
    method: "GET",
    path: "/api/v1/{collection}",
    title: "查询记录列表",
    desc: "分页返回某集合的记录。支持过滤、排序、字段投影。响应 meta 含 total/page/limit。",
    params: [
      { name: "filter", required: false, desc: "过滤，如 status:done 或 age_gt:18（算子 eq/ne/gt/gte/lt/lte/like），多条逗号分隔" },
      { name: "sort", required: false, desc: "排序字段，前缀 - 表示倒序，如 -created_at" },
      { name: "page", required: false, desc: "页码，默认 1" },
      { name: "limit", required: false, desc: "每页条数，默认 20，最大 100" },
      { name: "fields", required: false, desc: "只返回 data 中指定字段，逗号分隔，如 title,done" },
    ],
    curl: (ctx) =>
      `curl ${authHeaderCurl(ctx)} \\\n  "${ctx.baseUrl}/api/v1/${ctx.collection}?sort=-created_at&page=1&limit=20"`,
    js: (ctx) =>
      `const res = await fetch("${ctx.baseUrl}/api/v1/${ctx.collection}?sort=-created_at&page=1&limit=20", {
  headers: { Authorization: "Bearer ${ctx.apiKey}" },
});
const { data, meta } = await res.json();
console.log(data, meta); // data: 记录数组, meta: { total, page, limit }`,
  },
  {
    id: "get-one",
    group: "数据 CRUD",
    method: "GET",
    path: "/api/v1/{collection}/{id}",
    title: "查询单条记录",
    desc: "按 id 取单条记录，不存在返回 404。",
    curl: (ctx) =>
      `curl ${authHeaderCurl(ctx)} \\\n  "${ctx.baseUrl}/api/v1/${ctx.collection}/RECORD_ID"`,
    js: (ctx) =>
      `const res = await fetch("${ctx.baseUrl}/api/v1/${ctx.collection}/RECORD_ID", {
  headers: { Authorization: "Bearer ${ctx.apiKey}" },
});
const { data } = await res.json();`,
  },
  {
    id: "create",
    group: "数据 CRUD",
    method: "POST",
    path: "/api/v1/{collection}",
    title: "新增记录",
    desc: "body 为 JSON 对象创建单条；也可传 JSON 数组批量创建（≤100 条）。成功返回 201。",
    needWrite: true,
    curl: (ctx) =>
      `curl -X POST ${authHeaderCurl(ctx)} ${JSON_CT} \\\n  -d '{"title":"写第一个 demo","done":false,"priority":2}' \\\n  "${ctx.baseUrl}/api/v1/${ctx.collection}"`,
    js: (ctx) =>
      `const res = await fetch("${ctx.baseUrl}/api/v1/${ctx.collection}", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${ctx.apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ title: "写第一个 demo", done: false, priority: 2 }),
});
const { data } = await res.json(); // data: { id, data, createdAt, updatedAt }`,
  },
  {
    id: "update",
    group: "数据 CRUD",
    method: "PATCH",
    path: "/api/v1/{collection}/{id}",
    title: "修改记录",
    desc: "浅合并：只更新传入的字段，其余保留。需 readwrite 权限的 Key。",
    needWrite: true,
    curl: (ctx) =>
      `curl -X PATCH ${authHeaderCurl(ctx)} ${JSON_CT} \\\n  -d '{"done":true}' \\\n  "${ctx.baseUrl}/api/v1/${ctx.collection}/RECORD_ID"`,
    js: (ctx) =>
      `const res = await fetch("${ctx.baseUrl}/api/v1/${ctx.collection}/RECORD_ID", {
  method: "PATCH",
  headers: {
    Authorization: "Bearer ${ctx.apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ done: true }),
});
const { data } = await res.json();`,
  },
  {
    id: "delete",
    group: "数据 CRUD",
    method: "DELETE",
    path: "/api/v1/{collection}/{id}",
    title: "删除记录",
    desc: "按 id 删除。需 readwrite 权限的 Key。",
    needWrite: true,
    curl: (ctx) =>
      `curl -X DELETE ${authHeaderCurl(ctx)} \\\n  "${ctx.baseUrl}/api/v1/${ctx.collection}/RECORD_ID"`,
    js: (ctx) =>
      `const res = await fetch("${ctx.baseUrl}/api/v1/${ctx.collection}/RECORD_ID", {
  method: "DELETE",
  headers: { Authorization: "Bearer ${ctx.apiKey}" },
});
const { data } = await res.json(); // { ok: true }`,
  },

  // ---------- 查询与聚合 ----------
  {
    id: "collections",
    group: "查询与聚合",
    method: "GET",
    path: "/api/v1/meta/collections",
    title: "列出所有集合",
    desc: "返回当前 App 下所有集合名及各自记录数。",
    curl: (ctx) =>
      `curl ${authHeaderCurl(ctx)} \\\n  "${ctx.baseUrl}/api/v1/meta/collections"`,
    js: (ctx) =>
      `const res = await fetch("${ctx.baseUrl}/api/v1/meta/collections", {
  headers: { Authorization: "Bearer ${ctx.apiKey}" },
});
const { data } = await res.json(); // [{ collection, count }]`,
  },
  {
    id: "aggregate",
    group: "查询与聚合",
    method: "GET",
    path: "/api/v1/meta/aggregate",
    title: "聚合统计",
    desc: "对集合做 count/sum/avg/min/max，可按字段分组。",
    params: [
      { name: "collection", required: true, desc: "集合名" },
      { name: "op", required: false, desc: "算子：count(默认)/sum/avg/min/max" },
      { name: "field", required: false, desc: "聚合字段（除 count 外必填）" },
      { name: "groupBy", required: false, desc: "分组字段，分组时返回 [{group,value}]" },
    ],
    curl: (ctx) =>
      `curl ${authHeaderCurl(ctx)} \\\n  "${ctx.baseUrl}/api/v1/meta/aggregate?collection=${ctx.collection}&op=count"`,
    js: (ctx) =>
      `const res = await fetch("${ctx.baseUrl}/api/v1/meta/aggregate?collection=${ctx.collection}&op=count", {
  headers: { Authorization: "Bearer ${ctx.apiKey}" },
});
const { data } = await res.json(); // { value: 数字 } 或 [{ group, value }]`,
  },
  {
    id: "export",
    group: "查询与聚合",
    method: "GET",
    path: "/api/v1/meta/export",
    title: "导出数据",
    desc: "导出某集合全部记录（≤10000 条），直接下载文件，不走 JSON 信封。",
    params: [
      { name: "collection", required: true, desc: "集合名" },
      { name: "format", required: false, desc: "csv 或 json（默认 json）" },
    ],
    curl: (ctx) =>
      `curl ${authHeaderCurl(ctx)} \\\n  "${ctx.baseUrl}/api/v1/meta/export?collection=${ctx.collection}&format=csv" \\\n  -o ${ctx.collection}.csv`,
    js: (ctx) =>
      `const res = await fetch("${ctx.baseUrl}/api/v1/meta/export?collection=${ctx.collection}&format=json", {
  headers: { Authorization: "Bearer ${ctx.apiKey}" },
});
const records = await res.json(); // 直接是记录数组（非信封）`,
  },
  {
    id: "import",
    group: "查询与聚合",
    method: "POST",
    path: "/api/v1/meta/import",
    title: "导入数据",
    desc: "批量导入到某集合，body 为 JSON 数组（≤1000 条）。每项可为记录对象或含 data 字段的导出格式。需 readwrite。",
    needWrite: true,
    params: [{ name: "collection", required: true, desc: "集合名" }],
    curl: (ctx) =>
      `curl -X POST ${authHeaderCurl(ctx)} ${JSON_CT} \\\n  -d '[{"title":"任务A"},{"title":"任务B"}]' \\\n  "${ctx.baseUrl}/api/v1/meta/import?collection=${ctx.collection}"`,
    js: (ctx) =>
      `const res = await fetch("${ctx.baseUrl}/api/v1/meta/import?collection=${ctx.collection}", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${ctx.apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify([{ title: "任务A" }, { title: "任务B" }]),
});
const { data } = await res.json(); // { imported: 条数 }`,
  },

  // ---------- 文件 ----------
  {
    id: "file-upload",
    group: "文件",
    method: "POST",
    path: "/api/v1/files",
    title: "上传文件",
    desc: "multipart/form-data，字段名 file。需 readwrite。返回文件 id 与可访问 url。大小/类型受超管全局限制。",
    needWrite: true,
    curl: (ctx) =>
      `curl -X POST ${authHeaderCurl(ctx)} \\\n  -F "file=@./photo.png" \\\n  "${ctx.baseUrl}/api/v1/files"`,
    js: (ctx) =>
      `const form = new FormData();
form.append("file", fileInput.files[0]); // 浏览器 File 对象
const res = await fetch("${ctx.baseUrl}/api/v1/files", {
  method: "POST",
  headers: { Authorization: "Bearer ${ctx.apiKey}" }, // 不要手动设 Content-Type
  body: form,
});
const { data } = await res.json(); // { id, filename, url, size, mimeType }`,
  },
  {
    id: "file-download",
    group: "文件",
    method: "GET",
    path: "/api/files/{id}",
    title: "下载/访问文件",
    desc: "用上传返回的 id 访问。图片类内联展示，其余强制下载。Bearer Key 或登录会话均可访问。",
    curl: (ctx) =>
      `curl ${authHeaderCurl(ctx)} \\\n  "${ctx.baseUrl}/api/files/FILE_ID" -o downloaded.bin`,
    js: (ctx) =>
      `const res = await fetch("${ctx.baseUrl}/api/files/FILE_ID", {
  headers: { Authorization: "Bearer ${ctx.apiKey}" },
});
const blob = await res.blob(); // 二进制内容`,
  },

  // ---------- 终端用户认证 ----------
  {
    id: "eu-register",
    group: "终端用户认证",
    method: "POST",
    path: "/api/v1/auth/register",
    title: "终端用户注册",
    desc: "用 App Key 标识应用，为你的 App 注册一个终端用户。返回该用户的 token（其数据按 owner 隔离）。",
    needWrite: true,
    curl: (ctx) =>
      `curl -X POST ${authHeaderCurl(ctx)} ${JSON_CT} \\\n  -d '{"email":"user@example.com","password":"password123"}' \\\n  "${ctx.baseUrl}/api/v1/auth/register"`,
    js: (ctx) =>
      `const res = await fetch("${ctx.baseUrl}/api/v1/auth/register", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${ctx.apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email: "user@example.com", password: "password123" }),
});
const { data } = await res.json(); // { id, email, token }`,
  },
  {
    id: "eu-login",
    group: "终端用户认证",
    method: "POST",
    path: "/api/v1/auth/login",
    title: "终端用户登录",
    desc: "终端用户用邮箱密码登录，换取 token。该 token 可代替 App Key 调用数据接口，但只能看到自己的记录。",
    curl: (ctx) =>
      `curl -X POST ${authHeaderCurl(ctx)} ${JSON_CT} \\\n  -d '{"email":"user@example.com","password":"password123"}' \\\n  "${ctx.baseUrl}/api/v1/auth/login"`,
    js: (ctx) =>
      `const res = await fetch("${ctx.baseUrl}/api/v1/auth/login", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${ctx.apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email: "user@example.com", password: "password123" }),
});
const { data } = await res.json(); // { id, email, token }`,
  },
];

export const GROUP_ORDER: EndpointGroup[] = [
  "数据 CRUD",
  "查询与聚合",
  "文件",
  "终端用户认证",
];
