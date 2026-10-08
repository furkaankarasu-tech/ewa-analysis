import type { EwaReport, Finding } from "./ewa.ts";
import type { ReportSection } from "./report-structure.ts";

function plainSource(source: string) {
  return source.replace(/^Alert Overview\s*·\s*/, "").replace(/\s*·\s*s\.\s*\d+\s*$/, "").trim();
}

function normalized(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en");
}

export function sectionBySource(report: EwaReport, rawSource: string): ReportSection | null {
  if (report.kind !== "EWA") return null;
  const source = plainSource(rawSource);
  // Numberless headings still carry valid evidence and ratings. A missing
  // section number must not discard the section itself.
  const numbered = report.sections;
  const matchingPath = numbered.filter((section) => normalized(section.path) === normalized(source));
  if (matchingPath.length === 1) return matchingPath[0];
  if (matchingPath.length > 1) return null;
  // Some derived findings name a short parent path. Match the leaf only when
  // the numbered report section has a unique title.
  const leaf = source.split(/\s*>\s*/).at(-1) ?? source;
  const matchingTitle = numbered.filter((section) => normalized(section.title.replace(/^\d+(?:\.\d+)*\s+/, "")) === normalized(leaf));
  return matchingTitle.length === 1 ? matchingTitle[0] : null;
}

export function sectionReference(report: EwaReport, finding: Finding): ReportSection | null {
  return sectionBySource(report, finding.source);
}

export function ewaItem(report: EwaReport, finding: Finding) {
  const section = sectionReference(report, finding);
  if (section?.number) return `Madde ${section.number} · ${section.title.replace(/^\d+(?:\.\d+)*\s+/, "")}`;
  const source = plainSource(finding.source);
  const title = source.split(/\s*>\s*/).at(-1) || source || finding.title;
  return report.kind === "EWA" ? `Numara doğrulanamadı · ${title}` : title;
}
