import { prisma } from "@/lib/prisma";

/**
 * Schemaless 记录查询。
 * 解析 URL 查询参数为安全的参数化 SQL（MySQL JSON_EXTRACT）。
 *
 * 支持：
 *   filter=status:done            -> data->>'$.status' = 'done'
 *   filter=age_gt:18              -> data->>'$.age' > 18
 *   算子：eq(默认) ne gt gte lt lte like
 *   sort=-created_at / sort=field / sort=-field
 *   page, limit
 *
 * 安全：字段名经白名单字符校验，字段路径与值一律用占位符 (?)，绝不字符串拼接。
 */

const OP_MAP: Record<string, string> = {
  eq: "=",
  ne: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
};

// 仅允许字母数字下划线点的字段路径，防注入
const FIELD_RE = /^[a-zA-Z0-9_.]+$/;
const MAX_FIELD_LEN = 128;
const BUILTIN_COLUMNS = new Set(["created_at", "updated_at", "id"]);

interface FilterClause {
  sql: string;
  params: (string | number)[];
}

function splitOp(left: string): { field: string; op: string } {
  // 算子写法 field_gt:val —— 仅当下划线后缀确实是已知算子时才剥离，
  // 且要求字段本身非空，避免 "count_gt" 这类字段名被误判
  const lastUnderscore = left.lastIndexOf("_");
  if (lastUnderscore > 0) {
    const maybeOp = left.slice(lastUnderscore + 1);
    if (OP_MAP[maybeOp]) {
      return { field: left.slice(0, lastUnderscore), op: maybeOp };
    }
  }
  return { field: left, op: "eq" };
}

function parseFilters(raw: string | null): FilterClause[] {
  if (!raw) return [];
  const clauses: FilterClause[] = [];
  for (const part of raw.split(",")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const left = part.slice(0, idx).trim();
    const value: string = part.slice(idx + 1).trim();
    if (!left) continue;

    const { field, op } = splitOp(left);
    if (!field || field.length > MAX_FIELD_LEN || !FIELD_RE.test(field)) continue;

    const path = `$.${field}`;
    const sqlOp = OP_MAP[op];

    // 数字值走数值比较，否则字符串比较
    const num = Number(value);
    const isNumeric = value !== "" && !Number.isNaN(num);

    if (op === "like") {
      clauses.push({
        sql: `JSON_UNQUOTE(JSON_EXTRACT(data, ?)) LIKE ?`,
        params: [path, `%${value}%`],
      });
    } else if (isNumeric) {
      clauses.push({
        sql: `CAST(JSON_UNQUOTE(JSON_EXTRACT(data, ?)) AS DECIMAL(30,10)) ${sqlOp} ?`,
        params: [path, num],
      });
    } else {
      clauses.push({
        sql: `JSON_UNQUOTE(JSON_EXTRACT(data, ?)) ${sqlOp} ?`,
        params: [path, value],
      });
    }
  }
  return clauses;
}

function parseSort(raw: string | null): { field: string; dir: "ASC" | "DESC" } {
  if (!raw) return { field: "created_at", dir: "DESC" };
  let dir: "ASC" | "DESC" = "ASC";
  let field = raw.trim();
  if (field.startsWith("-")) {
    dir = "DESC";
    field = field.slice(1);
  }
  if (BUILTIN_COLUMNS.has(field)) {
    return { field, dir };
  }
  if (field.length > MAX_FIELD_LEN || !FIELD_RE.test(field)) {
    return { field: "created_at", dir: "DESC" };
  }
  return { field, dir };
}

export interface QueryParams {
  filter: string | null;
  sort: string | null;
  page: number;
  limit: number;
}

export function parseQueryParams(searchParams: URLSearchParams): QueryParams {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20),
  );
  return {
    filter: searchParams.get("filter"),
    sort: searchParams.get("sort"),
    page,
    limit,
  };
}

export interface QueryResult {
  rows: RecordRow[];
  total: number;
}

export interface RecordRow {
  id: string;
  collection: string;
  data: unknown;
  created_at: Date;
  updated_at: Date;
}

export async function queryRecords(
  appId: string,
  collection: string,
  params: QueryParams,
  ownerId?: string | null,
): Promise<QueryResult> {
  const filters = parseFilters(params.filter);
  const sort = parseSort(params.sort);

  const whereParts = ["app_id = ?", "collection = ?"];
  const whereParams: (string | number)[] = [appId, collection];
  // 终端用户身份：仅限本人记录；App Key（ownerId 为空）不限制，可见全部
  if (ownerId) {
    whereParts.push("owner_id = ?");
    whereParams.push(ownerId);
  }
  for (const c of filters) {
    whereParts.push(c.sql);
    whereParams.push(...c.params);
  }
  const whereSql = whereParts.join(" AND ");

  // 排序：内置列直接用列名（已白名单），JSON 字段路径用占位符
  let orderSql: string;
  const orderExtraParams: string[] = [];
  if (BUILTIN_COLUMNS.has(sort.field)) {
    orderSql = `${sort.field} ${sort.dir}`;
  } else {
    orderSql = `JSON_UNQUOTE(JSON_EXTRACT(data, ?)) ${sort.dir}`;
    orderExtraParams.push(`$.${sort.field}`);
  }

  const offset = (params.page - 1) * params.limit;

  const dataSql = `SELECT id, collection, data, created_at, updated_at FROM records WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS cnt FROM records WHERE ${whereSql}`;

  // 并行执行数据查询与计数，减少串行往返
  const [rows, countRes] = await Promise.all([
    prisma.$queryRawUnsafe<RecordRow[]>(
      dataSql,
      ...whereParams,
      ...orderExtraParams,
      params.limit,
      offset,
    ),
    prisma.$queryRawUnsafe<{ cnt: bigint }[]>(countSql, ...whereParams),
  ]);
  const total = Number(countRes[0]?.cnt ?? 0);

  // MySQL JSON 列返回字符串，需解析
  const parsed = rows.map((r) => ({
    ...r,
    data: typeof r.data === "string" ? safeParse(r.data) : r.data,
  }));

  return { rows: parsed, total };
}

export function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
