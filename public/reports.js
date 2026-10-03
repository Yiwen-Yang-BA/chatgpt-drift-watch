const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
/** Text-only portable report. Never accepts raw HTML from a model or dataset. */
export function reportHTML({
  title,
  subtitle = "",
  metrics = [],
  sections = [],
  notes = [],
}) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; object-src 'none'"><title>${esc(title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f2f6f4;color:#213c36;font:14px/1.7 system-ui,'Microsoft YaHei',sans-serif}main{max-width:1100px;margin:40px auto;padding:36px;background:white;border:1px solid #dce5df;border-radius:16px}h1{font:36px/1.3 Georgia,serif;margin:0 0 15px}h2{font-size:19px;margin:32px 0 14px}.meta{font-size:12px;color:#718278}.metrics{display:flex;flex-wrap:wrap;gap:14px;margin:30px 0}.metric{flex:1;min-width:150px;background:#edf4ef;border-radius:10px;padding:18px}.metric span{display:block;font-size:11px;color:#5e7667}.metric strong{font:29px/1.6 Georgia,serif}.table{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e2e8e2;overflow-wrap:anywhere}th{color:#5a7365;background:#f6f8f4}p,li{white-space:pre-wrap;overflow-wrap:anywhere}.note{border-left:3px solid #4c8065;padding:16px;background:#f0f5ed}@media(max-width:600px){main{margin:12px;padding:20px}.metric{min-width:40%}}@media print{body{background:white}main{border:0;margin:0;padding:0}.table{overflow:visible}tr{break-inside:avoid}h2{break-after:avoid}}</style></head><body><main><div class="meta">DATA & FINANCE · LOCAL ANALYTICS</div><h1>${esc(title)}</h1><p class="meta">${esc(subtitle)}</p><div class="metrics">${metrics.map((m) => `<div class="metric"><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong></div>`).join("")}</div>${sections.map((s) => `<section><h2>${esc(s.title)}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ""}${s.headers ? `<div class="table"><table><thead><tr>${s.headers.map((v) => `<th>${esc(v)}</th>`).join("")}</tr></thead><tbody>${(s.rows || []).map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : ""}</section>`).join("")}${notes.length ? `<h2>计算说明</h2><ul class="note">${notes.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}<p class="meta">生成时间 ${esc(new Date().toISOString())} · 统计基于提供的数据；内容与假设需自行核对。</p></main></body></html>`;
}
