import type { EwaReport, Finding } from "./ewa.ts";
import { sectionBySource } from "./section-reference.ts";

const normalized = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en");

export function findingEvidence(report: EwaReport, finding: Finding) {
  const section = sectionBySource(report, finding.source);
  const evidence = normalized(finding.evidence);
  const observation = section?.observations.find((line) => {
    const text = normalized(line);
    return text.length >= 18 && evidence.includes(text.slice(0, Math.min(text.length, 90)));
  }) ?? null;
  // A section can be known even when a generated summary does not reproduce
  // its wording. Keep that source text visible, but label it separately from
  // an observation that directly matches the finding evidence.
  const sourceStatement = observation ?? section?.observations.find((line) => normalized(line).length >= 25) ?? null;
  const tableMatch = section?.tables.flatMap((table) => table.rows.map((row) => ({ table, row }))).find(({ row }) => {
    const matches = row.filter((cell) => {
      const text = normalized(cell);
      return text.length >= 4 && evidence.includes(text);
    });
    return matches.some((cell) => normalized(cell).length >= 10) || matches.length >= 2;
  }) ?? null;
  const alert = section ? report.alerts.items.find((item) => {
    const title = normalized(item.title);
    const sectionTitle = normalized(section.title);
    return sectionTitle.length >= 12 && title.includes(sectionTitle);
  }) : null;

  return {
    section,
    observation,
    sourceStatement,
    table: tableMatch ? {
      title: tableMatch.table.title || section?.title || "Kaynak tablo",
      values: tableMatch.row.slice(0, 8).map((value, index) => ({ label: tableMatch.table.header[index] || `Sütun ${index + 1}`, value })),
      omitted: Math.max(0, tableMatch.row.length - 8),
    } : null,
    alert: alert && alert.severity !== "unknown" ? alert : null,
  };
}
