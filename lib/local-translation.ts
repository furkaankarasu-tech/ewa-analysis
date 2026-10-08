import { sapRuleTranslation } from "./sap-translation-rules.ts";
import { reviewedEwaPhrases } from "./reviewed-ewa-phrases.ts";
import { translatedSapHeading, translatedSapStatement } from "./sap-terminology.ts";
export type LocalTranslator = {
  translate(text: string): Promise<string>;
  destroy?(): void;
};

export type TranslatedFinding = Partial<Record<"title" | "evidence" | "impact" | "cause" | "action", string>>;
export type TranslationBundle = {
  language?: "tr";
  findings: Record<number, TranslatedFinding>;
  recommendations: Record<number, string>;
  alerts?: Record<number, string>;
  decisive?: Record<number, string>;
};

export const emptyTranslations = (): TranslationBundle => ({ findings: {}, recommendations: {}, alerts: {}, decisive: {} });

export type TranslatorFactory = {
  availability?(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: { addEventListener: (name: string, listener: (event: { loaded?: number }) => void) => void }) => void;
  }): Promise<LocalTranslator>;
};

export function browserTranslator(): TranslatorFactory | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { Translator?: TranslatorFactory; ai?: { translator?: TranslatorFactory } };
  return host.Translator ?? host.ai?.translator ?? null;
}

function chunksOf(text: string, limit = 900): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    const region = rest.slice(0, limit + 1);
    const sentence = Math.max(region.lastIndexOf(". "), region.lastIndexOf("; "), region.lastIndexOf("! "));
    const space = region.lastIndexOf(" ");
    const split = sentence >= limit / 2 ? sentence + 1 : space >= limit / 2 ? space : limit;
    chunks.push(rest.slice(0, split).trim());
    rest = rest.slice(split).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

// SAP HANA glossary: write natural Turkish and keep the original DB term in parentheses.
const technicalGlossary: Record<string, string> = {
  dump: "dump", dumps: "dump kayıtları", kernel: "kernel",
  "system replication": "System Replication",
  savepoint: "savepoint", checkpoint: "checkpoint", tablespace: "tablespace",
  "number of partitions": "partition sayısı",
  "table partitioning": "table partitioning",
  "non-partitioned": "partitioning uygulanmamış",
  partitioning: "partitioning",
  partitions: "partitions",
  partition: "partition",
  tablespaces: "tablespace alanları",
  rowstore: "rowstore",
  columnstore: "columnstore",
};

// Match longer phrases before individual words and protect whole SAP product names,
// technical parameter paths, transaction codes, numeric values and SQL identifiers.
const glossaryPattern = /\b(?:[Dd]umps?|[Kk]ernel|[Ss]ystem [Rr]eplication|[Ss]avepoint|[Cc]heckpoint|[Nn]umber of [Pp]artitions|[Tt]able [Pp]artitioning|[Nn]on-[Pp]artitioned|[Pp]artitioning|[Pp]artitions?|[Tt]ablespaces?|[Rr]owstore|[Cc]olumnstore)\b|\b(?:SAP )?Support Packages?\b|\bSAP (?:HANA|Fiori Front-End Server|NetWeaver|Note\s+\d+|Maintenance Planner)\b|`[^`]+`|\b(?:[a-z][a-z0-9_.-]*\/[a-z][a-z0-9_.\/-]*|[A-Z][A-Z0-9_./-]{2,}|[A-Z][a-z]+(?:[A-Z][a-z0-9]+)+|[a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b|\b\d+(?:[.,]\d+)*%?/g;
const numericPattern = /\d+(?:[.,]\d+)*%?/g;
const tokenPattern = /ZXQEWATERM\d+QXZ/g;

function protectTechnicalText(text: string) {
  const terms: string[] = [];
  const masked = text.replace(glossaryPattern, (term) => {
    const normalized = term.toLowerCase();
    // An all-caps identifier is a name, not a glossary word to be localized.
    const restored = term === term.toUpperCase() ? term : technicalGlossary[normalized] ?? term;
    const marker = `ZXQEWATERM${terms.length}QXZ`;
    terms.push(restored);
    return marker;
  });
  return { masked, terms };
}

// Do not machine-translate phrases that already contain Turkish text.
export function looksEnglish(value: string): boolean {
  const text = value.trim();
  if (!text || /[çğıöşüÇĞİÖŞÜ]/.test(text)) return false;
  return /\b(?:investigate|review|analyze|analyse|refer|protect|update|upgrade|apply|install|configure|activate|enable|run|assign|verify|ensure|check|is|are|was|were|been|required|current|target|component|resources?|limitations?|using|urgently|the|your|you|this|these|those|of|to|from|with|due|has|have|having|will|should|must|please|consider|recommended|recommendation|risk|users|system|security|database|performance|release|maintenance|support|package|packages|client|authorization|authorized|information|chapter|outdated|settings|check|ensure|critical|number|table|import|default|passwords?|gateway|backup|memory|consumption|utilization|configuration|logs?|failed|missing|errors?|transport|sequence|auditing|status|statisticsserver|monitoring|statements?|partitions?|partitioning)\b/i.test(text);
}

/** Reject fluent-looking but technically wrong SAP translations before they reach the UI. */
export function passesTechnicalReview(source: string, candidate: string): boolean {
  const original = source.toLocaleLowerCase("en-US");
  const target = candidate.toLocaleLowerCase("tr-TR");
  if (/\bexcept\b/i.test(source) && !/hariç|dışında|dışındaki/i.test(candidate)) return false;
  if (/\bat least\b/i.test(source) && !/en az/i.test(candidate)) return false;
  if (/\bat most\b/i.test(source) && !/en fazla/i.test(candidate)) return false;
  if (/\bdumps?\b/i.test(source) && (!/\bdump\b/i.test(candidate) || /kısa döküm/i.test(candidate))) return false;
  if (/\bkernel\b/i.test(source) && (!/\bkernel\b/i.test(candidate) || /çekirdek/i.test(candidate))) return false;
  if (!candidate.trim() || /ZXQEWATERM\d+QXZ/.test(candidate)) return false;
  // "security maintenance" refers to SAP's security-maintenance window,
  // not the entire product lifecycle or generic customer support.
  if (original.includes("security maintenance") && (
    !/güvenlik bakım/.test(target) ||
    /güvenlik (?:desteği|güncelleme desteği)/.test(target) ||
    /güvenlik bakımı bitti|düzeyi güvenlik bakımı/.test(target)
  )) return false;
  if (/support packages?/i.test(source) && !/support package/i.test(candidate)) return false;
  // SAP/HANA documentation uses partition/partitioning as technical terms.
  // Do not accept machine output that turns them into vague Turkish words.
  if (/\b(?:partitioning|non-partitioned|partitions?)\b/i.test(source) &&
      (!/\bpartition/i.test(candidate) || /bölümlen|bölümlere ayr|partisyon/i.test(candidate))) return false;
  if (/\b(?:should|must|please|ensure|recommend)\b/i.test(source) &&
      /\b(?:you should|please ensure|we recommend)\b/i.test(candidate)) return false;
  return true;
}

// No report data leaves the browser. A protected first pass keeps SAP IDs and
// numbers intact. If the browser translator changes protection markers, retry
// the original text, but accept it only if every critical literal survives.
const hasTurkishGrammar = (text: string) => /[çğıöşüÇĞİÖŞÜ]|\b(?:en az|en fazla|yedek|tutun|ve|için|olarak|edin|edilmeli|kontrol|olduğunu|olmalıdır|üzerinden|önerilir|kullanımını|yeniden|gereken|gerekir|uygulanması|sağlayın|etkinleştirin)\b/i.test(text);

export function sameCriticalLiterals(source: string, result: string) {
  const numbers = (value: string) => (value.match(/\d+(?:[.,]\d+)*/g) ?? []).sort().join("|");
  const identifiers = (value: string) => [
    ...(value.match(/\bSAP Note\s+\d+\b/gi) ?? []),
    ...(value.match(/(?:\b[a-z][a-z0-9_.-]*\/[a-z][a-z0-9_.\/-]*\b|(?<![\w])_?[A-Z][A-Z0-9_./-]{2,}\b|\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b)/g) ?? []),
  ];
  return numbers(source) === numbers(result) && identifiers(source).every((item) => identifiers(result).includes(item));
}

export async function translateText(translator: LocalTranslator, original: string): Promise<string> {
  const translated: string[] = [];
  for (const chunk of chunksOf(original)) {
    const { masked, terms } = protectTechnicalText(chunk);
    let result = (await translator.translate(masked)).trim();
    const incoming = (masked.replace(tokenPattern, "").match(numericPattern) ?? []).sort().join("|");
    const outgoing = (result.replace(tokenPattern, "").match(numericPattern) ?? []).sort().join("|");
    const unchanged = masked.replace(tokenPattern, "").replace(/\s+/g, " ").trim().toLowerCase() ===
      result.replace(tokenPattern, "").replace(/\s+/g, " ").trim().toLowerCase();
    let damaged = !result || incoming !== outgoing || unchanged;
    if (!damaged) for (const [index, term] of terms.entries()) {
      const marker = `ZXQEWATERM${index}QXZ`;
      if (result.split(marker).length !== 2) { damaged = true; break; }
      result = result.replace(marker, term);
    }
    if (!damaged && hasTurkishGrammar(result) && passesTechnicalReview(chunk, result)) {
      translated.push(result);
      continue;
    }
    // A few browser versions reformat opaque markers. Their raw output can
    // still be useful, but never accept missing/modified identifiers or values.
    if (terms.length) {
      try {
        const raw = (await translator.translate(chunk)).trim();
        if (raw && raw !== chunk && hasTurkishGrammar(raw) &&
            sameCriticalLiterals(chunk, raw) && passesTechnicalReview(chunk, raw)) {
          translated.push(raw);
          continue;
        }
      } catch { /* Keep the true SAP text when the raw second pass fails. */ }
    }
    // A partially translated paragraph must never count as a completed translation.
    return original;
  }
  return translated.join(" ").replace(/\u00e2/g, "a").replace(/\u00c2/g, "A");
}

// Only accept a phrasebook result when it preserves every number written in
// the source. Otherwise show the original or use the on-device translator.
function verifiedTemplate(original: string, translated: string): string | null {
  const numbers = (text: string) => (text.match(/\b\d+(?:[.,]\d+)*\b/g) ?? []).sort().join("|");
  return numbers(original) === numbers(translated) ? translated : null;
}

/** Reviewed translations of stable EWA phrases, without guessing at report-specific measurements. */
export function knownSapTranslation(source: string): string | null {
  const normalized = source.replace(/\u00ad/g, "").trim().replace(/\s+/g, " ").replace(/^Recommendation\s*:\s*/i, "");
  const rule = sapRuleTranslation(normalized);
  if (rule) return verifiedTemplate(normalized, rule);
  const phraseKey = (value: string) => value.trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "").toLocaleLowerCase("en-US");
  const reviewed = Object.entries(reviewedEwaPhrases).find(([english]) => phraseKey(english) === phraseKey(normalized));
  if (reviewed) return verifiedTemplate(normalized, reviewed[1]);
  const stackKernel = normalized.match(/^Consider updating to the latest SP Stack Kernel\.\s*For details see SAP Notes?\s+([\d\s,;]+(?:and\s+\d+)?)[\s.]*$/i);
  if (stackKernel) {
    const notes = stackKernel[1].match(/\d+/g) ?? [];
    return `En güncel SP Stack Kernel sürümüne güncellemeyi değerlendirin. Ayrıntılar için SAP Note ${notes.join(", ")} kayıtlarına bakın.`;
  }
  if (/^Consider updating to the latest SP Stack Kernel\.?$/i.test(normalized)) return "En güncel SP Stack Kernel sürümüne güncellemeyi değerlendirin.";
  if (/^Remove the DATA ADMIN privilege from all user accounts except (?:the )?SYSTEM (?:und|and) _SYS_REPO users\.?$/i.test(normalized)) return "SYSTEM ve _SYS_REPO kullanıcıları dışındaki tüm kullanıcı hesaplarından DATA ADMIN yetkisini kaldırın.";
  const kernel = normalized.match(/^To avoid the potential risks associated with running an outdated SAP kernel version, replace this version with downward-compatible SAP kernel (\d{3}(?:\.\d+)?(?:\s+(?:or|and)\s+\d{3}(?:\.\d+)?)?). The downward-?\s*compatible kernel is a special validated SAP kernel that improves the stability of your system\.?$/i);
  if (kernel) return `Güncel olmayan SAP kernel sürümünün risklerini önlemek için bu sürümü geriye uyumlu SAP kernel ${kernel[1].replace(/\s+or\s+/i, " veya ").replace(/\s+and\s+/i, " ve ")} ile değiştirin. Geriye uyumlu kernel, sistem kararlılığını artırmak için özel olarak doğrulanmış bir SAP kernel sürümüdür.`;
  if (/^Standard vendor support for your database version has already ended \/ will end in the near future\. Consider ordering extended vendor support from your database vendor or upgrading to a higher database version\.?$/i.test(normalized)) return "Veritabanı sürümünüzün standart üretici desteği sona ermiş veya yakında sona erecek. Üreticiden uzatılmış destek almayı ya da daha yüksek bir veritabanı sürümüne yükseltmeyi değerlendirin.";
  const normalizedKey = normalized.toLocaleLowerCase("en-US").replace(/[.\s]+$/, "");
  const glossary: Record<string, string> = {
    "We recommend urgently to upgrade your main product version. For more details see SAP Support Portal - Maintenance.":
      "SAP, ana ürün sürümünün acilen yükseltilmesini öneriyor. Hedef sürüm ve geçiş ön koşullarını SAP Support Portal üzerindeki Maintenance bölümünden kontrol edin.",
    "Memory Consumption of Indexserver": "Indexserver bellek tüketimi",
    "The memory usage of the index server was very close to its effective allocation limit.":
      "Indexserver bellek kullanımı, etkin bellek tahsis sınırına çok yaklaşmış.",
    "Analyze the reason for high memory consumption of the index server. Either reduce the memory consumption or revise the sizing of the SAP HANA database.":
      "Indexserver'ın yüksek bellek tüketiminin nedenini analiz edin. Bellek tüketimini azaltın veya SAP HANA veritabanının kaynak boyutlandırmasını yeniden değerlendirin.",
    "Largest Non-partitioned Column Tables (Records)": "Partitioning uygulanmamış en büyük sütun tabloları (kayıt sayısına göre)",
    "Large non-partitioned tables": "Partitioning uygulanmamış büyük tablolar",
    "Default Passwords of Standard Users": "Standart kullanıcıların varsayılan parolaları",
    "Password Complexity": "Parola karmaşıklığı",
    "Message Server Access Control List": "Message Server erişim kontrol listesi",
    "Gateway Error Logs": "Gateway hata günlükleri",
    "Validity of Initial Passwords": "Başlangıç parolalarının geçerlilik süresi",
  };
  const approvedHeading = translatedSapHeading(normalized);
  if (approvedHeading) return approvedHeading;
  const approvedStatement = translatedSapStatement(normalized);
  if (approvedStatement) return verifiedTemplate(normalized, approvedStatement);
  const exact = Object.entries(glossary).find(([key]) => key.toLocaleLowerCase("en-US").replace(/[.\s]+$/, "") === normalizedKey);
  if (exact) return exact[1];
  // Approved long-form SAP instructions. Only recognize them when their
  // distinctive context is present, never interpolate unknown recommendations.
  if (/^Please refer to the SAP Note 2217489/i.test(normalized) && /Fiori front-end server/i.test(normalized) && /Maintenance Planner/i.test(normalized)) {
    return verifiedTemplate(normalized, "Güncel SAP Fiori front-end server sürümlerini kontrol etmek ve yükseltme işlemini gerçekleştirmek için SAP Note 2217489'a bakın. SAP Maintenance Planner üzerinden sisteminizin kurulu ve planlanan ürünleri ile yazılım bileşenleri arasındaki bağımlılıkları doğrulayın. Gerekli bileşenleri indirmek üzere geçerli stack.xml dosyasını oluşturun. Yükseltmeden önce kurulu Fiori uygulamalarının hedef sürümle uyumluluğunu, sürüm tarihlerini ve tüm hedef bileşenlerin indirilebilirliğini kontrol edin.");
  }
  if (/^System-internal communication should be protected/i.test(normalized) && /system\/secure_communication/i.test(normalized) && /ms\/acl_info/i.test(normalized) && /SAP Note 821875/i.test(normalized)) {
    return verifiedTemplate(normalized, "Sistem içi iletişimi korumak için system/secure_communication profil parametresini ON olarak ayarlayın. Bu yapılandırma yoksa en azından ms/acl_info parametresinin, message server erişim kontrol listesini (ACL) içeren ms_acl_info dosyasını gösterdiğini doğrulayın. Bu dosya mevcut olmalı ve gereğinden geniş erişim veren kayıtlar içermemelidir. Ayrıntılar için SAP Note 821875'i inceleyin.");
  }
  if (/^Run report RSUSR003/i.test(normalized) && /SAPCPIC/i.test(normalized) && /TMSADM/i.test(normalized) && /SAP Note 1749142/i.test(normalized) && /SAP Note 1414256/i.test(normalized)) {
    return verifiedTemplate(normalized, "Varsayılan parolaları hala kullanan standart hesapları istemciler genelinde kontrol etmek için RSUSR003 raporunu çalıştırın. SAPCPIC kullanıcısının tüm istemcilerde varsayılan olmayan parola kullandığını doğrulayın. İhtiyaç duyulmayan ve EARLYWATCH tarafından kullanılan 066 istemcisini değerlendirin; kaldırma yöntemi SAP Note 1749142'de açıklanır. TMSADM kullanıcısının yalnızca 000 istemcisinde bulunduğunu ve varsayılan parolasının değiştirildiğini kontrol edin. Taşıma etki alanındaki TMSADM parola değişikliği için SAP Note 1414256'ya bakın.");
  }
  if (/^Enforce a minimum of (\d+) independent character categories/i.test(normalized) && /SAP Note 862989/i.test(normalized)) {
    const categories = normalized.match(/^Enforce a minimum of (\d+)/i)?.[1];
    return verifiedTemplate(normalized, `İlgili profil parametreleriyle parolalarda en az ${categories} farklı karakter kategorisi kullanılmasını zorunlu kılın. Ayrıntılar için SAP Note 862989'u ve SAP NetWeaver AS ABAP Güvenlik Kılavuzu'nun profil parametreleri bölümünü inceleyin.`);
  }
  if (/^Monitor the error logs periodically for errors/i.test(normalized)) {
    return verifiedTemplate(normalized, "Gateway hata günlüklerini düzenli olarak kontrol edin ve tespit edilen hataları gidermek için gerekli yönetim işlemlerini uygulayın.");
  }
  if (/^Proceed as follows/i.test(normalized) && /SUIM\/report RSUSR200/i.test(normalized) && /type C/i.test(normalized) && /type B/i.test(normalized)) {
    return verifiedTemplate(normalized, "İlk parola kullanımındaki iletişim kullanıcılarını (C tipi) inceleyin. Her istemcide SUIM veya RSUSR200 raporuyla bu kullanıcıları bulun. Aktif olarak kullanılan iletişim kullanıcılarında, uygunluğu doğrulayarak kullanıcı tipini B (sistem) olarak değiştirmeyi değerlendirin. Başlangıç parolalarının geçerlilik süresini 14 gün veya daha kısa tutun; 0 değerinin sınırsız geçerlilik sağladığını unutmayın. İlgili SAP Note 862989'u inceleyin.");
  }
  const passwordMin = normalized.match(/^Assign a minimum value of (\d+) to the profile parameter (login\/min_password_lng)\.$/i);
  if (passwordMin) return verifiedTemplate(normalized, `${passwordMin[2]} profil parametresini en az ${passwordMin[1]} olarak ayarlayın.`);
  // Compose only fully reviewed sentences. Decimal section numbers and versions
  // are not sentence boundaries, and any unknown sentence keeps the source intact.
  const sentences = normalized.split(/(?<=[.!?])\s+(?=[A-Z])/);
  if (sentences.length > 1) {
    const parts = sentences.map(knownSapTranslation);
    if (parts.every((part): part is string => part !== null)) return verifiedTemplate(normalized, parts.join(" "));
  }
  const note = normalized.match(/^(?:For (?:more )?(?:details|information)[, ]*|Please )?(?:see|refer to) SAP Notes?\s+([\d,;\s]+(?:and\s+\d+)?)[.\s]*$/i);
  if (note) return verifiedTemplate(normalized, `Ayrıntılar için SAP Note ${(note[1].match(/\d+/g) ?? []).join(", ")} kayıtlarına bakın.`);
  return null;
}

/** Bound local browser APIs so an unavailable model cannot leave the UI spinning. */
export async function translationDeadline<T>(operation: Promise<T>, milliseconds = 8000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Yerel çeviri zaman aşımına uğradı; özgün metin korundu.")), milliseconds);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

const reportLabels: Record<string, string> = {
  high: "Yüksek", medium: "Orta", low: "Düşük", critical: "Kritik", unknown: "Bilinmiyor",
  parameter: "Parametre", "parameter name": "Parametre adı", "current value": "Mevcut değer",
  "recommended value": "Önerilen değer", recommendation: "Öneri", description: "Açıklama",
  host: "Sunucu", instance: "Instance", status: "Durum", rating: "Değerlendirme",
  "table name": "Tablo adı", "number of records": "Kayıt sayısı", "number of partitions": "Partition sayısı",
  "memory consumption": "Bellek tüketimi", "user name": "Kullanıcı adı", user: "Kullanıcı",
  "database and abap load optimization of": "Veritabanı ve ABAP yük optimizasyonu",
};
/** Presentation only: never apply to parameter values, SQL or object names. */
export function reportLabel(source: string, turkish: boolean): string {
  if (!turkish) return source;
  const page = source.match(/\s+·\s+s\.\s*\d+\s*$/)?.[0] ?? "";
  const text = source.slice(0, source.length - page.length);
  return (reportLabels[text.trim().toLowerCase()] ?? knownSapTranslation(text) ?? text) + page;
}
