import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyTranslations } from '../lib/local-translation.ts';

test('all export defaults use the complete translation bundle', async () => {
  const defaults = emptyTranslations();
  assert.deepEqual(Object.keys(defaults), ['findings', 'recommendations', 'recommendationSources']);
  const [ewa, excel] = await Promise.all([
    readFile(new URL('../lib/ewa.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/excel-export.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(ewa, /toMarkdown\(report: EwaReport, translations: TranslationBundle = emptyTranslations\(\)\)/);
  assert.match(ewa, /toEmail\(report: EwaReport, options: \{ evidence: boolean; caveats: boolean \}, translations: TranslationBundle = emptyTranslations\(\)\)/);
  assert.match(excel, /createActionWorkbook\(report: EwaReport, translations: TranslationBundle = emptyTranslations\(\)/);
  assert.equal((ewa + excel).match(/translations: TranslationBundle = emptyTranslations\(\)/g)?.length, 3);
});
