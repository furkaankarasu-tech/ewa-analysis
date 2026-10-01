import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyTranslations, looksEnglish, translateText } from '../lib/local-translation.ts';

const original = 'The number of partitions is 120 in SAP HANA.';
const simpleTurkish = {
  async translate(text) {
    return text.replace('The ', '').replace(' is ', ' ').replace(' in ', ' ortamında: ');
  },
};

test('SAP partition terminology and identifiers survive the on-device translation', async () => {
  const translated = await translateText(simpleTurkish, original);
  assert.match(translated, /partition \(veri bölümü\) sayısı/);
  assert.match(translated, /\b120\b/);
  assert.match(translated, /SAP HANA/);
  assert.doesNotMatch(translated, /paritiyons/i);
  assert.equal(looksEnglish('ABAP dump yoğunluğu'), false);
  assert.equal(looksEnglish(original), true);
});

test('SAP profiles, Note references and plural partitions are preserved', async () => {
  const source = 'Set login/min_password_lng to 8 and see SAP Note 821875 for partitions.';
  const translated = await translateText({ async translate(text) {
    return text.replace('Set ', 'Ayarlayın: ').replace(' and see ', ' ve inceleyin: ').replace(' for ', ' için ');
  } }, source);
  assert.match(translated, /login\/min_password_lng/);
  assert.match(translated, /SAP Note 821875/);
  assert.match(translated, /partition'lar \(veri bölümleri\)/);
  assert.match(translated, /\b8\b/);
});

test('lost placeholders, altered values and untranslated output revert to untouched source', async () => {
  const garbled = { async translate(text) { return text.replace(/ZXQEWATERM\d+QXZ/g, 'paritiyons'); } };
  const inventedNumber = { async translate(text) { return `${text} 999`; } };
  const echo = { async translate(text) { return text; } };
  assert.equal(await translateText(garbled, original), original);
  assert.equal(await translateText(inventedNumber, original), original);
  assert.equal(await translateText(echo, original), original);
});

test('two-language result structure and English source remain in the UI code', async () => {
  const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.deepEqual(Object.keys(emptyTranslations()), ['findings', 'recommendations', 'recommendationSources']);
  assert.match(page, /className="bilingual-turkish" lang="tr"/);
  assert.match(page, /className="bilingual-english" lang="en"/);
  assert.match(page, /<p>\{item\.text\}<\/p>/);
  assert.match(page, /if \(report\) void translateReport\(report\)/);
});
