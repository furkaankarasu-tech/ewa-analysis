import { knownSapTranslation } from "./local-translation.ts";
/** Reviewed translations for stable, report-authored EWA alarm descriptions.
 * An unmatched statement is never converted into an invented finding. */
const reviewedAlerts: Array<[RegExp, string]> = [
  [/^SAP Software on this system is outdated\. Support with SAP Security Notes is no longer ensured\.?$/i, "Sistemdeki SAP yazılımı güncel değil. SAP Security Note düzeltmeleriyle destek sağlanması artık güvence altında değil."],
  [/^SAP HANA database:\s*Number of Records exceeds critical limit\.?$/i, "SAP HANA'da kayıt sayısı kritik sınırı aşıyor."],
  [/^SAP HANA database:\s*Memory consumption of tables exceeds 70% of usable memory\.?$/i, "SAP HANA tablolarının bellek tüketimi, kullanılabilir belleğin %70'ini aşıyor."],
  [/^ABAP number ranges are almost exhausted\.?$/i, "Bazı ABAP numara aralıkları tükenmek üzere."],
  [/^ABAP number ranges are used significantly\.?$/i, "ABAP numara aralıkları belirgin düzeyde kullanılıyor."],
  [/^SAP HANA network settings for System Replication is insecure\.?$/i, "SAP HANA System Replication ağ yapılandırmasında güvenlik riski bildiriliyor."],
  [/^SAP HANA database:\s*User SYSTEM is active and valid\.?$/i, "SAP HANA'da SYSTEM kullanıcısı etkin ve geçerli durumda."],
  [/^Users with critical authorizations, which allow to do anything in client 000\.?$/i, "000 istemcisinde tüm işlemlere izin veren kritik yetkilere sahip kullanıcılar bulunuyor."],
  [/^Users with critical authorizations, which allow to do anything in other client\(s\) than 000\.?$/i, "000 dışındaki istemcilerde tüm işlemlere izin veren kritik yetkilere sahip kullanıcılar bulunuyor."],
  [/^SAP HANA database:\s*Some issues for operation or administration in terms of log backup\/recovery have been detected\.?$/i, "SAP HANA log yedekleme veya kurtarma işlemleriyle ilgili sorunlar tespit edilmiş."],
  [/^Based on response times in your ABAP system performance problems may occur\.?$/i, "ABAP yanıt süreleri, performans sorunu yaşanabileceğine işaret ediyor."],
  [/^We found more than (\d+) ABAP dumps in your system\.?$/i, ""],
  [/^There are ABAP number ranges with invalid range or level\.?$/i, "Bazı ABAP numara aralıklarının sınırları veya mevcut seviyeleri hatalı."],
  [/^SAP HANA database:\s*Parameters are not set in accordance with the recommendation\.?$/i, "Bazı SAP HANA parametreleri önerilen değerlere uygun değil."],
  [/^SAP HANA database:\s*Consistency checks are scheduled without the global consistency check\.?$/i, "SAP HANA tutarlılık kontrolleri, genel tutarlılık kontrolü olmadan planlanmış."],
  [/^SAP HANA database:\s*Few SAP HANA dumps occurred on your system\.?$/i, "Sistemde az sayıda SAP HANA dump kaydı oluşmuş."],
  [/^Hardware resources may have been exhausted with the risk of performance degradation\.?$/i, "Donanım kaynakları sınırına ulaşmış olabilir; performans düşüşü riski bulunuyor."],
  [/^SAP HANA database:\s*Recommended Audit configuration is not applied\.?$/i, "SAP HANA için önerilen denetim (Audit) yapılandırması uygulanmamış."],
  [/^The trend analysis on response time and applications shows a critical trend\.?$/i, "Yanıt süreleri ve uygulamalara ilişkin eğilim analizinde kritik bir değişim raporlanmış."],
];

export function reviewedAlertTranslation(source: string): string | null {
  const normalized = source.replace(/\s+/g, " ").trim();
  for (const [pattern, translation] of reviewedAlerts) {
    const match = pattern.exec(normalized);
    if (match) return translation || `Sistemde ${match[1]} adetten fazla ABAP dump kaydı bulunmuş.`;
  }
  return null;
}

/** Protect the distinction between source translation and AI/heuristic analysis. */
export function alertPresentation(source: string, translated?: string, showTranslation = true): { primary: string; original?: string; untranslated: boolean } {
  if (!showTranslation) return { primary: source, untranslated: false };
  const approved = reviewedAlertTranslation(source) ?? knownSapTranslation(source);
  const text = (approved ?? translated ?? "").trim();
  if (text && text !== source.trim()) return { primary: text, original: source, untranslated: false };
  return { primary: source, untranslated: /\b(?:the|your|with|users|database|number|memory|security|performance|system|SAP HANA)\b/i.test(source) };
}
