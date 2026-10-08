import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { recommendationDisplay, groundedRecommendationSummary } from '../lib/recommendation-presentation.ts';
import { translateText } from '../lib/local-translation.ts';
import { sapSourceLabel } from '../lib/sap-terminology.ts';

const longUpgrade = 'Addon ST-A/PI 01X_731 "Servicetools for Applications Plug-In" is outdated. Check RTCCTOOL, apply SAP note 1985402 and SAP Note 3261488. Current ST-PI SP level is too low. ' + 'Update ST-A/PI and ST-PI. '.repeat(40);
const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('uzun İngilizce SAP önerisi kartı doldurmak yerine açılır kalır', () => {
  const copy = recommendationDisplay(longUpgrade);
  assert.equal(copy.kind, 'summary');
  assert.match(copy.turkish, /RTCCTOOL/);
  assert.equal(copy.english, longUpgrade.trim());
  assert.equal(copy.collapsedEnglish, true);
});

test('bilinmeyen kısa ve uzun içerikler Türkçeye çevrilmiş gibi gösterilmez', () => {
  const short = recommendationDisplay('An undocumented vendor-specific instruction.');
  assert.equal(short.kind, 'source');
  assert.equal(short.turkish, undefined);
  assert.equal(short.collapsedEnglish, false);
  const long = recommendationDisplay('Check vendor-specific transaction XYZ and run custom job. '.repeat(20));
  assert.equal(long.turkish, undefined);
  assert.equal(long.collapsedEnglish, true);
});

test('doğrulanmış Türkçe önde, SAP İngilizcesi arkada ve kaynak aynen kalır', () => {
  const original = 'Assign a minimum value of 8 to the profile parameter login/min_password_lng.';
  const copy = recommendationDisplay(original);
  assert.equal(copy.kind, 'translation');
  assert.match(copy.turkish, /login\/min_password_lng/);
  assert.equal(copy.english, original);
});

test('yazılım yükseltme önerisi doğrulanmış Türkçe ve İngilizceyle gösterilir', () => {
  const source = 'We recommend urgently to upgrade your main product version. For more details see SAP Support Portal - Maintenance.';
  const view = recommendationDisplay(source);
  assert.equal(view.kind, 'translation');
  assert.match(view.turkish, /acilen yükseltilmesini/);
  assert.equal(view.english, source);
});

test('özet yalnızca kaynak açıkça gereken teknik kavramları içeriyorsa üretilir', () => {
  assert.equal(groundedRecommendationSummary('RTCCTOOL and ST-PI updated.'), null);
  const user = groundedRecommendationSummary('Review current usage of user SYSTEM and set up and test a user and role concept, so that the use of user SYSTEM becomes obsolete.');
  assert.match(user, /SYSTEM kullanıcısı/);
});

test('tarayıcının İngilizce geri döndürmesi yanlış Türkçe kabul edilmez', async () => {
  const original = 'The memory consumption is very high for this system.';
  const translated = await translateText({ translate: async () => 'Memory consumption is excessive for this system.' }, original);
  assert.equal(translated, original);
});

test('v28 eskisini değiştirmeden uzun kartları açılır yapar; yanlış etiketler yoktur', async () => {
  const page = await source('../app/page.tsx');
  assert.doesNotMatch(page, /Çeviri henüz hazır değil|Türkçe çeviri doğrulanamadı; SAP önerisinin/);
  assert.match(page, /className="recommendation-original"/);
  assert.match(page, /kind === "summary"/);
  assert.equal(createHash('sha256').update(await source('../app/globals.css')).digest('hex'), 'df552e88858be2ef148bda74c5650ac7fce6bccbd0593517a407b0a837628297');
});

test('resimdeki uzun SAP kaynak yolu SID bilgisi uydurulmadan sadeleşir', () => {
  const source = 'Service Data Quality and Service Readiness > Service Preparation of QZX > Service Preparation Check (RTCCTOOL)';
  const target = sapSourceLabel(source);
  assert.match(target, /Servis verilerinin kalitesi/);
  assert.match(target, /QZX sistemi servis hazırlığı/);
  assert.match(target, /RTCCTOOL/);
});
