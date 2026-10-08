import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { passesTechnicalReview } from "../lib/local-translation.ts";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const theme = fs.readFileSync(new URL("../app/modern-theme.css", import.meta.url), "utf8");
const ewa = fs.readFileSync(new URL("../lib/ewa.ts", import.meta.url), "utf8");
const terminology = fs.readFileSync(new URL("../lib/sap-terminology.ts", import.meta.url), "utf8");

test("tek aktif tema dosyası yükleniyor", () => {
  assert.match(layout, /modern-theme\.css/);
  for (const legacy of ["radar-theme.css","editorial-theme.css","noir-theme.css","architect-theme.css","porcelain-theme.css"]) assert.doesNotMatch(layout, new RegExp(legacy.replace('.', '\\.')));
  assert.match(theme, /--ewa-blue:#0a6ed1/);
  assert.match(theme, /\.modern-shell \.analysis-columns/);
});

test("partitioning teknik terimi zorla Türkçeleştirilmiyor", () => {
  assert.match(ewa, /title: "Partitioning uygulanmamış büyük tablolar"/);
  assert.match(ewa, /partitioning veya SAP Data Volume Management/);
  assert.match(terminology, /Partitioning uygulanmamış büyük tablolar/);
  assert.doesNotMatch(ewa, /Bölümlere ayrılmamış büyük tablolar/);
});


test("machine translation cannot replace partitioning with vague Turkish terminology", () => {
  const src = "Review table partitioning for large non-partitioned tables.";
  assert.equal(passesTechnicalReview(src, "Büyük bölümlere ayrılmamış tablolar için bölümlendirmeyi inceleyin."), false);
  assert.equal(passesTechnicalReview(src, "Partitioning uygulanmamış büyük tablolar için partitioning seçeneğini inceleyin."), true);
});
