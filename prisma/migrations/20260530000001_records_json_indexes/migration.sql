-- records 表 JSON 查询性能优化
--
-- 背景：records.data 是 schemaless JSON 列，/api/v1 的 filter/sort 走
-- JSON_EXTRACT 表达式，无法命中普通索引，数据量大后退化为全表扫描 + filesort。
--
-- 方案：为高频 JSON 路径建「函数索引」（MySQL 8.0.13+ 支持对表达式直接建索引）。
-- 这些索引覆盖 record-query.ts 生成的 JSON_UNQUOTE(JSON_EXTRACT(data, '$.x')) 表达式，
-- 使等值/范围/排序可走索引。collection 维度一并纳入，贴合「按集合过滤」的访问模式。
--
-- 如需为新的热点字段加速，按下方模式追加 (app_id, collection, <expr>) 形态的函数索引即可。

-- 文本型字段（如 todos.status / 通用 status 字段）
CREATE INDEX `idx_records_json_status`
  ON `records` (
    `app_id`,
    `collection`,
    (CAST(JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.status')) AS CHAR(191)))
  );

-- 数值型字段（如 todos.priority）—— 与 record-query 的 DECIMAL(30,10) 比较保持一致
CREATE INDEX `idx_records_json_priority`
  ON `records` (
    `app_id`,
    `collection`,
    (CAST(JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.priority')) AS DECIMAL(30,10)))
  );
