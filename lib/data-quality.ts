import type { EwaReport } from "./ewa.ts";
import { sectionBySource } from "./section-reference.ts";

export type QualityCheck = { label: string; value: string; state: "ok" | "attention" };
export type QualityIssue = { title: string; detail: string };

export function assessDataQuality(report: EwaReport): { checks: QualityCheck[]; issues: QualityIssue[] } {
  const checks: QualityCheck[] = [];
  const issues: QualityIssue[] = [];
  const identified = /^[A-Z][A-Z0-9]{2,3}$/.test(report.sid);
  const dated = /\d{2}\.\d{2}\.\d{4}/.test(report.period);
  checks.push({ label: "Sistem / dönem", value: identified && dated ? "Okundu" : "Kontrol gerekli", state: identified && dated ? "ok" : "attention" });
  if (!identified || !dated) issues.push({ title: "Rapor kimliği eksik", detail: `${!identified ? "SID" : ""}${!identified && !dated ? " ve " : ""}${!dated ? "dönem" : ""} güvenilir biçimde okunamadı. Dosyadaki kapak bilgisini kontrol edin.` });

  if (report.kind === "EWA") {
    const alertsKnown = report.alerts.total !== null && !report.alerts.items.some((item) => item.severity === "unknown");
    checks.push({ label: "Alarm renkleri", value: alertsKnown ? `${report.alerts.total} kayıt okundu` : "Belirsiz", state: alertsKnown ? "ok" : "attention" });
    if (!alertsKnown) issues.push({ title: "Alarm derecesi belirsiz", detail: report.alerts.total === null ? "Alert Overview kayıtları doğrulanamadı." : "Bazı alarm ikonlarının rengi okunamadı; kırmızı/sarı sayılarına göre karar vermeyin." });

    const numbered = report.findings.filter((finding) => sectionBySource(report, finding.source)?.number).length;
    const allNumbered = numbered === report.findings.length && report.findings.length > 0;
    checks.push({ label: "Madde eşleşmesi", value: `${numbered}/${report.findings.length} bulgu`, state: allNumbered ? "ok" : "attention" });
    if (numbered < report.findings.length) issues.push({ title: "Kaynak maddesi eksik", detail: `${report.findings.length - numbered} bulgu numaralı bir EWA bölümüyle tekil olarak eşleşmedi. Bu satırlardaki madde numarasını uydurmayın.` });

    const rated = report.findings.filter((finding) => {
      const rating = sectionBySource(report, finding.source)?.rating;
      return rating === "red" || rating === "yellow" || rating === "green";
    }).length;
    checks.push({ label: "Bölüm rengi", value: `${rated}/${report.findings.length} bulgu`, state: rated === report.findings.length && rated > 0 ? "ok" : "attention" });
    if (rated < report.findings.length) issues.push({ title: "Bazı bölüm renkleri okunamadı", detail: `${report.findings.length - rated} bulguda bölüm rengi doğrulanamadı. Bu kayıtlara tahmini bir SAP seviyesi atanmaz; özgün rapordaki ikon kontrol edilmelidir.` });

    const sqlHeading = report.sections.some((section) => /Top SQL Statements|SQL Statements|expensive SQL statements/i.test(section.title));
    if (sqlHeading && !report.topSqlStatements.length && !report.sqlHotspots.length && !report.sqlLoads.length && !report.sqlServerStatements.length) {
      issues.push({ title: "SQL tablosu okunamadı", detail: "SQL başlığı bulundu, ancak güvenilir satır çıkarılamadı. Kaynak rapordaki tabloyu kontrol edin." });
    }
    if (!report.findings.length) issues.push({ title: "Aksiyon çıkarılamadı", detail: "Bu raporda otomatik bulgu bulunmadı; bu, sistemde sorun olmadığı anlamına gelmez." });
  } else {
    checks.push({ label: "Kontrol bulguları", value: `${report.findings.length} kayıt`, state: report.findings.length ? "ok" : "attention" });
    if (!report.findings.length) issues.push({ title: "Kontrol tablosu okunamadı", detail: "Aylık bakım raporundaki risk ve çözüm tablolarını kaynak belgede inceleyin." });
  }

  return { checks, issues };
}
