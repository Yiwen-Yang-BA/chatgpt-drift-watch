import {
  $,
  escape,
  toast,
  download,
  init,
  run,
  busy,
  resultMeta,
  fileText,
} from "./ui.js";
import { num, pct } from "./charts.js";
import { reportHTML } from "./reports.js";
const statuses = {
  small: "差异较小",
  check: "值得检查",
  large: "差异较大",
  unscored: "未评分",
};
const types = { number: "数值", category: "类别", empty: "基准全空" };
let result = null;
let pending = false;
function lock(on) {
  pending = on;
  document
    .querySelectorAll(
      "#reference,#current,#reference-file,#current-file,#sample,#bins,#compare,#mode",
    )
    .forEach((el) => (el.disabled = on));
}
function sample() {
  const ref = ["region,income,segment,legacy"];
  const cur = ["region,income,segment,channel"];
  for (let i = 0; i < 20; i++) {
    ref.push(
      `${["华东", "华北", "华南"][i % 3]},${55 + i},${i < 15 ? "基础" : "专业"},old`,
    );
    cur.push(
      `${i < 12 ? "华西" : i < 17 ? "华东" : "华南"},${i === 19 ? "" : 70 + i},${i < 12 ? "企业" : "专业"},web`,
    );
  }
  $("#reference").value = ref.join("\n");
  $("#current").value = cur.join("\n");
}
function distribution(bins) {
  const ordered =
    bins.length > 15
      ? [...bins]
          .sort(
            (a, b) =>
              Math.abs(b.currentRate - b.referenceRate) -
              Math.abs(a.currentRate - a.referenceRate),
          )
          .slice(0, 15)
      : bins;
  const w = 900,
    h = ordered.length * 50 + 56,
    left = 210,
    right = 115;
  const max = Math.max(
    ...ordered.flatMap((b) => [b.referenceRate, b.currentRate]),
    0.01,
  );
  const width = w - left - right;
  return `<svg class="data-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="基准与当前分布占比"><title>基准与当前分布占比</title>${ordered
    .map((b, i) => {
      const y = 18 + i * 50;
      return `<text x="${left - 12}" y="${y + 21}" text-anchor="end" font-size="12" fill="#657e75">${escape(b.label.slice(0, 30))}</text><rect x="${left}" y="${y}" width="${(b.referenceRate / max) * width}" height="13" rx="3" fill="#a1b9b1"/><rect x="${left}" y="${y + 18}" width="${(b.currentRate / max) * width}" height="13" rx="3" fill="#377e75"/><text x="${w - right + 12}" y="${y + 11}" font-size="11" fill="#7b9189">${pct(b.referenceRate)}</text><text x="${w - right + 12}" y="${y + 30}" font-size="11" fill="#377e75">${pct(b.currentRate)}</text>`;
    })
    .join(
      "",
    )}</svg><div class="chart-legend"><span><i style="background:#a1b9b1"></i>基准</span><span><i style="background:#377e75"></i>当前</span></div>${bins.length > 15 ? '<p class="hint">图中展示占比变化最大的 15 桶，完整结果见下表。</p>' : ""}`;
}
function show(index) {
  const c = result.columns[index];
  $("#field-title").textContent = c.name;
  $("#field-status").textContent = types[c.type] + " · " + statuses[c.status];
  $("#field-info").innerHTML =
    `<div class="grid3"><div class="card"><span class="muted">PSI</span><h3 style="margin:8px 0">${num(c.psi, 4)}</h3></div><div class="card"><span class="muted">原始 TV 距离</span><h3 style="margin:8px 0">${num(c.tvd, 4)}</h3></div><div class="card"><span class="muted">缺失率变化 · 百分点</span><h3 style="margin:8px 0">${num(c.missingRateDelta, 2)}</h3></div></div><p class="warning-list">${c.issues.map(escape).join("\n")}</p>`;
  $("#field-info").insertAdjacentHTML("beforeend", statsMarkup(c));
  $("#distribution").innerHTML = c.bins.length
    ? distribution(c.bins)
    : '<p class="muted">该字段未评分，请查看上面的原因。</p>';
  $("#bins-table").innerHTML = c.bins.length
    ? `<table class="data-table"><thead><tr><th>分箱 / 类别</th><th>基准数量</th><th>当前数量</th><th>基准占比</th><th>当前占比</th></tr></thead><tbody>${c.bins.map((b) => `<tr><td>${escape(b.label)}</td><td>${b.referenceCount}</td><td>${b.currentCount}</td><td>${pct(b.referenceRate)}</td><td>${pct(b.currentRate)}</td></tr>`).join("")}</tbody></table>`
    : "";
  document
    .querySelectorAll("[data-field]")
    .forEach((el, i) => el.classList.toggle("primary", i === index));
}
function statsMarkup(c) {
  if (!c.referenceStats && !c.currentStats) return "";
  return (
    '<div class="table-wrap"><table><thead><tr><th>数值摘要</th><th>基准</th><th>当前</th></tr></thead><tbody>' +
    [
      ["min", "最小值"],
      ["median", "中位数"],
      ["mean", "均值"],
      ["max", "最大值"],
    ]
      .map(
        ([key, label]) =>
          "<tr><td>" +
          label +
          "</td><td>" +
          num(c.referenceStats?.[key]) +
          "</td><td>" +
          num(c.currentStats?.[key]) +
          "</td></tr>",
      )
      .join("") +
    "</tbody></table></div>"
  );
}
function render(r) {
  result = { ...r.data, meta: r.meta };
  const s = result.summary;
  $("#metrics").innerHTML = [
    [
      "基准 / 当前行数",
      `${num(s.referenceRows, 0)} / ${num(s.currentRows, 0)}`,
    ],
    ["共同字段", num(s.commonColumns, 0)],
    ["已评分字段", num(s.scoredColumns, 0)],
    ["差异较大字段", num(s.largeDriftColumns, 0)],
  ]
    .map(
      ([label, value]) =>
        `<div class="metric-card"><span>${label}</span><strong>${value}</strong></div>`,
    )
    .join("");
  $("#schema-changes").textContent =
    `新增字段：${result.schema.added.join("、") || "无"}；移除字段：${result.schema.removed.join("、") || "无"}。`;
  $("#overview").innerHTML =
    `<table class="data-table"><thead><tr><th>字段</th><th>类型</th><th>PSI</th><th>TV 距离</th><th>缺失率 · 基准 / 当前</th><th>启发分级</th></tr></thead><tbody>${result.columns.map((c, i) => `<tr><td><button class="small" data-field="${i}">${escape(c.name)}</button></td><td>${types[c.type]}</td><td>${num(c.psi, 4)}</td><td>${num(c.tvd, 4)}</td><td>${pct(c.referenceMissingRate)} / ${pct(c.currentMissingRate)}</td><td><span class="chip">${statuses[c.status]}</span></td></tr>`).join("")}</tbody></table>`;
  $("#warnings").textContent = result.warnings.join("\n");
  $("#insight").textContent = result.insight;
  $("#meta").innerHTML = resultMeta(r.meta);
  $("#exports").hidden = false;
  show(0);
}
$("#sample").onclick = sample;
for (const prefix of ["reference", "current"])
  $("#" + prefix + "-file").onchange = async (e) => {
    if (pending) return;
    lock(true);
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (!/\.csv$/i.test(file.name)) throw Error("请选择 CSV 文件");
      const text = await fileText(file, 400000);
      if (text.length > 125000) throw Error("单份 CSV 最多 125,000 字符");
      $("#" + prefix).value = text;
    } catch (err) {
      toast(err.message, true);
    } finally {
      e.target.value = "";
      lock(false);
    }
  };
$("#compare").onclick = async () => {
  if (pending) return;
  lock(true);
  busy($("#compare"), true, "比较分布中…");
  try {
    render(
      await run({
        referenceCsv: $("#reference").value,
        currentCsv: $("#current").value,
        bins: Number($("#bins").value),
      }),
    );
  } catch (err) {
    toast(err.message, true);
  } finally {
    busy($("#compare"), false);
    lock(false);
  }
};
$("#overview").onclick = (e) => {
  const b = e.target.closest("[data-field]");
  if (b && result) show(Number(b.dataset.field));
};
$("#export-json").onclick = () => {
  if (result)
    download(
      "drift-comparison.json",
      JSON.stringify(result, null, 2),
      "application/json",
    );
};
$("#export-html").onclick = () => {
  if (!result) return;
  const s = result.summary;
  download(
    "drift-report.html",
    reportHTML({
      title: "数据分布比较报告",
      subtitle: "Drift Watch · 固定基准分箱，不提供显著性检验",
      metrics: [
        { label: "基准行", value: s.referenceRows },
        { label: "当前行", value: s.currentRows },
        { label: "已评分列", value: s.scoredColumns },
        { label: "差异较大", value: s.largeDriftColumns },
      ],
      sections: [
        {
          title: "字段变化",
          text:
            "新增：" +
            (result.schema.added.join("、") || "无") +
            "；移除：" +
            (result.schema.removed.join("、") || "无"),
        },
        {
          title: "字段对比",
          headers: [
            "字段",
            "类型",
            "PSI",
            "TV距离",
            "基准缺失率",
            "当前缺失率",
            "变化百分点",
            "启发分级",
          ],
          rows: result.columns.map((c) => [
            c.name,
            types[c.type],
            num(c.psi, 6),
            num(c.tvd, 6),
            pct(c.referenceMissingRate),
            pct(c.currentMissingRate),
            num(c.missingRateDelta),
            statuses[c.status],
          ]),
        },
        ...result.columns.map((c) => ({
          title: c.name + " · 分布",
          text: c.issues.join("\n"),
          headers: ["桶", "基准数量", "当前数量", "基准占比", "当前占比"],
          rows: c.bins.map((b) => [
            b.label,
            b.referenceCount,
            b.currentCount,
            pct(b.referenceRate),
            pct(b.currentRate),
          ]),
        })),
        { title: "解读", text: result.insight },
      ],
      notes: [
        `分箱参数 ${result.settings.bins}；PSI 概率平滑 ε=${result.settings.epsilon}；分级阈值0.10/0.25。`,
        ...result.warnings,
        "缺失率变化单位为百分点；分布差异不能直接说明原因、模型失效或未来变化。",
      ],
    }),
    "text/html;charset=utf-8",
  );
};
await init();
