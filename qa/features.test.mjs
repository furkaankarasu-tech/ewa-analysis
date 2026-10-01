import test from "node:test";
import assert from "node:assert/strict";
import { findingEvidence } from "../lib/finding-evidence.ts";
import { assessDataQuality } from "../lib/data-quality.ts";
import { systemOverview } from "../lib/multi-report.ts";
import { translateText } from "../lib/local-translation.ts";
import { looksEnglish } from "../lib/local-translation.ts";
import { createActionWorkbook } from "../lib/excel-export.ts";
import JSZip from "jszip";

const source = "Performance Overview > CPU Utilization";
const statement = "The CPU utilization has reached 95 percent in the observation period.";
function report(sid = "TST", period = "01.09.2026 – 07.09.2026") {
  return {
    kind: "EWA", sid, period, filename: `${sid}.htm`, format: "HTML", rating: "SARI", extractedLines: 200,
    alerts: { total: 1, red: 0, yellow: 1, items: [{ title: "CPU Utilization", severity: "yellow" }] },
    findings: [{ id: "cpu", priority: "yuksek", title: "CPU Utilization", evidence: `${statement} · Measure: CPU load peak · Value: 95%`, action: "Check CPU load", owner: "Basis", source, confidence: "Rapor bulgusu" }],
    sections: [{ title: "CPU Utilization", path: source, number: "3.1", level: 2, rating: "yellow", page: 12,
      observations: [statement], recommendations: [], tables: [{ title: "CPU data", header: ["Measure", "Value"], rows: [["CPU load peak", "95%"]], totalRows: 1 }] }],
    topSqlStatements: [], sqlHotspots: [], sqlLoads: [], sqlServerStatements: [], caveats: [],
  };
}

test("bulgu kanıtı yalnızca eşleşen madde ve tablo satırını gösterir", () => {
  const current = report();
  const proof = findingEvidence(current, current.findings[0]);
  assert.equal(proof.section.number, "3.1");
  assert.equal(proof.section.page, 12);
  assert.equal(proof.observation, statement);
  assert.equal(proof.sourceStatement, statement);
  assert.equal(proof.table.values[0].value, "CPU load peak");
  assert.equal(proof.alert.severity, "yellow");
  const unmatched = findingEvidence(current, { ...current.findings[0], source: "Unknown section" });
  assert.equal(unmatched.section, null);
  assert.equal(unmatched.table, null);
});

test("özet farklı yazılsa da özgün bölüm ifadesi görünür ve Excel'e girer", async () => {
  const current = report();
  current.findings[0].evidence = "CPU zirvesi %95; rapor ölçümü.";
  const proof = findingEvidence(current, current.findings[0]);
  assert.equal(proof.observation, null);
  assert.equal(proof.sourceStatement, statement);
  Object.assign(current, { hanaParameters: [], lifecycle: [], componentUpdates: [], sqlWindow: null, sqlLoadImpact: null });
  const workbook = await createActionWorkbook(current);
  const zip = await JSZip.loadAsync(await workbook.arrayBuffer());
  const sheet = await zip.file("xl/worksheets/sheet1.xml").async("string");
  assert.match(sheet, /<c r="L6"[^>]*>.*The CPU utilization has reached 95 percent/);
});

test("veri kalitesi belirsiz renkleri ve kaynaksız bulguyu açıkça işaretler", () => {
  const current = report();
  assert.equal(assessDataQuality(current).issues.length, 0);
  current.alerts.items[0].severity = "unknown";
  current.findings[0].source = "Unknown section";
  const issues = assessDataQuality(current).issues.map((item) => item.title);
  assert.ok(issues.includes("Alarm derecesi belirsiz"));
  assert.ok(issues.includes("Kaynak maddesi eksik"));
  assert.ok(issues.includes("Bazı bölüm renkleri okunamadı"));
});

test("aynı SID'nin en güncel dönemi sayılır, bilinmeyen SID'ler birleşmez", () => {
  const old = report("TST", "01.08.2026 – 07.08.2026");
  const latest = report("TST", "01.09.2026 – 07.09.2026");
  latest.findings[0].priority = "kritik";
  const unknownA = report("SID okunamadı");
  const unknownB = report("SID okunamadı");
  const overview = systemOverview([old, latest, unknownA, unknownB]);
  assert.equal(overview.reports, 4);
  assert.equal(overview.systems, 1);
  assert.equal(overview.unknown, 2);
  assert.equal(overview.items.find((item) => item.sid === "TST").report, latest);
  assert.equal(overview.items.find((item) => item.sid === "TST").count, 2);
  assert.equal(overview.critical, 1);
});

test("iki dilli çeviri veritabanı partition terimini doğru açıklar ve SAP ölçümlerini korur", async () => {
  assert.equal(looksEnglish("Import Errors"), true);
  assert.equal(looksEnglish("Transport Sequence Errors"), true);
  assert.equal(looksEnglish("ABAP dump yoğunluğu"), false);
  const original = "The number of partitions is 120 in SAP HANA.";
  const translator = { async translate(text) { return text.replace("The ", "").replace(" is ", " ").replace(" in ", " ortamı: "); } };
  const translated = await translateText(translator, original);
  assert.match(translated, /partition \(veri bölümü\) sayısı/);
  assert.match(translated, /\b120\b/);
  assert.match(translated, /SAP HANA/);
  assert.doesNotMatch(translated, /paritiyons/i);

  const brokenTranslator = { async translate(text) { return text.replace(/ZXQEWATERM\d+QXZ/g, "paritiyons"); } };
  assert.equal(await translateText(brokenTranslator, original), original);

  const invalidValue = { async translate(text) { return `${text} 999`; } };
  // Numeric values are protected; even deliberate corruption of the masked value cannot pass.
  assert.match(await translateText(invalidValue, original), /\b120\b/);
  assert.doesNotMatch(await translateText(invalidValue, original), /\b999\b/);

  const technical = "Set login/min_password_lng to 8 and see SAP Note 821875 for partitions.";
  const protectedTranslation = await translateText({ async translate(text) { return text.replace("Set ", "Ayarla: ").replace(" and see ", " ve incele: ").replace(" for ", " için "); } }, technical);
  assert.match(protectedTranslation, /login\/min_password_lng/);
  assert.match(protectedTranslation, /SAP Note 821875/);
  assert.match(protectedTranslation, /partition\x27lar \(veri bölümleri\)/);
});
