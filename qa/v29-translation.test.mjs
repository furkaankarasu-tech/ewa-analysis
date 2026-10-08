import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { knownSapTranslation, passesTechnicalReview, translateText } from '../lib/local-translation.ts';
import { recommendationDisplay, groundedRecommendationSummary } from '../lib/recommendation-presentation.ts';
import { findingCopy } from '../lib/finding-copy.ts';
import { polishRadarTurkish } from '../lib/sap-terminology.ts';
const ts = createRequire(import.meta.url)('typescript');
const source = path => readFile(new URL(path, import.meta.url), 'utf8');

const maintenance = 'The Support Package level of your system has run out of security maintenance. For more information, see chapter Security.';

test('SAP security maintenance means security-maintenance window, not product support', () => {
  const tr = knownSapTranslation(maintenance);
  assert.match(tr, /Support Package seviyesi için SAP'nin güvenlik bakım süresi/);
  assert.doesNotMatch(tr, /güvenlik desteği|destek paketi düzeyi/);
  const card = findingCopy(maintenance, undefined, 'security-support-packages', 'evidence');
  assert.equal(card.english, maintenance);
  assert.equal(card.primary, tr);
});

test('general technical quality guard blocks the user-reported broken translation', () => {
  assert.equal(passesTechnicalReview(maintenance, 'Sisteminizin destek paketi düzeyi güvenlik bakımı bitti.'), false);
  assert.equal(passesTechnicalReview(maintenance, 'Sisteminizin Support Package seviyesi güvenlik desteği almıyor.'), false);
  assert.equal(passesTechnicalReview(maintenance, "Support Package seviyesi için SAP'nin güvenlik bakım süresi dolmuş."), true);
});

test('all screens use natural Radar text, keep the original v20 palette, no artificial English pseudo-source', async () => {
  const parser = await source('../lib/ewa.ts');
  const page = await source('../app/page.tsx');
  const theme = await source('../app/globals.css');
  assert.match(parser, /Güncel olmayan Support Package seviyesi nedeniyle güvenlik riski/);
  assert.match(parser, /Partitioning uygulanmamış büyük tablolar/);
  assert.match(parser, /Java bellek temizleme \(GC\) süresi/);
  assert.doesNotMatch(page, /hasUntranslated|Çeviri henüz hazır değil/);
  assert.match(page, /kind === "summary"/);
  assert.match(page, /SAP önerisinin tam İngilizce metni/);
  assert.match(page, /setShowTranslation\(false\)/);
  assert.equal(ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length, 0);
  assert.match(theme, /recommendation-list/);
  assert.equal(polishRadarTurkish('Partisyonsuz büyük tablolar','title'),'Partitioning uygulanmamış büyük tablolar');
});

test('every covered SAP topic has a concise, source-grounded Turkish reading aid', () => {
  const samples = [
    ['RTCCTOOL: check ST-A/PI, ST-PI and apply SAP Note 1985402 after checking packages.', /RTCCTOOL/],
    ['Immediate action is recommended. Enable TLS for system replication communication.', /TLS/],
    ['Review current usage of user SYSTEM and set up and test a user and role concept.', /SYSTEM/],
    ['Your Support Package level is outdated. Update the security maintenance fixes.', /Support Package/],
    ['We recommend urgently to upgrade your main product version.', /yükseltilmesini/],
    ['Use Fiori Maintenance Planner to check dependencies and target version.', /Fiori/],
    ['Secure message server using ms/acl_info access control list.', /Message Server/],
    ['Check default passwords using RSUSR003 in all standard users.', /RSUSR003/],
    ['Reduce high memory consumption of the index server.', /Indexserver/],
    ['Review failed log backup logs and investigate the cause.', /yedekleme/],
    ['Find expensive SQL queries and review execution plan.', /SQL/],
  ];
  for (const [en, expected] of samples) {
    const tr = groundedRecommendationSummary(en);
    assert.match(tr ?? '', expected, en);
    assert.equal(recommendationDisplay(en).english, en);
  }
  assert.equal(groundedRecommendationSummary('Run CUSTOM_Z_EXAMPLE_9999'), null);
});

test('short verified Turkish first and full English accessible; long unknown source stays collapsible', () => {
  const upgrade = 'We recommend urgently to upgrade your main product version. For more details see SAP Support Portal - Maintenance.';
  const show = recommendationDisplay(upgrade);
  assert.equal(show.kind, 'translation');
  assert.match(show.turkish, /SAP/);
  assert.equal(show.english, upgrade);
  const unknown = recommendationDisplay('Investigate a vendor-specific setting.'.repeat(26));
  assert.equal(unknown.kind, 'source');
  assert.equal(unknown.collapsedEnglish, true);
});

test('bad translator output is never described as verified Turkish', async () => {
  const en = 'Check the system configuration and apply the necessary corrections.';
  const result = await translateText({ translate: async () => 'Check system and apply corrections.' }, en);
  assert.equal(result, en);
});

test('translation modules parse and source is visible before an explicit click', async () => {
  for (const path of ['../lib/recommendation-presentation.ts','../lib/local-translation.ts']) {
    const data = await source(path);
    const ast = ts.createSourceFile(path, data, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    assert.equal(ast.parseDiagnostics.length, 0, path);
  }
  const page = await source('../app/page.tsx');
  assert.match(page, /useState\(false\);\s*const \[translationReady/);
  assert.match(page, /onClick=\{toggleTranslation\}/);
  assert.doesNotMatch(page, /createModelTranslator|localStorage\.setItem/);
});
