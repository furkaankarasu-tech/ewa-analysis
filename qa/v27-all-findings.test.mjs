import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const ts = createRequire(import.meta.url)("typescript");
import { translatedSapHeading, translatedSapStatement, polishRadarTurkish, sapSourceLabel } from "../lib/sap-terminology.ts";
import { knownSapTranslation, translateText } from "../lib/local-translation.ts";
import { findingCopy, recommendationCopy } from "../lib/finding-copy.ts";

const originalCssHash = "df552e88858be2ef148bda74c5650ac7fce6bccbd0593517a407b0a837628297";
const fixtureTitles = [
  ["Memory Consumption of Indexserver", /Indexserver bellek tüketimi/],
  ["Memory Consumption of Nameserver", /Nameserver bellek tüketimi/],
  ["SAP HANA Resource Consumption", /SAP HANA kaynak kullanımı/],
  ["CPU Utilization", /CPU kullanım/],
  ["Database Response Time", /Veritabanı yanıt/],
  ["Dialog Response Time", /Dialog yanıt/],
  ["Program Errors (ABAP Dumps)", /ABAP dump kayıtları/],
  ["Failed Log Backups", /log yedeklemeleri/],
  ["Backup and Recovery", /Yedekleme ve kurtarma/],
  ["Disk Usage", /Disk kullanımı/],
  ["Global Consistency Check", /Genel tutarlılık kontrolü/],
  ["Top SQL Statements", /SQL sorguları/],
  ["Missing Indexes", /Eksik veritabanı indeksleri/],
  ["Message Server Access Control List", /Message Server erişim kontrol listesi/],
  ["Default Passwords of Standard Users", /varsayılan parolaları/],
  ["Password Complexity", /Parola karmaşıklığı/],
  ["Validity of Initial Passwords", /İlk parolaların geçerlilik süresi/],
  ["Gateway Error Logs", /Gateway hata günlükleri/],
  ["SAP Fiori Front-End Server Version", /SAP Fiori Front-End Server sürümü/],
  ["Support Package Maintenance - JAVA", /Java Support Package bakım durumu/],
  ["SAP Application Release", /SAP uygulama sürümü/],
  ["Transport Sequence Errors", /Transport aktarım sırası/],
  ["Trend Analysis for RFC", /RFC eğilim analizi/],
  ["Largest Non-partitioned Column Tables (Records)", /Partitioning uygulanmamış/],
  ["Critical Number Ranges", /Kritik numara aralıkları/],
];

test("başlıklar birbirinden bağımsız 25 EWA alanında düzgün teknik Türkçeye dönüşüyor", () => {
  for (const [english, expected] of fixtureTitles) {
    const result = findingCopy(english, undefined, "section-independent", "title");
    assert.match(result.primary, expected, english);
    assert.equal(result.english, english, `${english}: English must be the true original`);
  }
});

test("birleştirilmiş SAP kaynak yolları tam kaynak anlamını koruyor", () => {
  const original = "Security > ABAP Stack of PFP > Message Server Access Control List";
  const copy = translatedSapHeading(original);
  assert.match(copy, /Güvenlik/);
  assert.match(copy, /PFP ABAP katmanı/);
  assert.match(copy, /Message Server erişim kontrol listesi/);
  assert.doesNotMatch(copy, /undefined/);
});

test("kaynak yolu okunabilir Türkçe, özgün SAP yolu bozulmadan saklanabilir", () => {
  const source = "Security > ABAP Stack of PFP > Message Server Access Control List · s. 14";
  const label = sapSourceLabel(source);
  assert.match(label, /Güvenlik/);
  assert.match(label, /PFP ABAP katmanı/);
  assert.match(label, /s\. 14/);
  assert.equal(sapSourceLabel("Custom APP > ZCUSTOM 101"), "Custom APP > ZCUSTOM 101");
});

test("kanıt cümlesi somutken ve sayılar korunabiliyorken Türkçe üretiliyor", () => {
  const samples = [
    ["The memory usage of the index server was very close to its effective allocation limit.", /bellek sınırına/],
    ["No archiving is set up.", /arşivleme/],
    ["Only a lightweight consistency check is scheduled.", /sınırlı kapsamlı/],
    ["There were 12 unsuccessful log backups.", /12 başarısız log yedeklemesi/],
    ["The memory usage of the index server has reached 95% of its effective allocation limit.", /%95/],
  ];
  for (const [source, expected] of samples) {
    assert.match(knownSapTranslation(source), expected, source);
    assert.equal(findingCopy(source, undefined, "section-generic", "evidence").english, source);
  }
});

test("yerel teknik öneriler yalnızca anlaşılan kalıplarda çevriliyor", () => {
  const password = "Assign a minimum value of 8 to the profile parameter login/min_password_lng.";
  assert.match(recommendationCopy(password).primary, /login\/min_password_lng/);
  assert.equal(recommendationCopy(password).english, password);
  const gateway = "Monitor the error logs periodically for errors and take administrative action to resolve these errors.";
  assert.match(recommendationCopy(gateway).primary, /Gateway hata günlükleri/);
});

test("Radar'ın kendi bulgularında tek terminoloji ve Türkçe yazım kullanılıyor", () => {
  const samples = [
    ["Instance 3.962 / 4.450 GB (%89); tablolar 3.480 GB; indexserver 3.975 / 4.437 GB.", "evidence", /HANA instance belleği.*indexserver belleği/],
    ["13 dump", "evidence", /13 ABAP dump/],
    ["Başarısız log backup denemeleri", "title", /Başarısız log yedekleme denemeleri/],
    ["DVM / arşivleme değerlendirilmelidir", "action", /SAP Veri Hacmi Yönetimi \(DVM\) ile arşivleme/],
    ["ABAP dump yoğunluğu", "title", /ABAP dump yoğunluğu/],
    ["Transport sıra hatası", "title", /Transport aktarım sırası hatası/],
  ];
  for (const [source, field, expected] of samples) assert.match(polishRadarTurkish(source, field), expected);
});

test("bilinmeyen SAP cümlelerine kaynakta bulunmayan çeviri uydurulmuyor", async () => {
  const unknown = "Investigate ZCUSTOM/BPC_PL_Z7 only when QWR_93 has been resolved.";
  const copy = recommendationCopy(unknown);
  assert.equal(copy.primary, unknown);
  assert.equal(copy.english, undefined);
  const translator = { async translate(text) { return text.replace(/ZXQEWATERM\d+QXZ/g, ""); } };
  assert.equal(await translateText(translator, "Set rdisp/autoabap to 120 to evaluate RFC."), "Set rdisp/autoabap to 120 to evaluate RFC.");
});

test("çevrilemeyen İngilizce de hatalı Türkçe olarak gösterilmiyor", () => {
  const original = "Check this supplier-specific setting in its own console.";
  const copy = findingCopy(original, undefined, "section-new", "action");
  assert.equal(copy.primary, original);
  assert.equal(copy.missingTurkish, true);
});

test("v20 görsel tema birebir korunuyor; ek alanlar yalnızca ikincil stilde", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url));
  assert.equal(createHash("sha256").update(css).digest("hex"), originalCssHash);
  const additions = await readFile(new URL("../app/bilingual.css", import.meta.url), "utf8");
  assert.match(additions, /translation-original-action/);
  assert.doesNotMatch(additions, /\.finding-card\s*\{|\.quality-panel\s*\{|\.signal-grid\s*\{/);
});

test("başlık, kanıt, etki, neden, öneri ve dışa aktarımlar aynı çeviri durumunu kullanıyor", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /impact\.english/);
  assert.match(page, /cause\.english/);
  assert.match(page, /createActionWorkbook\(report, showTranslation \? translations : emptyTranslations\(\)\)/);
  assert.doesNotMatch(page, /toEmail\(|Mail özeti|Gmail/);
  assert.match(page, /toMarkdown\(report, showTranslation \? translations : emptyTranslations\(\)\)/);
  const excel = await readFile(new URL("../lib/excel-export.ts", import.meta.url), "utf8");
  assert.match(excel, /polishRadarTurkish/);
});

test("tüm değiştirilen TS ve TSX dosyaları sözdizimsel olarak derlenebilir", async () => {
  const files = ["../lib/sap-terminology.ts", "../lib/local-translation.ts", "../lib/finding-copy.ts", "../lib/ewa.ts", "../lib/excel-export.ts", "../app/page.tsx"];
  for (const path of files) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    assert.equal(file.parseDiagnostics.length, 0, `${path}: ${file.parseDiagnostics.map(d => d.messageText).join(" | ")}`);
  }
});
