const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const num = (value, digits = 2) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : Number(value).toLocaleString("zh-CN", { maximumFractionDigits: digits });
export const pct = (value) =>
  value === null || value === undefined ? "—" : num(value * 100, 2) + "%";
export function bars(items, { label = "分组统计", valueFormat = num } = {}) {
  const rows = items.slice(0, 20),
    w = 700,
    row = 36,
    h = Math.max(110, rows.length * row + 55),
    left = 145,
    right = 105;
  const vals = rows.map((x) => Number(x.value));
  if (vals.some((v) => !Number.isFinite(v)))
    return '<p class="muted">没有可绘制的有限数值。</p>';
  const min = Math.min(0, ...vals),
    max = Math.max(0, ...vals);
  const range = max - min || 1;
  const x = (v) => left + ((v - min) / range) * (w - left - right);
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" class="data-chart"><title>${esc(label)}</title><line x1="${x(0)}" x2="${x(0)}" y1="12" y2="${h - 20}" stroke="#ccd7d2"/>${rows
    .map((d, i) => {
      const y = 20 + i * row;
      return `<text x="${left - 14}" y="${y + 15}" text-anchor="end" fill="#6b7d79" font-size="12">${esc(String(d.label ?? "(空值)").slice(0, 20))}</text><rect x="${Math.min(x(0), x(d.value))}" y="${y}" width="${Math.max(1, Math.abs(x(d.value) - x(0)))}" height="24" rx="4" fill="${d.value < 0 ? "#b47561" : "#4d837b"}"/><text x="${w - right + 14}" y="${y + 15}" fill="#263d39" font-size="12">${esc(valueFormat(d.value))}</text>`;
    })
    .join("")}</svg>`;
}
export function lines(series, { label = "趋势图", format = num } = {}) {
  const w = 760,
    h = 300,
    left = 70,
    right = 20,
    top = 25,
    bottom = 45;
  const all = series.flatMap((s) => s.values.filter((v) => Number.isFinite(v)));
  if (!all.length) return '<p class="muted">没有可绘制的数据。</p>';
  let low = Math.min(...all),
    high = Math.max(...all);
  if (low === high) {
    low -= Math.max(1, Math.abs(low) * 0.05);
    high += Math.max(1, Math.abs(high) * 0.05);
  }
  const pad = (high - low) * 0.08;
  low -= pad;
  high += pad;
  const maxN = Math.max(...series.map((s) => s.values.length));
  const x = (i) => left + (i / Math.max(1, maxN - 1)) * (w - left - right);
  const y = (v) => h - bottom - ((v - low) / (high - low)) * (h - top - bottom);
  const colors = ["#387f78", "#b57950", "#657baf", "#9b748b"];
  const labels = series[0].labels || [];
  return `<svg class="data-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${Array.from(
    { length: 5 },
    (_, i) => {
      const v = low + ((high - low) * i) / 4;
      return `<line x1="${left}" x2="${w - right}" y1="${y(v)}" y2="${y(v)}" stroke="#e4eae6"/><text x="${left - 9}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#6b7d79">${esc(format(v))}</text>`;
    },
  ).join("")}${series
    .map((s, j) => {
      let open = false;
      const path = s.values
        .map((v, i) => {
          if (!Number.isFinite(v)) {
            open = false;
            return "";
          }
          const segment = `${open ? "L" : "M"}${x(i)},${y(v)}`;
          open = true;
          return segment;
        })
        .join(" ");
      return `<path d="${path}" fill="none" stroke="${colors[j % colors.length]}" stroke-width="2.6"/>${s.values.length === 1 && Number.isFinite(s.values[0]) ? `<circle cx="${x(0)}" cy="${y(s.values[0])}" r="4" fill="${colors[j % colors.length]}"/>` : ""}`;
    })
    .join("")}${labels
    .filter(
      (_, i) =>
        i === 0 ||
        i === labels.length - 1 ||
        i % Math.max(1, Math.ceil(labels.length / 5)) === 0,
    )
    .map((v) => {
      const i = labels.indexOf(v);
      return `<text x="${x(i)}" y="${h - 15}" text-anchor="${i === 0 ? "start" : i === maxN - 1 ? "end" : "middle"}" font-size="10" fill="#6b7d79">${esc(String(v).slice(0, 12))}</text>`;
    })
    .join(
      "",
    )}</svg><div class="chart-legend">${series.map((s, i) => `<span><i style="background:${colors[i % colors.length]}"></i>${esc(s.name)}</span>`).join("")}</div>`;
}
