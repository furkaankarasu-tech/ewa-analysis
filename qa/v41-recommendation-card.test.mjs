import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collectSapRecommendations } from '../lib/report-insights.ts';
import { recommendationDisplay } from '../lib/recommendation-presentation.ts';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('aynı EWA bölümündeki recommendation paragrafları tek kartta birleşir', () => {
  const recommendations = collectSapRecommendations([{
    title: 'Activation Status and Validity of User SYSTEM',
    path: 'Security > SAP HANA Database S4P > Activation Status and Validity of User SYSTEM',
    number: '4.3',
    level: 3,
    rating: 'red',
    observations: [],
    recommendations: [
      'Recommendation: Review current usage of user SYSTEM and set up and test a user and role concept, so that the use of user SYSTEM becomes obsolete.',
      'Deactivate the user account with the SQL statement: ALTER USER SYSTEM DEACTIVATE USER NOW.',
      'Deactivate the user account with the SQL statement: ALTER USER SYSTEM DEACTIVATE USER NOW.',
    ],
    tables: [],
  }]);
  assert.equal(recommendations.length, 1);
  assert.match(recommendations[0].text, /Review current usage of user SYSTEM/);
  assert.match(recommendations[0].text, /ALTER USER SYSTEM DEACTIVATE USER NOW/);
  assert.equal((recommendations[0].text.match(/ALTER USER SYSTEM/g) ?? []).length, 1);
  const display = recommendationDisplay(recommendations[0].text);
  assert.equal(display.kind, 'summary');
  assert.match(display.turkish ?? '', /SYSTEM kullanıcısının/);
});

test('partitioning önerisi boş kart yerine teknik Türkçe özet üretir', () => {
  const display = recommendationDisplay('For tables approaching the record-count limit, assess application-compatible table partitioning or archiving with SAP Data Volume Management (DVM). Measure their growth rates separately. Review the non-partitioned tables before changing the layout.');
  assert.equal(display.kind, 'summary');
  assert.match(display.turkish ?? '', /\bpartitioning\b/i);
  assert.doesNotMatch(display.turkish ?? '', /bölümlen|partisyon/i);
});

test('tanınmayan uzun İngilizce öneri kartı gövdesinde önizleme bırakır', () => {
  const original = 'Investigate vendor-specific transaction XYZ and verify custom configuration before changing the system. '.repeat(8);
  const display = recommendationDisplay(original);
  assert.equal(display.kind, 'source');
  assert.equal(display.collapsedEnglish, true);
  assert.ok(display.sourcePreview);
  assert.match(display.sourcePreview ?? '', /Investigate vendor-specific transaction XYZ/);
  assert.ok((display.sourcePreview ?? '').length < original.length);
});

test('sayfa uzun kaynak önerilerde boş kart oluşturmaz', async () => {
  const page = await source('../app/page.tsx');
  assert.match(page, /view\.kind === "source" && view\.sourcePreview/);
  assert.match(page, /SAP önerisi · İngilizce kaynak/);
  assert.match(page, /Tam SAP önerisini İngilizce görüntüle/);
});
