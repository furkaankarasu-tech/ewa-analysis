import { polishRadarTurkish } from "./sap-terminology.ts";
import { knownSapTranslation, looksEnglish, type TranslatedFinding } from "./local-translation.ts";

export type CopyField = keyof TranslatedFinding;
export type BilingualCopy = { primary: string; english?: string; missingTurkish?: boolean };

/** Never invent an English 'SAP original' for Turkish text produced by Radar. */
export function findingCopy(original: string, translated: string | undefined, _findingId: string, _field: CopyField): BilingualCopy {
  const value = original.trim();
  const verified = translated?.trim() || knownSapTranslation(value);
  if ((verified && verified !== value) || looksEnglish(value)) {
    if (verified && verified !== value) return { primary: polishRadarTurkish(verified, _field), english: value };
    return { primary: value, missingTurkish: true };
  }
  return { primary: polishRadarTurkish(value, _field) };
}

export function recommendationCopy(original: string, translated?: string): BilingualCopy {
  const value = original.trim();
  const verified = translated?.trim() || knownSapTranslation(value);
  return verified && verified !== value
    ? { primary: verified, english: value }
    : { primary: value, missingTurkish: looksEnglish(value) };
}
