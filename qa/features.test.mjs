import test from "node:test";
import assert from "node:assert/strict";
import { findingEvidence } from "../lib/finding-evidence.ts";
import { assessDataQuality } from "../lib/data-quality.ts";
import { systemOverview } from "../lib/multi-report.ts";
import { translateText } from "../lib/local-translation.ts";

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
  assert.equal(proof.table.values[0].value, "CPU load peak");
  assert.equal(proof.alert.severity, "yellow");
  const unmatched = findingEvidence(current, { ...current.findings[0], source: "Unknown section" });
  assert.equal(unmatched.section, null);
  assert.equal(unmatched.table, null);
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

test("isteğe bağlı çeviride partitions ve teknik değerler özgün kalır", async () => {
  const original = "The number of partitions is 120 in SAP HANA.";
  const translator = { async translate(text) { return text.replace("The number of", "Sayısı").replace("is", "olarak ölçüldü"); } };
  const translated = await translateText(translator, original);
  assert.match(translated, /\bpartitions\b/);
  assert.match(translated, /\b120\b/);
  assert.match(translated, /SAP HANA/);
  assert.doesNotMatch(translated, /paritiyons/i);

  const brokenTranslator = { async translate(text) { return text.replace(/ZXQEWATERM\d+QXZ/g, "paritiyons"); } };
  assert.equal(await translateText(brokenTranslator, original), original);
});
