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
 * 安全：字段名经白名单字符校验，值一律用占位符 (?)，绝不字符串拼接值。
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

interface FilterClause {
  sql: string;
  param: string | number;
}

function parseFilters(raw: string | null): FilterClause[] {
  if (!raw) return [];
  const clauses: FilterClause[] = [];
  for (const part of raw.split(",")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const left = part.slice(0, idx).trim();
    let value: string = part.slice(idx + 1).trim();
    if (!left) continue;

    let op = "eq";
    let field = left;
    const lastUnderscore = left.lastIndexOf("_");
    if (lastUnderscore !== -1) {
      const maybeOp = left.slice(lastUnderscore + 1);
      if (OP_MAP[maybeOp]) {
        op = maybeOp;
        field = left.slice(0, lastUnderscore);
      }
    }

    if (!FIELD_RE.test(field)) continue;

    const path = `$.${field}`;
    const sqlOp = OP_MAP[op];

    // 数字值走数值比较，否则字符串比较
    const num = Number(value);
    const isNumeric = value !== "" && !Number.isNaN(num);

    if (op === "like") {
      clauses.push({
        sql: `JSON_UNQUOTE(JSON_EXTRACT(data, '${path}')) LIKE ?`,
        param: `%${value}%`,
      });
    } else if (isNumeric) {
      clauses.push({
        sql: `CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '${path}')) AS DECIMAL(30,10)) ${sqlOp} ?`,
        param: num,
      });
    } else {
      clauses.push({
        sql: `JSON_UNQUOTE(JSON_EXTRACT(data, '${path}')) ${sqlOp} ?`,
        param: value,
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
  if (field === "created_at" || field === "updated_at" || field === "id") {
    return { field, dir };
  }
  if (!FIELD_RE.test(field)) return { field: "created_at", dir: "DESC" };
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
): Promise<QueryResult> {
  const filters = parseFilters(params.filter);
  const sort = parseSort(params.sort);

  const whereParts = ["app_id = ?", "collection = ?"];
  const whereParams: (string | number)[] = [appId, collection];
  for (const c of filters) {
    whereParts.push(c.sql);
    whereParams.push(c.param);
  }
  const whereSql = whereParts.join(" AND ");

  // 排序：内置列直接用列名，JSON 字段用 JSON_EXTRACT
  let orderSql: string;
  if (["created_at", "updated_at", "id"].includes(sort.field)) {
    orderSql = `${sort.field} ${sort.dir}`;
  } else {
    orderSql = `JSON_UNQUOTE(JSON_EXTRACT(data, '$.${sort.field}')) ${sort.dir}`;
  }

  const offset = (params.page - 1) * params.limit;

  const dataSql = `SELECT id, collection, data, created_at, updated_at FROM records WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS cnt FROM records WHERE ${whereSql}`;

  const rows = await prisma.$queryRawUnsafe<RecordRow[]>(
    dataSql,
    ...whereParams,
    params.limit,
    offset,
  );
  const countRes = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    countSql,
    ...whereParams,
  );
  const total = Number(countRes[0]?.cnt ?? 0);

  // MySQL JSON 列返回字符串，需解析
  const parsed = rows.map((r) => ({
    ...r,
    data: typeof r.data === "string" ? safeParse(r.data) : r.data,
  }));

  return { rows: parsed, total };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
