import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { findingCopy, recommendationCopy } from "../lib/finding-copy.ts";
import { knownSapTranslation, translateText } from "../lib/local-translation.ts";

const ORIGINAL_STYLE_LENGTH = 29379;
const ORIGINAL_STYLE_SHA256 = "36f2a3c43c677fad9e6caa0346f387f4c14e5235766786ab84c795fbccb351fb";
const file = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Indexserver heading, evidence and SAP instruction display Turkish immediately and original English below", () => {
  for (const [field, original] of [
    ["title", "Memory Consumption of Indexserver"],
    ["evidence", "The memory usage of the index server was very close to its effective allocation limit."],
    ["action", "Analyze the reason for high memory consumption of the index server. Either reduce the memory consumption or revise the sizing of the SAP HANA database."],
  ]) {
    const copy = findingCopy(original, undefined, "section-memory", field);
    assert.notEqual(copy.primary, original);
    assert.equal(copy.english, original);
    assert.equal(copy.englishLabel, "EN · SAP raporu");
  }
});

test("Generated Turkish analysis remains distinct from the source: correct technical terms with accurately labeled English explanations", () => {
  const title = findingCopy("Partisyonlanmamış büyük tablolar", undefined, "large-tables", "title");
  assert.equal(title.english, "Large non-partitioned tables");
  assert.equal(title.englishLabel, "EN · Analiz açıklaması");
  const action = findingCopy("Kayıt sınırına yaklaşan tablolar için uygulamayla uyumlu tablo partisyonlama veya SAP Veri Hacmi Yönetimi (DVM) kapsamında arşivleme seçeneklerini değerlendirin. Tabloların büyüme hızını ayrıca ölçün.", undefined, "large-tables", "action");
  assert.match(action.primary, /tablo partisyonlama veya SAP Veri Hacmi Yönetimi \(DVM\) kapsamında arşivleme/);
  assert.match(action.english, /archiving/);
  assert.equal(action.englishLabel, "EN · Analiz açıklaması");
  const measure = findingCopy("ADR 1.642.823.987 kayıt; %0,55/hafta.", undefined, "large-tables", "evidence");
  assert.equal(measure.english, "ADR 1.642.823.987 records; %0,55/week.");
  assert.equal(measure.englishLabel, "EN · Analiz açıklaması");
});

test("Untranslated English is flagged instead of being presented as Turkish", () => {
  const original = "Memory was insufficient for the unknown new component.";
  assert.deepEqual(recommendationCopy(original), {primary:original, missingTurkish:true});
  assert.deepEqual(findingCopy(original, undefined, "section-unknown", "evidence"), {primary:original,missingTurkish:true});
});

test("SAP notes, exact parameters and sample password values are retained in reviewed local translations", () => {
  const min = recommendationCopy("Assign a minimum value of 8 to the profile parameter login/min_password_lng.");
  assert.match(min.primary, /login\/min_password_lng.*8/);
  assert.ok(min.english);
  const secure = knownSapTranslation("System-internal communication should be protected by setting profile parameter system/secure_communication to ON. If this is not the case, at least profile parameter ms/acl_info should be set. For more information, see SAP Note 821875.");
  assert.match(secure, /system\/secure_communication/);
  assert.match(secure, /ms\/acl_info/);
  assert.match(secure, /821875/);
  assert.equal(knownSapTranslation("System-internal communication should be protected by setting profile parameter system/secure_communication to ON. If this is not the case, at least profile parameter ms/acl_info should be set. For more information, see SAP Note 821875 and custom Note 123456."), null, "unknown extra technical facts must not silently disappear");
  const gateway = recommendationCopy("Monitor the error logs periodically for errors and take administrative action to resolve these errors.");
  assert.match(gateway.primary, /Gateway hata günlüklerini/);
});

test("On-device translation rejects modified measurement values and missing protected identifiers", async () => {
  const original = "The number of partitions is 120 in SAP HANA.";
  const result = await translateText({translate: async text => text.replace(" is ", " olarak ölçüldü ")}, original);
  assert.match(result, /partisyon sayısı/);
  assert.match(result, /120/);
  assert.equal(await translateText({translate: async text => text + " 999"}, original), original);
  assert.equal(await translateText({translate: async text => text.replace(/ZXQEWATERM\d+QXZ/g, "LOST")}, original), original);
});

test("Source provenance is collapsed and the old two-column design, filtering and color scheme remain", async () => {
  const page = await file("../app/page.tsx");
  const css = await file("../app/globals.css");
  const ewa = await file("../lib/ewa.ts");
  const originalStyle = css.slice(0, ORIGINAL_STYLE_LENGTH);
  assert.equal(createHash("sha256").update(originalStyle).digest("hex"), ORIGINAL_STYLE_SHA256, "original styling was unexpectedly modified");
  assert.match(css, /\.recommendation-list \{ list-style:none;[^\n]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(page, /!proof\.observation && proof\.sourceStatement/);
  assert.doesNotMatch(page, /className="finding-source-statement"/);
  assert.match(page, /recommendationCopy\(item\.text/);
  assert.match(page, /bilingual=\{showTranslation\}/);
  assert.match(page, /const \[showTranslation, setShowTranslation\] = useState\(true\)/);
  assert.doesNotMatch(page, /\btranslatedFields\b/);
  assert.doesNotMatch(ewa, /DVM\/arşivleme/);
});
