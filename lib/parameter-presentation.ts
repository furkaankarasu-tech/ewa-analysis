import type { EwaReport } from "./ewa.ts";
import type { HanaParameter } from "./ewa-detail.ts";

export function parameterRows(report: EwaReport) {
  const seen = new Set<string>();
  return report.hanaParameters.filter((item) => {
    const key = JSON.stringify([item.location, item.parameter, item.current, item.recommended, item.note]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parameterReference(report: EwaReport, item: HanaParameter) {
  const normalize = (text: string) => text.replace(/\s+/g, "").toLowerCase();
  const sections = report.sections.filter((section) => section.tables.some((table) => {
    const parameter = table.header.findIndex((cell) => /^parameter$/i.test(cell.trim()));
    const location = table.header.findIndex((cell) => /^location$/i.test(cell.trim()));
    return parameter >= 0 && location >= 0 && table.rows.some((row) =>
      normalize(row[parameter] ?? "") === normalize(item.parameter) &&
      normalize(row[location] ?? "") === normalize(item.location));
  }));
  if (sections.length !== 1 || !sections[0].number) return "Madde doğrulanamadı";
  const section = sections[0];
  return `Madde ${section.number}${section.page ? ` · s. ${section.page}` : ""}`;
}
