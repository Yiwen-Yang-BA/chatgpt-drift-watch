import { assert } from "./validate.mjs";

/** Strict numeric literals only. Empty cells, commas and non-finite values are not numbers. */
export function numeric(value) {
  if (typeof value !== "string") return null;
  const literal = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(literal))
    return null;
  const result = Number(literal);
  return Number.isFinite(result) ? result : null;
}

/** Parses a bounded CSV without coercing cells or treating zero/false as missing. */
export function parseCSV(value) {
  assert(
    typeof value === "string" && value.length <= 250000,
    "CSV 必须是 250000 个字符以内的文本。",
  );
  const source = value.replace(/^\uFEFF/, "");
  const records = [];
  let row = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  let syntax = false;
  function finishField() {
    row.push(field);
    assert(row.length <= 30, "CSV 最多包含 30 列。");
    field = "";
    afterQuote = false;
  }
  function finishRow() {
    // Physical blank lines are ignored; quoted empty cells and delimiter-only
    // rows are real records and remain available for missing-value analysis.
    if (!syntax && row.length === 0 && !field.trim()) {
      field = "";
      return;
    }
    finishField();
    records.push(row);
    assert(records.length <= 2001, "CSV 最多包含 2000 行数据（不含表头）。");
    row = [];
    syntax = false;
  }
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else field += character;
      continue;
    }
    if (afterQuote) {
      if (character === " " || character === "\t") continue;
      assert(
        character === "," || character === "\r" || character === "\n",
        "CSV 引号关闭后只能出现分隔符或换行。",
      );
    }
    if (character === '"') {
      assert(field.length === 0, "CSV 引号必须出现在字段开头。");
      quoted = true;
      syntax = true;
    } else if (character === ",") {
      syntax = true;
      finishField();
    } else if (character === "\r" || character === "\n") {
      finishRow();
      if (character === "\r" && source[index + 1] === "\n") index++;
    } else field += character;
  }
  assert(!quoted, "CSV 存在未闭合的引号。");
  finishRow();
  assert(records.length > 0, "CSV 不能为空，且必须包含表头。");
  const columns = records[0].map((name) => name.trim());
  assert(columns.every(Boolean), "CSV 列名不能为空。");
  assert(new Set(columns).size === columns.length, "CSV 列名不能重复。");
  const rows = records.slice(1);
  rows.forEach((record, index) =>
    assert(
      record.length === columns.length,
      `CSV 第 ${index + 2} 行有 ${record.length} 列，与表头的 ${columns.length} 列不一致。`,
    ),
  );
  return { columns, rows };
}
