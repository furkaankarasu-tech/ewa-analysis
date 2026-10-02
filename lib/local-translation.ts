import { translatedSapHeading, translatedSapStatement } from "./sap-terminology.ts";
export type LocalTranslator = {
  translate(text: string): Promise<string>;
};

export type TranslatedFinding = Partial<Record<"title" | "evidence" | "impact" | "cause" | "action", string>>;
export type TranslationBundle = {
  findings: Record<number, TranslatedFinding>;
  recommendations: Record<number, string>;
};

export const emptyTranslations = (): TranslationBundle => ({ findings: {}, recommendations: {} });

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
  return (window as Window & { Translator?: TranslatorFactory }).Translator ?? null;
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
  "number of partitions": "veri bölümü sayısı",
  "table partitioning": "tabloları bölümlere ayırma (partitioning)",
  "non-partitioned": "bölümlere ayrılmamış",
  partitioning: "bölümlendirme (partitioning)",
  partitions: "veri bölümleri (partitions)",
  partition: "veri bölümü (partition)",
  tablespaces: "tablespace alanları",
  tablespace: "tablespace",
  rowstore: "rowstore",
  columnstore: "columnstore",
};

// Match longer phrases before individual words and protect whole SAP product names,
// technical parameter paths, transaction codes, numeric values and SQL identifiers.
const glossaryPattern = /\b(?:[Nn]umber of [Pp]artitions|[Tt]able [Pp]artitioning|[Nn]on-[Pp]artitioned|[Pp]artitioning|[Pp]artitions?|[Tt]ablespaces?|[Rr]owstore|[Cc]olumnstore)\b|\bSAP (?:HANA|Fiori Front-End Server|NetWeaver|Note\s+\d+|Maintenance Planner)\b|`[^`]+`|\b(?:[a-z][a-z0-9_.-]*\/[a-z][a-z0-9_.\/-]*|[A-Z][A-Z0-9_./-]{2,}|[A-Z][a-z]+(?:[A-Z][a-z0-9]+)+|[a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b|\b\d+(?:[.,]\d+)*%?/g;
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
  return /\b(?:the|your|you|this|these|those|of|to|from|with|due|has|have|having|will|should|must|please|consider|recommended|recommendation|risk|users|system|security|database|performance|release|maintenance|support|package|packages|client|authorization|authorized|information|chapter|outdated|settings|check|ensure|critical|number|table|import|default|passwords?|gateway|backup|memory|consumption|utilization|configuration|logs?|failed|missing|errors?|transport|sequence|auditing|status|statisticsserver|monitoring|statements?|partitions?|partitioning)\b/i.test(text);
}

// No remote translation service. Reject lost markers or modified numeric measurements;
// showing the English SAP original is safer than a misleading technical translation.
export async function translateText(translator: LocalTranslator, original: string): Promise<string> {
  const translated: string[] = [];
  for (const chunk of chunksOf(original)) {
    const { masked, terms } = protectTechnicalText(chunk);
    let result = (await translator.translate(masked)).trim();
    if (!result) throw new Error("Boş çeviri");
    const incoming = (masked.replace(tokenPattern, "").match(numericPattern) ?? []).sort();
    const outgoing = (result.replace(tokenPattern, "").match(numericPattern) ?? []).sort();
    const englishSource = masked.replace(tokenPattern, "").replace(/\s+/g, " ").trim().toLowerCase();
    const englishResult = result.replace(tokenPattern, "").replace(/\s+/g, " ").trim().toLowerCase();
    if (incoming.join("|") !== outgoing.join("|") || (englishSource && englishSource === englishResult)) {
      translated.push(chunk);
      continue;
    }
    let damaged = false;
    for (const [index, term] of terms.entries()) {
      const marker = `ZXQEWATERM${index}QXZ`;
      if (result.split(marker).length !== 2) { damaged = true; break; }
      result = result.replace(marker, term);
    }
    if (damaged || /ZXQEWATERM\d+QXZ/.test(result)) translated.push(chunk);
    else translated.push(result);
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
  const normalized = source.trim().replace(/\s+/g, " ").replace(/^Recommendation\s*:\s*/i, "");
  const normalizedKey = normalized.toLocaleLowerCase("en-US").replace(/[.\s]+$/, "");
  const glossary: Record<string, string> = {
    "Memory Consumption of Indexserver": "Indexserver bellek tüketimi",
    "The memory usage of the index server was very close to its effective allocation limit.":
      "Indexserver bellek kullanımı, etkin bellek tahsis sınırına çok yaklaşmış.",
    "Analyze the reason for high memory consumption of the index server. Either reduce the memory consumption or revise the sizing of the SAP HANA database.":
      "Indexserver'ın yüksek bellek tüketiminin nedenini analiz edin. Bellek tüketimini azaltın veya SAP HANA veritabanının kaynak boyutlandırmasını yeniden değerlendirin.",
    "Largest Non-partitioned Column Tables (Records)": "Bölümlere ayrılmamış en büyük sütun tabloları (kayıt sayısına göre)",
    "Large non-partitioned tables": "Bölümlere ayrılmamış büyük tablolar",
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
    return verifiedTemplate(normalized, "Varsayılan parolaları hâlâ kullanan standart hesapları istemciler genelinde kontrol etmek için RSUSR003 raporunu çalıştırın. SAPCPIC kullanıcısının tüm istemcilerde varsayılan olmayan parola kullandığını doğrulayın. İhtiyaç duyulmayan ve EARLYWATCH tarafından kullanılan 066 istemcisini değerlendirin; kaldırma yöntemi SAP Note 1749142'de açıklanır. TMSADM kullanıcısının yalnızca 000 istemcisinde bulunduğunu ve varsayılan parolasının değiştirildiğini kontrol edin. Taşıma etki alanındaki TMSADM parola değişikliği için SAP Note 1414256'ya bakın.");
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
  return null;
}
