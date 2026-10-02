import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyTranslations, knownSapTranslation, translateText } from '../lib/local-translation.ts';

const source = 'The number of partitions is 120 in SAP HANA.';
test('two-field TranslationBundle survives the v21 TypeScript regression', () => {
  assert.deepEqual(emptyTranslations(), { findings: {}, recommendations: {} });
});
test('known indexserver message and recommendation translate without changing SAP terminology', () => {
  assert.equal(knownSapTranslation('Memory Consumption of Indexserver'), 'Indexserver bellek tüketimi');
  assert.match(knownSapTranslation('Analyze the reason for high memory consumption of the index server. Either reduce the memory consumption or revise the sizing of the SAP HANA database.'), /SAP HANA/);
  assert.equal(knownSapTranslation('An unknown SAP message which may change.'), null);
  assert.equal(knownSapTranslation('Assign a minimum value of 12 to the profile parameter login/min_password_lng.'), 'login/min_password_lng profil parametresini en az 12 olarak ayarlayın.');
});
test('technical terms localized; altered values or lost placeholders revert to original', async () => {
  const translated = await translateText({ async translate(s) { return s.replace(' is ', ' olarak ölçüldü '); } }, source);
  assert.match(translated, /partisyon sayısı/);
  assert.match(translated, /120/);
  assert.match(translated, /SAP HANA/);
  assert.equal(await translateText({ async translate(s) { return s + ' 999'; } }, source), source);
  assert.equal(await translateText({ async translate(s) { return s.replace(/ZXQEWATERM\d+QXZ/g, 'bozuldu'); } }, source), source);
});
test('v20 grid and colors kept; compact English sits under Turkish in existing cards', async () => {
  const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.recommendation-list \{ list-style:none;[^\n]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(page, /className="recommendation-turkish" lang="tr"/);
  assert.match(page, /className="recommendation-english" lang="en"/);
  assert.match(page, /className="translation-original-action" lang="en"/);
  assert.doesNotMatch(page, /recommendationSources|bilingual-recommendation|English · Original SAP recommendation/);
  assert.ok(css.indexOf('/* v22: compact bilingual') > 20000);
});

test('obsolete bilingual block does not reference an undeclared translatedFields variable', async () => {
  const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /\btranslatedFields\b/);
  assert.doesNotMatch(page, /className="original-copy"/);
  // Original English is shown only below its Turkish counterpart in the existing cards.
  assert.match(page, /translation\?\.action && translation\.action !== finding\.action && <p className="translation-original-action" lang="en">\{finding\.action\}<\/p>/);
  assert.match(page, /<p className="recommendation-english" lang="en"><span>EN<\/span>\{item\.text\}<\/p>/);
});
