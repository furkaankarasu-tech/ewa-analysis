import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { knownSapTranslation, translateText } from "../lib/local-translation.ts";
import { findingCopy, recommendationCopy } from "../lib/finding-copy.ts";

const source = async path => readFile(new URL(path, import.meta.url), "utf8");

test("Büyük tablolar anlaşılır Türkçeyle anlatılır", async () => {
  const ewa = await source("../lib/ewa.ts");
  assert.match(ewa, /title: "Bölümlere ayrılmamış büyük tablolar"/);
  assert.match(ewa, /tabloyu bölümlere ayırmayı \(partitioning\)/);
  for (const code of [ewa, await source("../lib/local-translation.ts")])
    assert.doesNotMatch(code, /partisyonlanmamış|partisyonsuz|tablo partisyonlama/i);
  assert.equal(knownSapTranslation("Largest Non-partitioned Column Tables (Records)"),
    "Bölümlere ayrılmamış en büyük sütun tabloları (kayıt sayısına göre)");
  assert.equal(knownSapTranslation("Large non-partitioned tables"), "Bölümlere ayrılmamış büyük tablolar");
});

test("Makine çevirisi bölümleme terimlerini korurken anlamı açıklıyor", async () => {
  const original = "The number of partitions is 120 in SAP HANA.";
  const translator = { async translate(text) { return text.replace("The", "Belirlenen").replace("is", "olarak ölçüldü"); } };
  const output = await translateText(translator, original);
  assert.match(output, /veri bölümü sayısı/);
  assert.match(output, /120/);
  assert.match(output, /SAP HANA/);
  const broken = { async translate(text) { return text.replace(/ZXQEWATERM\d+QXZ/g, "????"); } };
  assert.equal(await translateText(broken, original), original);
});

test("Yalnızca gerçek SAP İngilizcesi ikinci dil olarak gösterilir", async () => {
  const generated = findingCopy("Bölümlere ayrılmamış büyük tablolar", undefined, "large-tables", "title");
  assert.equal(generated.english, undefined);
  const original = "Memory Consumption of Indexserver";
  const actual = findingCopy(original, undefined, "indexserver", "title");
  assert.equal(actual.primary, "Indexserver bellek tüketimi");
  assert.equal(actual.english, original);
  const rec = "Assign a minimum value of 8 to the profile parameter login/min_password_lng.";
  assert.equal(recommendationCopy(rec).english, rec);
  const page = await source("../app/page.tsx");
  assert.doesNotMatch(page, /englishSummary|İngilizce analiz özeti|generatedAnalysisEnglish/);
  assert.match(page, /className="translation-original-action"/);
  assert.match(page, /className="recommendation-english"/);
});

test("v20 ana stil dosyası değişmedi; çeviri stilleri ayrı tutuldu", async () => {
  const css = await source("../app/globals.css");
  assert.equal(createHash("sha256").update(css).digest("hex"), "df552e88858be2ef148bda74c5650ac7fce6bccbd0593517a407b0a837628297");
  const bilingual = await source("../app/bilingual.css");
  assert.doesNotMatch(bilingual, /english-summary/);
});
