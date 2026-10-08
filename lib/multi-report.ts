import type { EwaReport } from "./ewa.ts";

function periodEnd(period: string): number | null {
  const dates = [...period.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)];
  const last = dates.at(-1);
  if (!last) return null;
  const day = Number(last[1]), month = Number(last[2]), year = Number(last[3]);
  const result = Date.UTC(year, month - 1, day);
  const parsed = new Date(result);
  return parsed.getUTCDate() === day && parsed.getUTCMonth() === month - 1 && parsed.getUTCFullYear() === year ? result : null;
}

export function systemOverview(reports: EwaReport[]) {
  const ewas = reports.filter((report) => report.kind === "EWA");
  const systems = new Map<string, { sid: string; report: EwaReport; count: number; periodDate: number | null }>();
  ewas.forEach((report, index) => {
    // Unknown SIDs must never be merged as though they were the same system.
    const key = /^[A-Z][A-Z0-9]{2,3}$/.test(report.sid) ? report.sid : `unknown-${index}`;
    const date = periodEnd(report.period);
    const previous = systems.get(key);
    if (!previous) systems.set(key, { sid: report.sid, report, count: 1, periodDate: date });
    else {
      previous.count += 1;
      if (date !== null && (previous.periodDate === null || date >= previous.periodDate) || date === null && previous.periodDate === null) {
        previous.report = report;
        previous.periodDate = date;
      }
    }
  });
  const items = [...systems.values()].map((item) => ({
    ...item,
    critical: item.report.findings.filter((finding) => finding.priority === "kritik").length,
    high: item.report.findings.filter((finding) => finding.priority === "yuksek").length,
    findings: item.report.findings.length,
  })).sort((a, b) => b.critical - a.critical || b.high - a.high || a.sid.localeCompare(b.sid));
  const knownSystems = items.filter((item) => /^[A-Z][A-Z0-9]{2,3}$/.test(item.sid)).length;
  return { reports: ewas.length, systems: knownSystems, unknown: items.length - knownSystems,
    critical: items.reduce((sum, item) => sum + item.critical, 0), items };
}
