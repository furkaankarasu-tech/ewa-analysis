export type LocalTranslator = {
  translate(text: string): Promise<string>;
};

export type TranslatedFinding = Partial<Record<"title" | "evidence" | "impact" | "cause" | "action", string>>;
export type TranslationBundle = {
  findings: Record<number, TranslatedFinding>;
  recommendations: Record<number, string>;
  recommendationSources: Record<number, string>;
};

export const emptyTranslations = (): TranslationBundle => ({ findings: {}, recommendations: {}, recommendationSources: {} });

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

// Source-aware glossary: a DB partition is never a political/administrative "division".
// Keep the English SAP term recognizable, with a short Turkish explanation when useful.
const technicalGlossary: Record<string, string> = {
  "number of partitions": "partition (veri bölümü) sayısı",
  "table partitioning": "tablo partitioning (bölümleme)",
  partitioning: "partitioning (veri bölümleme)",
  partitions: "partition'lar (veri bölümleri)",
  partition: "partition (veri bölümü)",
  tablespaces: "tablespace alanları",
  tablespace: "tablespace (veritabanı depolama alanı)",
  rowstore: "rowstore (satır bazlı depolama)",
  columnstore: "columnstore (sütun bazlı depolama)",
};

// Match longer phrases before individual words and protect whole SAP product names,
// technical parameter paths, transaction codes, numeric values and SQL identifiers.
const glossaryPattern = /\b(?:[Nn]umber of [Pp]artitions|[Tt]able [Pp]artitioning|[Pp]artitioning|[Pp]artitions?|[Tt]ablespaces?|[Rr]owstore|[Cc]olumnstore)\b|\bSAP (?:HANA|Fiori Front-End Server|NetWeaver|Note\s+\d+|Maintenance Planner)\b|`[^`]+`|\b(?:[a-z][a-z0-9_.-]*\/[a-z][a-z0-9_.\/-]*|[A-Z][A-Z0-9_./-]{2,}|[A-Z][a-z]+(?:[A-Z][a-z0-9]+)+|[a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b|\b\d+(?:[.,]\d+)*%?/g;
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
  return /\b(?:the|your|you|this|these|those|of|to|from|with|due|has|have|having|will|should|must|please|consider|recommended|recommendation|risk|users|system|security|database|performance|release|maintenance|support|package|packages|client|authorization|authorized|information|chapter|outdated|settings|check|ensure|critical|number|table|import|errors?|transport|sequence|auditing|status|statisticsserver|monitoring|statements?|partitions?|partitioning)\b/i.test(text);
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
