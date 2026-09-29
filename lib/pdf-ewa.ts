import type { ReportSection } from "./report-structure.ts";
import type { LifecycleRecord } from "./lifecycle.ts";

const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const date = /\b\d{2}\.\d{2}\.\d{4}\b/;
const issue = /not implemented|not set up|missing|outdated|failed|unsuccessful|unprocessed|inactive|disabled|occurred|errors|exhausted|not effective|critical|expired|expire|backlog|no longer|not anymore|not in maintenance|run out of|maintenance end is reached|more than \d|less than \d/i;

export function pdfAlerts(lines: string[]) {
  const start = lines.findIndex((line) => line === "Alert Overview");
  if (start < 0) return [] as string[];
  const end = lines.findIndex((line, at) => at > start && /^(?:To provide feedback|Hide and Snooze EarlyWatch Alerts|Check Overview|Based on these findings)/i.test(line));
  const block = lines.slice(start + 1, end > start ? end : start + 80).filter((line) => line && line !== "-");
  const results: string[] = [];
  for (const line of block) {
    if (/^[a-z,;.)]/.test(line) && results.length) results[results.length - 1] += ` ${line}`;
    else results.push(line);
  }
  return [...new Set(results.filter((line) => line.length > 20 && !/^(?:Confidential|EarlyWatch Alert)/i.test(line)))];
}

export function pdfSections(lines: string[]): ReportSection[] {
  const sections: ReportSection[] = [];
  const stack: { level: number; title: string }[] = [];
  let current: ReportSection | null = null;
  let content: string[] = [];
  const finish = () => {
    if (!current) return;
    const seen = new Set<string>();
    for (let at = 0; at < content.length; at++) {
      const line = content[at];
      if (/^Recommendation:/i.test(line)) {
        const parts = [line];
        for (let ahead = at + 1; ahead < Math.min(at + 5, content.length) && !/[.!?]\s*$/.test(parts.at(-1)!); ahead++) {
          if (/^(?:Recommendation:|Please note|For more information)/i.test(content[ahead])) break;
          parts.push(content[ahead]);
        }
        current.recommendations.push(parts.join(" ").slice(0, 850));
      } else if ((issue.test(line) || date.test(line)) && !seen.has(line) && current.observations.length < 5 && !/^Mainstream \/ Extended maintenance offered/i.test(line)) {
        current.observations.push(line.slice(0, 650)); seen.add(line);
      }
    }
    sections.push(current);
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = line.match(/^(\d{1,2}(?:\.\d{1,2}){0,5})\s+([A-Z][\s\S]{3,})$/);
    if (match && lines[index + 1] === "-" && !/^(?:SP |GB |MB )/i.test(match[2])) {
      finish();
      const level = match[1].split(".").length;
      while (stack.length && stack.at(-1)!.level >= level) stack.pop();
      const title = match[2].replace(/\s+\d+\/\d+$/, "");
      stack.push({ level, title });
      current = { title, path: stack.map((item) => item.title).join(" > "), level, rating: "unknown", observations: [], recommendations: [], tables: [] };
      content = [];
    } else if (current && line !== "-" && !/^(?:Confidential|EarlyWatch Alert\s)/.test(line)) content.push(line);
  }
  finish();
  return sections.filter((section) => !section.path.startsWith("Service Summary") && !/SQL Statement [a-f0-9]{32}/i.test(section.path));
}

export function pdfLifecycle(lines: string[]): LifecycleRecord[] {
  const records: LifecycleRecord[] = [];
  const add = (record: Omit<LifecycleRecord, "rating">) => records.push({ ...record, rating: "unknown" });
  const text = lines.join(" ");
  const product = text.match(/(SAP S\/4HANA\s+\d{4})\s+(\d{2}\.\d{2}\.\d{4})/i);
  if (product) add({ area: "SAP ürünü", name: product[1], installed: "", dateLabel: "Ana bakım sonu", endDate: product[2], extendedEnd: "", status: "", source: "Software Configuration > SAP Application Release - Maintenance Phases", note: "Rapor tarihindeki sözleşme kapsamını doğrulayın." });
  const fiori = text.match(/(SAP Fiori FES\s+[\d.]+)\s+(\d{3})\s+(\d{2}\.\d{2}\.\d{4})/i);
  if (fiori) add({ area: "Fiori Front-End", name: fiori[1], installed: `SAP_UI ${fiori[2]}`, dateLabel: "Bakım sonu", endDate: fiori[3], extendedEnd: "", status: "", source: "Software Configuration > SAP Fiori Front-End Server Version", note: "" });
  const hanaSection = text.match(/HANA Database Support Package Stack for [A-Z0-9]+([\s\S]*?)(?:SAP HANA: SQLDBC Version|Installed SQLDBC Version)/i)?.[1] ?? "";
  const hanaDate = hanaSection.match(/\b(?:\d+\s+){2,4}(\d{2}\.\d{2}\.\d{4})/);
  if (hanaDate) add({ area: "HANA SPS", name: "SAP HANA Support Package Stack", installed: "", dateLabel: "SPS bakım sonu", endDate: hanaDate[1], extendedEnd: "", status: "", source: "Software Configuration > HANA Database Support Package Stack", note: "HANA revizyonuyla birlikte doğrulayın." });
  const osSection = text.match(/Operating System\(s\) - Maintenance Phases([\s\S]*?)HANA Database Version for/i)?.[1] ?? "";
  for (const pattern of [/(Windows Server\s+\d{4})\s+(\d{2}\.\d{2}\.\d{4})\s+(\d{2}\.\d{2}\.\d{4})/gi, /(SUSE Linux Enterprise Server\s+\d+(?:\s+on\s+Power)?)\s+(\d{2}\.\d{2}\.\d{4})\s+(\d{2}\.\d{2}\.\d{4})/gi]) {
    for (const match of osSection.matchAll(pattern)) add({ area: "İşletim sistemi", name: match[1], installed: "", dateLabel: "Standart destek sonu", endDate: match[2], extendedEnd: match[3], status: "", source: "Software Configuration > Operating System(s) - Maintenance Phases", note: "" });
  }
  const ui = text.match(/Current SAPUI5 Version Installed[\s\S]{0,120}?\b(\d+\.\d+\.\d+)\b[\s\S]{0,230}?planned end of maintenance[^.]*?(\d{2}\.\d{2}\.\d{4})/i);
  if (ui) add({ area: "SAPUI5", name: "SAPUI5 Library", installed: ui[1], dateLabel: "Bakım sonu", endDate: ui[2], extendedEnd: "", status: "", source: "Software Configuration > SAPUI5 Version", note: "" });
  return records;
}
