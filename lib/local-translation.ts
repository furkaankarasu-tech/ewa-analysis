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
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
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

// Keep EWA identifiers, measurements and common database terms verbatim.
// If the browser translator alters a placeholder, the entire chunk stays original.
const technicalTerm = /`[^`]+`|\b(?:[Pp]artitions?|[Pp]artitioning|[Tt]ablespaces?|[Rr]owstore|[Cc]olumnstore|[Hh]ashes?|[Kk]ernel)\b|\b[A-Z][A-Z0-9_./-]{2,}\b|\b[A-Z][a-z]+(?:[A-Z][a-z0-9]+)+\b|\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b|\b\d+(?:[.,]\d+)*\b/g;

function protectTechnicalText(text: string) {
  const terms: string[] = [];
  const masked = text.replace(technicalTerm, (term) => {
    const marker = `ZXQEWATERM${terms.length}QXZ`;
    terms.push(term);
    return marker;
  });
  return { masked, terms };
}

// Already Turkish or technical identifiers should stay exactly as written in the report.
export function looksEnglish(value: string): boolean {
  const text = value.trim();
  if (!text || /[çğıöşüÇĞİÖŞÜ]/.test(text)) return false;
  return /\b(?:the|your|you|this|these|those|of|to|from|with|due|has|have|having|will|should|must|please|consider|recommended|recommendation|risk|users|system|security|database|performance|release|maintenance|support|package|packages|client|authorization|authorized|information|chapter|outdated|settings|check|ensure|critical|number|table)\b/i.test(text);
}

export async function translateText(translator: LocalTranslator, original: string): Promise<string> {
  const translated: string[] = [];
  for (const chunk of chunksOf(original)) {
    const { masked, terms } = protectTechnicalText(chunk);
    let result = (await translator.translate(masked)).trim();
    if (!result) throw new Error("Boş çeviri");
    for (const [index, term] of terms.entries()) {
      const marker = `ZXQEWATERM${index}QXZ`;
      if (result.split(marker).length !== 2) { result = chunk; break; }
      result = result.replace(marker, term);
    }
    translated.push(result);
  }
  return translated.join(" ").replace(/\u00e2/g, "a").replace(/\u00c2/g, "A");
}
