/* Presentation-only dashboard helpers. Only values present in the uploaded report are used. */
import type { EwaReport } from "./ewa.ts";

type Metric = EwaReport["kpis"][number];

// Do not compare SQL milliseconds with GB or invent a maximum for unbounded values.
export function kpiPercent(kpi: Metric): number | null {
  const raw = kpi.value.trim();
  const percentMatch = raw.match(/^%\s*(\d+(?:[.,]\d+)?)\b/);
  if (percentMatch) return asPercent(percentMatch[1]);
  const ratio = raw.match(/(?:^|\s)(\d[\d.,]*)\s*\/\s*(\d[\d.,]*)\s*(?:GB|MB|TB|$)/i);
  if (ratio) {
    const current = readNumber(ratio[1]);
    const total = readNumber(ratio[2]);
    return total > 0 && current >= 0 && current <= total ? (current / total) * 100 : null;
  }
  // Some reports put the HANA percentage in the KPI note, rather than value.
  if (/HANA bellek/i.test(kpi.label)) {
    const match = kpi.note?.match(/%\s*(\d+(?:[.,]\d+)?)\s*limit/i);
    if (match) return asPercent(match[1]);
  }
  return null;
}

function readNumber(raw: string): number {
  const value = raw.replace(/\s/g, "");
  if (value.includes(",") && value.includes(".")) {
    return Number(value.lastIndexOf(",") > value.lastIndexOf(".") ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, ""));
  }
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(value)) return Number(value.replace(/[,.]/g, ""));
  return Number(value.replace(",", "."));
}
function asPercent(raw: string): number | null {
  const value = readNumber(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

const kpiOrder = ["Yazılım komponentleri", "En yüksek SQL toplam süre", "SQL bellek / çalıştırma", "HANA bellek", "DATA disk boşluğu", "DB büyüklüğü", "Dialog yanıt", "ABAP dump"];
export function orderedKpis(kpis: Metric[]) {
  return [...kpis].sort((left, right) => {
    const a = kpiOrder.indexOf(left.label); const b = kpiOrder.indexOf(right.label);
    return (a < 0 ? kpiOrder.length : a) - (b < 0 ? kpiOrder.length : b);
  });
}

export function sectionCoverage(sections: EwaReport["sections"]) {
  const total = sections.length;
  const content = sections.filter((section) => section.observations.some(Boolean) || section.recommendations.some(Boolean) || section.tables.some((table) => table.rows.length > 0)).length;
  // A heading with no matched content is NOT proof the report section failed to parse.
  return { total, withContent: content, headingsOnly: total - content, percent: total > 0 ? Math.round(content / total * 100) : null };
}
