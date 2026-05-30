type Level = "error" | "warn" | "info";

const isDev = process.env.NODE_ENV !== "production";

function emit(level: Level, msg: string, meta?: unknown) {
  const line = `[${level}] ${msg}`;
  // 生产环境只输出结构化单行，开发环境附带详情
  if (level === "error") {
    console.error(line, isDev && meta !== undefined ? meta : "");
  } else if (level === "warn") {
    console.warn(line, isDev && meta !== undefined ? meta : "");
  } else if (isDev) {
    console.info(line, meta !== undefined ? meta : "");
  }
}

export const logger = {
  error: (msg: string, meta?: unknown) => emit("error", msg, meta),
  warn: (msg: string, meta?: unknown) => emit("warn", msg, meta),
  info: (msg: string, meta?: unknown) => emit("info", msg, meta),
};
