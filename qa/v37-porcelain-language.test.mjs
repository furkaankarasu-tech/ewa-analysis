import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { knownSapTranslation, passesTechnicalReview, translateText } from '../lib/local-translation.ts';
import { findingCopy } from '../lib/finding-copy.ts';
const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/modern-theme.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');

test('visual workspace loads one modern theme while using the vector radar hero',()=>{
  assert.match(layout,/modern-theme\.css/);
  assert.doesNotMatch(layout,/porcelain-theme\.css|architect-theme\.css|noir-theme\.css/);
  const modern=readFileSync(new URL('../app/modern-theme.css',import.meta.url),'utf8');
  assert.match(modern,/report-grid\.svg/);
  assert.match(modern,/\.modern-shell \.main-column/);
  assert.match(modern,/\.modern-shell \.signal-card/);
  assert.match(modern,/\.modern-shell \.translation-hub/);
});
test('unknown English is labeled as source, not pretended to be Turkish',()=>{
  const result=findingCopy('Investigate special vendor-specific RFC queue state.',undefined,'v','evidence');
  assert.equal(result.primary,'Investigate special vendor-specific RFC queue state.');
  assert.equal(result.missingTurkish,true);
  assert.match(page, /source-language-badge/);
});
test('source-first translation starts only after the user asks for it',()=>{
  assert.match(page, /const \[showTranslation, setShowTranslation\] = useState\(false\)/);
  assert.match(page, /onClick=\{toggleTranslation\}/);
  assert.doesNotMatch(page, /useEffect\(\(\) => \{\s*if \(report\)/);
  assert.match(page, /translationCoverage\.unresolved/);
});
test('original source is retained, and no external model is requested',()=>{
  assert.doesNotMatch(page, /createModelTranslator|fetch\(|localStorage\.setItem/);
  assert.match(page, /<p lang="en">\{view\.english\}<\/p>/);
});
test('technical QA rejects the user-reported malformed security-maintenance translation',()=>{
  const en='The Support Package level of your system has run out of security maintenance. For more information, see chapter Security.';
  assert.match(knownSapTranslation(en), /güvenlik bakım süresi/);
  assert.equal(passesTechnicalReview(en,'Sisteminizin destek paketi düzeyi güvenlik bakımı bitti.'),false);
});
test('fake unsuccessful translator safely returns exact original SAP text',async()=>{
  const src='Check SAP Note 1234567 and login/min_password_lng in all clients.';
  const result=await translateText({translate:async()=> 'Kontrol edin.'},src);
  assert.equal(result,src);
});
test('model setup is explicitly attached to the translation action',()=>{
  const action=page.slice(page.indexOf('async function translateReport('),page.indexOf('function toggleTranslation('));
  assert.match(action,/prepareDeviceTranslator/);
  assert.match(page,/İlk Türkçe kullanımında cihazınıza dil paketi indirilebilir/);
  const startup=page.slice(page.indexOf('useEffect('),page.indexOf('function cancelTranslation('));
  assert.doesNotMatch(startup,/prepareDeviceTranslator/);
});
