import test from "node:test";
import assert from "node:assert/strict";
import { run } from "../project.mjs";
import { ValidationError } from "../lib/validate.mjs";

const demo = { generate: async (spec) => spec.demo() };
const compare = (referenceCsv, currentCsv, bins = 5) =>
  run({ referenceCsv, currentCsv, bins }, demo);
const near = (actual, expected, tolerance = 1e-12) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} ≈ ${expected}`,
  );

test("method example 1 uses baseline median boundaries and smoothed PSI with raw TVD", async () => {
  const result = await compare("value\n0\n1\n2\n3", "value\n0\n1\n1\n3", 2);
  const column = result.columns[0];
  assert.deepEqual(
    column.bins.map((bin) => [bin.referenceCount, bin.currentCount]),
    [
      [2, 3],
      [2, 1],
      [0, 0],
    ],
  );
  assert.equal(column.bins[0].label, "(-∞, 1.5]");
  near(column.psi, 0.27465158154739405);
  near(column.tvd, 0.25);
  assert.equal(column.status, "large");
});

test("method example 2 includes new, disappeared and missing categories", async () => {
  const result = await compare('value\nA\nA\nB\n""', 'value\nA\nC\nC\n""');
  const column = result.columns[0];
  assert.deepEqual(
    column.bins.map((bin) => bin.label),
    ['"A"', '"B"', '"C"', "∅缺失"],
  );
  near(column.psi, 9.841734666113084);
  near(column.tvd, 0.5);
  assert.equal(column.missingRateDelta, 0);
  near(
    column.bins.reduce((sum, bin) => sum + bin.referenceRate, 0),
    1,
  );
  near(
    column.bins.reduce((sum, bin) => sum + bin.currentRate, 0),
    1,
  );
});

test("constant reference uses three numeric buckets and detects movement away from the constant", async () => {
  const column = (await compare("value\n5\n5", "value\n4\n6")).columns[0];
  assert.deepEqual(
    column.bins.map((bin) => [bin.referenceCount, bin.currentCount]),
    [
      [0, 1],
      [2, 0],
      [0, 1],
      [0, 0],
    ],
  );
  assert.ok(column.psi > 0);
  assert.equal(column.tvd, 1);
  assert.deepEqual(column.referenceStats, {
    min: 5,
    max: 5,
    mean: 5,
    median: 5,
  });
  assert.deepEqual(column.currentStats, { min: 4, max: 6, mean: 5, median: 5 });
});

test("identical proportions remain zero even with different sample sizes", async () => {
  const result = await compare("value\nA\nB", "value\nA\nA\nB\nB");
  assert.equal(result.columns[0].psi, 0);
  assert.equal(result.columns[0].tvd, 0);
  assert.equal(result.columns[0].status, "small");
  const numeric = await compare("value\n1\n2\n3", "value\n1\n2\n3");
  assert.equal(numeric.columns[0].psi, 0);
});

test("missing markers never collide with real strings and delta is in percentage points", async () => {
  const column = (
    await compare(
      'value\n∅缺失\n__MISSING__\n""\nA',
      'value\n∅缺失\n__MISSING__\n""\n""',
    )
  ).columns[0];
  assert.ok(column.bins.some((bin) => bin.label === '"∅缺失"'));
  assert.ok(column.bins.some((bin) => bin.label === "∅缺失"));
  assert.equal(column.referenceMissingRate, 0.25);
  assert.equal(column.currentMissingRate, 0.5);
  assert.equal(column.missingRateDelta, 25);
  const unicode = (await compare("v\n😀\n\uE000", "v\n😀\n\uE000")).columns[0];
  assert.deepEqual(
    unicode.bins.slice(0, 2).map((bin) => bin.label),
    [JSON.stringify("\uE000"), JSON.stringify("😀")],
  );
});

test("invalid current numbers leave only that column unscored and keep invalid values separate from missing", async () => {
  const result = await compare(
    "n,category\n1,A\n2,B",
    "n,category\ninvalid,A\n,B",
  );
  assert.equal(result.columns[0].type, "number");
  assert.equal(result.columns[0].status, "unscored");
  assert.equal(result.columns[0].psi, null);
  assert.equal(result.columns[0].currentMissingRate, 0.5);
  assert.equal(result.columns[1].status, "small");
  assert.equal(result.summary.scoredColumns, 1);
});

test("empty baselines and high-cardinality categories have reasons rather than stable scores", async () => {
  const empty = (await compare('v\n""\n""', "v\n1\n2")).columns[0];
  assert.equal(empty.type, "empty");
  assert.equal(empty.status, "unscored");
  assert.equal(empty.psi, null);
  assert.match(empty.issues.join(" "), /无基准有效值/);
  const categories =
    "v\n" + Array.from({ length: 51 }, (_, i) => `label${i}`).join("\n");
  const high = (await compare(categories, categories)).columns[0];
  assert.equal(high.status, "unscored");
  assert.deepEqual(high.bins, []);
  assert.match(high.issues.join(" "), /51 个/);
});

test("schema additions/removals, sparse bins and sample warnings are reported", async () => {
  const result = await compare(
    "same,removed\n1,a\n2,b",
    "same,added\n1,c\n2,d",
  );
  assert.deepEqual(result.schema, { added: ["added"], removed: ["removed"] });
  assert.equal(result.summary.commonColumns, 1);
  assert.ok(result.warnings.some((warning) => warning.includes("少于 100")));
  assert.ok(
    result.columns[0].issues.some((issue) => issue.includes("少于 50")),
  );
  assert.ok(result.columns[0].issues.some((issue) => issue.includes("稀疏桶")));
  assert.deepEqual(result.settings, {
    bins: 5,
    epsilon: 1e-6,
    thresholds: { check: 0.1, large: 0.25 },
    method: "reference_quantiles",
  });
});

test("input limits, empty tables and lack of shared columns are rejected", async () => {
  for (const payload of [
    { referenceCsv: "a", currentCsv: "a\n1" },
    { referenceCsv: "a\n1", currentCsv: "b\n1" },
    { referenceCsv: "a\n1", currentCsv: "a\n2", bins: 1 },
    { referenceCsv: "a\n1", currentCsv: "a\n2", bins: 11 },
    {
      referenceCsv: "a\n" + "x".repeat(130000),
      currentCsv: "a\n" + "y".repeat(130000),
    },
    {
      referenceCsv: "a\n" + Array(2001).fill("x").join("\n"),
      currentCsv: "a\nx",
    },
  ])
    await assert.rejects(run(payload, demo), ValidationError);
});

test("model input excludes raw rows, category labels and every bucket distribution", async () => {
  let observed;
  const result = await run(
    {
      referenceCsv: "segment\nPRIVATE_CATEGORY_A\nPRIVATE_CATEGORY_B",
      currentCsv: "segment\nPRIVATE_CATEGORY_C\nPRIVATE_CATEGORY_A",
    },
    {
      generate: async (spec) => {
        observed = spec;
        return { text: "只依据分布指标进行解读。" };
      },
    },
  );
  assert.ok(!observed.input.includes("PRIVATE_CATEGORY"));
  const input = JSON.parse(observed.input);
  assert.deepEqual(Object.keys(input), ["summary", "columns"]);
  assert.equal(input.columns[0].bins, undefined);
  assert.equal(input.rows, undefined);
  assert.match(observed.instructions, /not a p-value/);
  assert.ok(
    result.columns[0].bins.some((bin) =>
      bin.label.includes("PRIVATE_CATEGORY"),
    ),
  );
});
