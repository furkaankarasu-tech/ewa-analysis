import type { EwaReport, Finding } from './ewa.ts';
import type { ReportSection } from './report-structure.ts';
import { sectionBySource } from './section-reference.ts';

export type SourceRating = ReportSection['rating'];
export const sourceRatingLabels: Record<SourceRating, string> = {
  red: 'Kritik · Kırmızı', yellow: 'Uyarı · Sarı',
  green: 'Normal · Yeşil', unknown: 'Seviye okunamadı',
};

/** Use a unique source section or the exact alert statement; never propagate
 * a parent/nearby topic's severity, or infer a SAP rating from a number. */
export function alignSourceSeverity(report: EwaReport): EwaReport {
  if (report.kind !== 'EWA') return report;
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const findings = report.findings.map((finding): Finding => {
    const section = sectionBySource(report, finding.source);
    const alerts = report.alerts.items.filter(item => normalize(item.title) === normalize(finding.evidence));
    const exactAlert = alerts.length === 1 ? alerts[0] : undefined;
    const sourceRating = section?.rating && section.rating !== 'unknown' ? section.rating : exactAlert?.severity ?? 'unknown';
    const severitySource = section?.rating && section.rating !== 'unknown'
      ? `Kaynak bölüm${section.number ? ` ${section.number}` : ''}: ${sourceRatingLabels[sourceRating]}`
      : exactAlert && exactAlert.severity !== 'unknown'
        ? `Alert Overview: ${sourceRatingLabels[sourceRating]}`
        : 'Kaynak rengi doğrulanamadı; önem seviyesi atanmadı.';
    return { ...finding, sourceRating, severitySource,
      priority: sourceRating === 'red' ? 'kritik' : sourceRating === 'yellow' ? 'yuksek' : 'izle' };
  });
  const order = { kritik: 0, yuksek: 1, orta: 2, izle: 3 };
  findings.sort((a, b) => order[a.priority] - order[b.priority]);
  return { ...report, findings };
}

export function findingSeverityLabel(finding: Finding): string {
  return finding.sourceRating !== undefined ? sourceRatingLabels[finding.sourceRating]
    : { kritik: 'Kritik', yuksek: 'Yüksek', orta: 'Orta', izle: 'Takip' }[finding.priority];
}
