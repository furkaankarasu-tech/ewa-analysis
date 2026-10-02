import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { findingCopy, recommendationCopy } from "../lib/finding-copy.ts";
import { knownSapTranslation } from "../lib/local-translation.ts";

const file = async (path) => readFile(new URL(path, import.meta.url), "utf8");
const cssV20Hash = "df552e88858be2ef148bda74c5650ac7fce6bccbd0593517a407b0a837628297";
const cssV20Bytes = 28455;

test("Türkçe üretim bulgusu tek sefer gösterilir; uydurulmuş İngilizce özet üretilmez", () => {
  const title = findingCopy("HANA bellek baskısı", undefined, "hana-memory", "title");
  const metric = findingCopy("Instance 3.962 / 4.450 GB (%89); tablolar 3.480 GB.", undefined, "hana-memory", "evidence");
  const action = findingCopy("HANA Cockpit üzerinden yüklü tabloları ve heap tüketimini inceleyin.", undefined, "hana-memory", "action");
  assert.deepEqual(title, {primary:"HANA bellek baskısı"});
  assert.equal(metric.english, undefined, "numeric measurements are never duplicated as a generated English paraphrase");
  assert.equal(action.english, undefined);
  assert.equal(title.english, undefined);
});

test("Bölümlere ayrılmamış büyük tablolar başlığında uydurulmuş İngilizce yok", () => {
  const line = findingCopy("Bölümlere ayrılmamış büyük tablolar", undefined, "large-tables", "title");
  assert.equal(line.primary, "Bölümlere ayrılmamış büyük tablolar");
  assert.equal(line.english, undefined);
});

test("İngilizce SAP bulgusunun doğrulanmış Türkçesi üstte ve gerçek İngilizcesi altta kalır", () => {
  const value = "Memory Consumption of Indexserver";
  const copy = findingCopy(value, undefined, "section-memory", "title");
  assert.equal(copy.primary, "Indexserver bellek tüketimi");
  assert.equal(copy.english, value);
  const action = "Analyze the reason for high memory consumption of the index server. Either reduce the memory consumption or revise the sizing of the SAP HANA database.";
  assert.equal(findingCopy(action, undefined, "section-memory", "action").english, action);
});

test("SAP önerisi Türkçe + gerçek İngilizce gösterilir; desteklenmeyen metin uydurulmaz", () => {
  const original = "Assign a minimum value of 8 to the profile parameter login/min_password_lng.";
  const translated = recommendationCopy(original);
  assert.match(translated.primary, /login\/min_password_lng/);
  assert.equal(translated.english, original);
  assert.equal(knownSapTranslation("Some unknown SAP-specific content with parameter 123."), null);
});

test("Eski CSS gövdesi, iki sütunlu öneriler ve kartların renkleri korunur", async () => {
  const css = await file("../app/globals.css");
  assert.equal(createHash("sha256").update(css.slice(0, cssV20Bytes)).digest("hex"), cssV20Hash);
  assert.match(css, /\.recommendation-list \{ list-style:none;[^\n]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.finding-card \{ background:#fff;/);
  const bilingualCss = await file("../app/bilingual.css");
  assert.doesNotMatch(bilingualCss, /\.english-summary \{/);
});

test("Kart JSX'inde yapışık EN etiketleri ve tekrar eden ölçüm çıktısı yok", async () => {
  const page = await file("../app/page.tsx");
  assert.doesNotMatch(page, /englishLabel|EN · Analiz açıklaması|translatedFields/);
  assert.doesNotMatch(page, /english-summary|generatedAnalysisEnglish|İngilizce analiz özeti/);
  assert.match(page, /className="translation-original-action"/);
  assert.match(page, /className="recommendation-english"/);
  assert.doesNotMatch(page, /className="finding-source-statement"/);
});


test("v25 veri kalite paneli CSS beklemeden kart, grid ve uyarıları korur", async () => {
  const page = await file("../app/page.tsx");
  assert.match(page, /data-style-revision="v25"/);
  assert.match(page, /style=\{qualityUI\.checks\}/);
  assert.match(page, /style=\{qualityUI\.issues\}/);
  assert.match(page, /style=\{qualityUI\.notes\}/);
  const layout = await file("../app/layout.tsx");
  assert.match(layout, /import "\.\/globals\.css"/);
  assert.match(layout, /import "\.\/bilingual\.css"/);
});
