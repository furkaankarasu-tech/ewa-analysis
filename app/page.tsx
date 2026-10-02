"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Activity, ArrowDownToLine, ArrowRight, Check, CircleAlert, Clipboard, FileSpreadsheet, FileText, Gauge, Languages, LockKeyhole, Mail, ScanLine, ShieldCheck, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { analyzeEwa, toEmail, toMarkdown, type EwaReport, type Finding } from "@/lib/ewa";
import { dateDelta } from "@/lib/lifecycle";
import { sectionBySource, sectionReference } from "@/lib/section-reference";
import { findingEvidence } from "@/lib/finding-evidence";
import { assessDataQuality } from "@/lib/data-quality";
import { systemOverview } from "@/lib/multi-report";
import { browserTranslator, emptyTranslations, knownSapTranslation, looksEnglish, translateText, type LocalTranslator, type TranslatedFinding } from "@/lib/local-translation";

const priorityNames = { kritik: "Kritik", yuksek: "Yüksek", orta: "Orta", izle: "Takip" };
const formatMeasure = (value: number, digits = 0) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits }).format(value);

function FindingCard({ report, finding, index, translation }: { report: EwaReport; finding: Finding; index: number; translation?: TranslatedFinding }) {
  const section = sectionReference(report, finding);
  const proof = findingEvidence(report, finding);
  const rating = proof.section?.rating;
  const ratingText = rating === "red" ? "Kırmızı" : rating === "yellow" ? "Sarı" : rating === "green" ? "Yeşil" : "Okunamadı";
  return (
    <article className={`finding-card priority-${finding.priority}`}>
      <div className="finding-index">{String(index + 1).padStart(2, "0")}</div>
      <div className="finding-body">
        <div className="finding-heading"><div><h3>{translation?.title || finding.title}</h3>{translation?.title && translation.title !== finding.title && <p className="translation-original-title" lang="en">{finding.title}</p>}</div><span className={`priority-tag ${finding.priority}`}>{priorityNames[finding.priority]}</span></div>
        {proof.sourceStatement && <div className="finding-source-statement"><strong>{proof.observation ? "Rapordaki özgün ifade" : "Kaynak bölümün ilk özgün ifadesi"}</strong><p>{proof.sourceStatement}</p></div>}
        <p className="finding-evidence">{translation?.evidence || finding.evidence}</p>{translation?.evidence && translation.evidence !== finding.evidence && <p className="translation-original-line" lang="en">{finding.evidence}</p>}
        {finding.impact && <><p className="finding-context"><strong>Rapordaki etki</strong> {translation?.impact || finding.impact}</p>{translation?.impact && translation.impact !== finding.impact && <p className="translation-original-line" lang="en">{finding.impact}</p>}</>}
        {finding.cause && <><p className="finding-context"><strong>Rapordaki neden</strong> {translation?.cause || finding.cause}</p>{translation?.cause && translation.cause !== finding.cause && <p className="translation-original-line" lang="en">{finding.cause}</p>}</>}
        <div className="finding-action"><ArrowRight size={17} aria-hidden="true" /><div><p>{finding.recommendation ? <strong>SAP önerisi · </strong> : null}{translation?.action || finding.action}</p>{translation?.action && translation.action !== finding.action && <p className="translation-original-action" lang="en">{finding.action}</p>}</div></div>
        <details className="finding-proof"><summary>Bu sonuca neden vardık?</summary>
          <div className="proof-content">
            <div className="proof-facts">
              <p><strong>Kaynak</strong><span>{proof.section ? `${proof.section.number ? `Madde ${proof.section.number} · ` : "Numara doğrulanamadı · "}${proof.section.path}${proof.section.page ? ` · s. ${proof.section.page}` : ""}` : finding.source}</span></p>
              {report.kind === "EWA" && <p><strong>Raporun bölüm rengi</strong><span>{proof.section ? ratingText : "Bölüm eşleşmedi"}{proof.alert ? ` · Alert Overview: ${proof.alert.severity === "red" ? "Kırmızı" : "Sarı"}` : ""}</span></p>}
              <p><strong>Analiz güveni</strong><span>{finding.confidence} · Kart önceliği: {priorityNames[finding.priority]}</span></p>
            </div>
            <p className="proof-note">Kart önceliği ile raporun bölüm rengi ayrı bilgilerdir. Renk okunamadıysa raporda o rengin bulunduğu varsayılmaz.</p>
            <div className="proof-source"><strong>Analizde kullanılan kanıt</strong><p>{finding.evidence}</p></div>
            {proof.observation && <div className="proof-source"><strong>Kaynak rapordaki ifade</strong><p>{proof.observation}</p></div>}
            {proof.table && <div className="proof-source"><strong>Kaynak tablo · {proof.table.title}</strong><dl>{proof.table.values.filter((cell) => cell.value).map((cell, at) => <div key={`${cell.label}-${at}`}><dt>{cell.label}</dt><dd>{cell.value}</dd></div>)}</dl>{proof.table.omitted > 0 && <small>{proof.table.omitted} sütun daha var; tam satırı kaynak raporda inceleyin.</small>}</div>}
            {proof.section && !proof.observation && !proof.table && <p className="proof-note">Bu bulgu için kaynak bölüm eşleşti, ancak doğrudan alıntı veya tablo satırı eşleşmedi. Analizde kullanılan kanıtı kaynak raporda doğrulayın.</p>}
            {!proof.section && report.kind === "EWA" && <p className="proof-note">Bu bulgu için tekil EWA maddesi eşleşmedi. Kaynak raporu elle kontrol edin.</p>}
          </div>
        </details>
        <div className="finding-meta"><span>{finding.owner}</span>{section && <span>EWA Madde {section.number}{section.page ? ` · s. ${section.page}` : ""}</span>}<span>{finding.source}</span><span>{finding.confidence}</span></div>
      </div>
    </article>
  );
}

function SqlPanel({ title, items, metric }: { title: string; items: EwaReport["sqlHotspots"]; metric: "elapsedSeconds" | "memoryPerExecutionMb" | "cpuPeakSamples" }) {
  const unit = metric === "elapsedSeconds" ? "sn toplam" : metric === "memoryPerExecutionMb" ? "MB / çalıştırma" : "CPU zirve örneği";
  return <div className="sql-panel">
    <h3>{title}</h3>
    {items.length ? <ol>{items.map((item) => <li key={item.hash}>
      <div className="sql-row-head"><code>{item.hash}</code><strong>{formatMeasure(item[metric]!, metric === "cpuPeakSamples" ? 0 : 1)} <small>{unit}</small></strong></div>
      <p>{item.executions !== undefined ? `${formatMeasure(item.executions)} çalıştırma` : ""}{item.averageMs !== undefined ? ` · ortalama ${formatMeasure(item.averageMs, 1)} ms` : ""}</p>
      {item.source && <p className="sql-source">Kaynak: {item.source}</p>}
      {item.reportSource && <p className="sql-source">Rapor bölümü: {item.reportSource}</p>}
      {item.origin && <p className="sql-source">Çağıran: {item.origin}</p>}
    </li>)}</ol> : <p className="sql-empty">Bu ölçüm raporda okunamadı.</p>}
  </div>;
}

export default function Home() {
  const [report, setReport] = useState<EwaReport | null>(null);
  const [reports, setReports] = useState<EwaReport[]>([]);
  const [working, setWorking] = useState(false);
  const [loadStatus, setLoadStatus] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [excelWorking, setExcelWorking] = useState(false);
  const [mailCopied, setMailCopied] = useState(false);
  const [mailEvidence, setMailEvidence] = useState(true);
  const [mailCaveats, setMailCaveats] = useState(true);
  const [translations, setTranslations] = useState(emptyTranslations);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationReady, setTranslationReady] = useState(false);
  const [translationWorking, setTranslationWorking] = useState(false);
  const [translationStatus, setTranslationStatus] = useState("");
  const [recommendationFilter, setRecommendationFilter] = useState<"all" | "red" | "yellow" | "other">("all");
  const [recommendationQuery, setRecommendationQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const loadSequence = useRef(0);
  const translatorRef = useRef<LocalTranslator | null>(null);
  const translationStarted = useRef(false);
  const reportRef = useRef(report);
  reportRef.current = report;

  useEffect(() => {
    if (report) void translateReport(report);
    // The report itself is the only trigger. A stale run cannot update a newly selected report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "read_current_ewa_analysis",
        title: "Mevcut EWA analizini oku",
        description: "Ekranda görünen EWA analizinin SID, dönem, KPI, bulgu ve veri kalitesi notlarını yapılandırılmış olarak döndürür.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute() {
          const current = reportRef.current;
          if (!current) return { status: "no_report", message: "Son seçilen dosya analiz edilemedi; ekranda rapor sonucu yok." };
          return { kind: current.kind, sid: current.sid, period: current.period, rating: current.rating, product: current.product, database: current.database, alerts: current.alerts, sections: current.sections, findings: current.findings, recommendations: current.recommendations, kpis: current.kpis, caveats: current.caveats, componentUpdates: current.componentUpdates, sqlHotspots: current.sqlHotspots, sqlLoads: current.sqlLoads, sqlServerStatements: current.sqlServerStatements, topSqlStatements: current.topSqlStatements, lifecycle: current.lifecycle, hanaParameters: current.hanaParameters };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch { /* WebMCP bulunmayan tarayıcılarda ekran normal çalışır. */ }
    return () => lifecycle.abort();
  }, []);

  function showReport(target: EwaReport) {
    if (target === report) return;
    ++loadSequence.current;
    setReport(target);
    setTranslations(emptyTranslations());
    setShowTranslation(false);
    setTranslationReady(false);
    setTranslationStatus("");
    setTranslationWorking(false);
    translationStarted.current = false;
    setRecommendationFilter("all");
    setRecommendationQuery("");
  }

  async function loadFiles(files: File[]) {
    if (!files.length) return;
    const sequence = ++loadSequence.current;
    setReport(null);
    setReports([]);
    setTranslations(emptyTranslations());
    setShowTranslation(false);
    setTranslationReady(false);
    setTranslationStatus("");
    setTranslationWorking(false);
    translationStarted.current = false;
    setRecommendationFilter("all");
    setRecommendationQuery("");
    setError("");
    setWorking(true);
    const selected = files.slice(0, 12);
    const accepted: EwaReport[] = [];
    const failures: string[] = [];
    if (files.length > 12) failures.push("İlk 12 dosya işlendi; kalanları yeni bir seçimde yükleyin.");
    try {
      for (const [index, file] of selected.entries()) {
        if (sequence !== loadSequence.current) return;
        setLoadStatus(`${index + 1}/${selected.length} rapor inceleniyor · ${file.name}`);
        try { accepted.push(await analyzeEwa(file)); }
        catch (caught) { failures.push(`${file.name}: ${caught instanceof Error ? caught.message : "Rapor okunamadı."}`); }
      }
      if (sequence === loadSequence.current) {
        setReports(accepted);
        if (accepted[0]) {
          setReport(accepted[0]);
        }
        if (failures.length) setError(failures.join(" · "));
      }
    } finally {
      if (sequence === loadSequence.current) { setWorking(false); setLoadStatus(""); if (inputRef.current) inputRef.current.value = ""; }
    }
  }
  async function translateReport(target: EwaReport) {
    if (translationStarted.current) return;
    const sequence = loadSequence.current;
    translationStarted.current = true;
    setTranslationWorking(true);
    setShowTranslation(true);
    const fields: (keyof TranslatedFinding)[] = ["title", "evidence", "impact", "cause", "action"];
    const tasks: ({ kind: "finding"; index: number; field: keyof TranslatedFinding; original: string } | { kind: "recommendation"; index: number; original: string })[] = [];
    const reviewed = emptyTranslations();
    target.findings.forEach((finding, index) => fields.forEach((field) => {
      const original = finding[field];
      if (!original || !looksEnglish(original)) return;
      const known = knownSapTranslation(original);
      if (known) reviewed.findings[index] = { ...reviewed.findings[index], [field]: known };
      else tasks.push({ kind: "finding", index, field, original });
    }));
    target.recommendations.forEach((item, index) => {
      if (!looksEnglish(item.text)) return;
      const known = knownSapTranslation(item.text);
      if (known) reviewed.recommendations[index] = known;
      else tasks.push({ kind: "recommendation", index, original: item.text });
    });
    if (sequence !== loadSequence.current) return;
    setTranslations(reviewed);
    const reviewedCount = Object.values(reviewed.findings).reduce((count, item) => count + Object.keys(item).length, 0) + Object.keys(reviewed.recommendations).length;
    setTranslationReady(reviewedCount > 0);
    setTranslationStatus(tasks.length ? `İngilizce kaynak korunuyor · ${reviewedCount} doğrulanmış çeviri hazır; diğerleri cihazda çevriliyor.` : reviewedCount ? "Türkçe ve İngilizce açıklamalar hazır; İngilizce SAP kaynağı korunuyor." : "Raporun özgün metni gösteriliyor.");
    if (!tasks.length) { setTranslationWorking(false); translationStarted.current = false; return; }
    try {
      let translator = translatorRef.current;
      if (!translator) {
        const factory = browserTranslator();
        if (!factory) throw new Error("Bu tarayıcı yerel çeviriyi desteklemiyor. Hazır Türkçe terimler ve özgün İngilizce metin gösteriliyor.");
        translator = await factory.create({ sourceLanguage: "en", targetLanguage: "tr", monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            if (sequence === loadSequence.current && typeof event.loaded === "number") setTranslationStatus(`Cihazda Türkçe çeviri hazırlanıyor: %${Math.round(event.loaded * 100)}`);
          });
        } });
        translatorRef.current = translator;
      }
      if (sequence !== loadSequence.current) return;
      const cache = new Map<string, string>();
      let failed = 0;
      let completed = 0;
      let translatedCount = reviewedCount;
      for (const task of tasks) {
        if (sequence !== loadSequence.current) return;
        try {
          let result = cache.get(task.original);
          if (result === undefined) { result = await translateText(translator, task.original); cache.set(task.original, result); }
          if (sequence !== loadSequence.current) return;
          if (result !== task.original) {
            translatedCount += 1;
            if (task.kind === "finding") setTranslations((previous) => ({ ...previous, findings: { ...previous.findings, [task.index]: { ...previous.findings[task.index], [task.field]: result } } }));
            else setTranslations((previous) => ({ ...previous, recommendations: { ...previous.recommendations, [task.index]: result } }));
          } else failed += 1;
        } catch { failed += 1; }
        completed += 1;
        if (sequence === loadSequence.current) setTranslationStatus(`Türkçe çeviri: ${completed}/${tasks.length}${failed ? ` · ${failed} metin özgün bırakıldı` : ""}`);
      }
      if (sequence !== loadSequence.current) return;
      setTranslationReady(translatedCount > 0);
      setTranslationStatus(failed ? `${translatedCount} Türkçe metin hazır, ${failed} metin doğrulanamadı. Doğrulanamayanların yalnızca özgün İngilizcesi gösteriliyor.` : "Türkçe üstte, özgün İngilizce hemen altında. SAP teknik değerleri korunuyor.");
    } catch (caught) {
      if (sequence === loadSequence.current) setTranslationStatus(caught instanceof Error ? caught.message : "Yerel çeviri başlatılamadı; doğrulanmış Türkçe ifadeler ve İngilizce kaynak gösteriliyor.");
    } finally {
      if (sequence === loadSequence.current) { setTranslationWorking(false); translationStarted.current = false; }
    }
  }
  function toggleTranslation() {
    if (!report || translationWorking) return;
    if (showTranslation) {
      setShowTranslation(false);
      setTranslationStatus("Yalnızca SAP kaynağı gösteriliyor. Türkçe açıklamaları yeniden açabilirsiniz.");
    } else if (translationReady) {
      setShowTranslation(true);
      setTranslationStatus("Türkçe üstte, özgün İngilizce hemen altında.");
    } else void translateReport(report);
  }
  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); void loadFiles(Array.from(event.dataTransfer.files)); }
  async function copy() {
    if (!report) return;
    try { await navigator.clipboard.writeText(toMarkdown(report)); setCopied(true); window.setTimeout(() => setCopied(false), 2400); }
    catch { setError("Panoya kopyalanamadı. Markdown dosyasını indirebilirsiniz."); }
  }
  function download() {
    if (!report) return;
    const blob = new Blob([toMarkdown(report)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.sid.replace(/[^A-Za-z0-9]/g, "") || "EWA"}_EWA_analiz.md`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function downloadExcel() {
    if (!report || excelWorking) return;
    setExcelWorking(true);
    try {
      const { createActionWorkbook } = await import("@/lib/excel-export");
      const blob = await createActionWorkbook(report);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${report.sid.replace(/[^A-Za-z0-9]/g, "") || "EWA"}_${report.kind === "EWA" ? "EWA" : "bakim"}_aksiyon_listesi.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Excel aksiyon listesi oluşturulamadı. Dosyayı yeniden seçip tekrar deneyin.");
    } finally {
      setExcelWorking(false);
    }
  }
  const critical = report?.findings.filter((item) => item.priority === "kritik").length ?? 0;
  const recommendationCounts = {
    all: report?.recommendations.length ?? 0,
    red: report?.recommendations.filter((item) => item.rating === "red").length ?? 0,
    yellow: report?.recommendations.filter((item) => item.rating === "yellow").length ?? 0,
    other: report?.recommendations.filter((item) => item.rating !== "red" && item.rating !== "yellow").length ?? 0,
  };
  const visibleRecommendations = report?.recommendations.map((item, index) => ({ item, index })).filter(({ item, index }) => {
    if (recommendationFilter === "red" && item.rating !== "red") return false;
    if (recommendationFilter === "yellow" && item.rating !== "yellow") return false;
    if (recommendationFilter === "other" && (item.rating === "red" || item.rating === "yellow")) return false;
    const query = recommendationQuery.trim().toLocaleLowerCase("tr-TR");
    return !query || [item.source, item.text, showTranslation ? translations.recommendations[index] || "" : ""].some((part) => part.toLocaleLowerCase("tr-TR").includes(query));
  }) ?? [];
  const sqlRows = report ? [...report.sqlLoads].sort((a, b) => a.source.localeCompare(b.source) || b.elapsedPercent - a.elapsedPercent) : [];
  const mail = report ? toEmail(report, { evidence: mailEvidence, caveats: mailCaveats }) : null;
  const quality = report ? assessDataQuality(report) : null;
  const overview = systemOverview(reports);

  async function copyMail() {
    if (!mail) return;
    try { await navigator.clipboard.writeText(`Konu: ${mail.subject}\n\n${mail.body}`); setMailCopied(true); window.setTimeout(() => setMailCopied(false), 2400); }
    catch { setError("Mail metni panoya kopyalanamadı."); }
  }

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Uygulama bilgisi">
        <div className="brand"><span className="brand-mark"><Activity size={22} strokeWidth={2.5} aria-hidden="true" /></span><span>EWA<span className="brand-light">RADAR</span></span></div>
        <div className="rail-line" />
        <div className="rail-label">Basis çalışma alanı</div>
        <div className="rail-current"><ScanLine size={19} aria-hidden="true" /><span>Rapor analizi</span></div>
        <div className="rail-spacer" />
        <div className="rail-note"><ShieldCheck size={19} aria-hidden="true" /><p>Yüklenen dosya tarayıcıda işlenir. Rapor içeriği bu uygulamada saklanmaz.</p></div>
        <div className="rail-footer">EWA RADAR <span>v22 / Analiz</span></div>
      </aside>

      <main className="workspace">
        <div className="topbar"><div className="breadcrumb"><span>Çalışma alanı</span><span className="slash">/</span><strong>SAP rapor analizi</strong></div><span className="local-chip"><LockKeyhole size={15} aria-hidden="true" /> Yerel dosya analizi</span></div>
        <div className="workspace-content">
          <div className="page-intro">
            <div><p className="eyebrow">SAP BASIS · RAPOR</p><h1>Rapordan aksiyona.</h1><p className="intro-copy">EarlyWatch veya aylık bakım raporunu yükle; bulguları, önceliği ve sorumlu ekibi tek ekranda gör.</p></div>
            <div className="intro-symbol" aria-hidden="true"><Gauge size={42} strokeWidth={1.45} /></div>
          </div>

          <section className="upload-panel" aria-labelledby="upload-heading">
            <div className="upload-copy"><div className="upload-icon"><UploadCloud size={24} aria-hidden="true" /></div><div><h2 id="upload-heading">Bir veya birden fazla rapor incele</h2><p>EWA: PDF, DOCX, SAP Word XML (.doc), HTM/HTML · Aylık bakım: DOCX · dosya başına 25 MB · en fazla 12 dosya</p></div></div>
            <div className="upload-actions"><input ref={inputRef} className="sr-only" type="file" multiple accept=".pdf,.doc,.docx,.htm,.html" aria-label="EWA dosyalarını seç" onChange={(event) => void loadFiles(Array.from(event.target.files ?? []))} /><Button className="upload-button" disabled={working} onClick={() => inputRef.current?.click()}>{working ? "Analiz ediliyor…" : "Dosya seç"}<ArrowRight size={17} aria-hidden="true" /></Button></div>
            <div className="drop-layer" onDragOver={(event) => event.preventDefault()} onDrop={drop} aria-hidden="true" />
          </section>
          {loadStatus && <div className="load-status" role="status">{loadStatus}</div>}
          {error && <div className="error-banner" role="alert"><CircleAlert size={18} aria-hidden="true" /><div><strong>{/OCR|PDF metni çıkarılamadı/i.test(error) ? "Taranmış PDF · OCR gerekli" : "Dosya kontrolü"}</strong><p>{error}</p></div></div>}

          {reports.length > 1 && <section className="system-overview" aria-label="Yüklenen sistemlerin özeti">
            <div className="section-heading"><div><p className="eyebrow">SİSTEM GÖRÜNÜMÜ</p><h2>Yüklenen EWA raporları</h2></div><span>{overview.reports} EWA · {overview.systems} doğrulanmış sistem{overview.unknown ? ` · ${overview.unknown} SID belirsiz` : ""} · {overview.critical} kritik etiketli bulgu</span></div>
            <p className="data-note">Aynı SID için yalnızca en güncel dönem sistem toplamına katılır. Raporlar bu sekmenin belleğinde kalır; sayfa kapanınca liste temizlenir.</p>
            {overview.items.length ? <div className="system-cards">{overview.items.map((item, index) => <button key={`${item.sid}-${index}`} type="button" className={`system-card${report === item.report ? " selected" : ""}`} onClick={() => showReport(item.report)}>
              <span className="system-card-top"><strong>{item.sid}</strong><span>{item.report.rating || "Genel renk okunamadı"}</span></span>
              <span className="system-card-period">{item.report.period}{item.sid === "SID okunamadı" ? ` · ${item.report.filename}` : ""}</span>
              <span className="system-card-counts"><b>{item.critical} kritik etiketli</b><b>{item.high} yüksek etiketli</b><b>{item.findings} bulgu</b></span>
              <span className="system-card-footer">{item.count > 1 ? `${item.count} rapordan en günceli` : "1 rapor"} <ArrowRight size={15} aria-hidden="true" /></span>
            </button>)}</div> : <p className="empty-card">Bu seçimde EWA yok; aylık bakım raporlarını aşağıdaki dosya listesinden açabilirsiniz.</p>}
            <div className="report-picker"><strong>Bu oturumdaki dosyalar</strong><div>{reports.map((item, index) => <button key={`${item.filename}-${index}`} type="button" aria-pressed={report === item} onClick={() => showReport(item)}>{item.sid} · {item.period} <small>{item.filename}</small></button>)}</div></div>
          </section>}

          {report && mail ? <section className="analysis-section" aria-live="polite" aria-busy={working}>
            <div className="analysis-topline">
              <div><p className="eyebrow">{report.kind === "EWA" ? "EWA ANALİZİ" : "AYLIK BAKIM ANALİZİ"}</p><h2>{report.sid} <span>/ {report.period}</span></h2><p className="source-file"><FileText size={16} aria-hidden="true" />{report.filename} · {report.format}{report.product ? ` · ${report.product}` : ""}{report.database ? ` · ${report.database}` : ""}</p></div>
              <div className="result-actions">
                <Button variant="outline" className="secondary-button" disabled={translationWorking} onClick={toggleTranslation}><Languages size={16} />{translationWorking ? "Çevriliyor…" : showTranslation ? "Yalnızca İngilizce" : "Türkçe + İngilizce"}</Button>
                <Dialog><DialogTrigger asChild><Button className="mail-button"><Mail size={16} /> Mail özeti</Button></DialogTrigger>
                  <DialogContent className="mail-dialog">
                    <DialogHeader><DialogTitle>Gönderime hazır mail özeti</DialogTitle><DialogDescription>Raporun bulgularından konu ve metin oluşturulur. Alıcıyı Gmail'de sen seçersin.</DialogDescription></DialogHeader>
                    <div className="mail-options"><label><Checkbox checked={mailEvidence} onCheckedChange={(value) => setMailEvidence(value === true)} /> Kanıtları ekle</label><label><Checkbox checked={mailCaveats} onCheckedChange={(value) => setMailCaveats(value === true)} /> Veri kalitesi notlarını ekle</label></div>
                    <div className="mail-subject"><span>Konu</span><strong>{mail.subject}</strong></div>
                    <pre className="mail-preview">{mail.body}</pre>
                    <div className="mail-dialog-actions"><Button onClick={() => void copyMail()}>{mailCopied ? <Check size={16} /> : <Clipboard size={16} />}{mailCopied ? "Kopyalandı" : "Mail metnini kopyala"}</Button></div>
                  </DialogContent></Dialog>
                <Button variant="outline" className="secondary-button" onClick={() => void copy()}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Kopyalandı" : "Özeti kopyala"}</Button>
                <Button variant="outline" className="secondary-button" onClick={download}><ArrowDownToLine size={16} /> Markdown indir</Button>
                <Button variant="outline" className="secondary-button" disabled={excelWorking} onClick={() => void downloadExcel()}><FileSpreadsheet size={16} />{excelWorking ? "Excel hazırlanıyor…" : "Excel indir"}</Button>
              </div>
            </div>
            <p className="translation-note" role="status">{translationStatus || "Türkçe açıklamalar hazırlanıyor; özgün İngilizce SAP metni korunur. İndirmeler kaynak analizini içerir."}</p>
            <div className={`signal-grid${report.rating ? "" : " no-rating"}`}>
              {report.rating && <div className="signal-card rating-card"><div className="signal-label">Genel durum</div><strong>{report.rating}</strong><div className="signal-bottom">{report.kind === "EWA" ? "EWA rapor değerlendirmesi" : "Bakım raporundaki en yüksek risk"}</div></div>}
              {report.kind === "EWA" ? <>
                <div className="signal-card"><div className="signal-label">Alarm özeti</div><strong>{report.alerts.total ?? "—"}</strong><div className="signal-bottom">{report.alerts.red !== null && report.alerts.yellow !== null ? `${report.alerts.red} kırmızı · ${report.alerts.yellow} sarı` : "Alert Overview kayıtları"}</div></div>
                <div className="signal-card"><div className="signal-label">Kritik bulgu</div><strong>{String(critical).padStart(2, "0")}</strong><div className="signal-bottom">Kanıtla önceliklendirilen bulgu</div></div>
                <div className="signal-card"><div className="signal-label">KPI</div><strong>{String(report.kpis.length).padStart(2, "0")}</strong><div className="signal-bottom">Rapordan çıkarılan ölçüm</div></div>
              </> : <>
                <div className="signal-card"><div className="signal-label">Risk kaydı</div><strong>{String(report.findings.length).padStart(2, "0")}</strong><div className="signal-bottom">Metin tablolarından çıkarıldı</div></div>
                <div className="signal-card"><div className="signal-label">Kontrol başlığı</div><strong>{report.kpis.find((item) => item.label === "Kontrol başlığı")?.value ?? "—"}</strong><div className="signal-bottom">Belgede incelenen bölüm</div></div>
                <div className="signal-card"><div className="signal-label">Rapor tarihi</div><strong>{report.kpis.find((item) => item.label === "Rapor tarihi")?.value ?? "—"}</strong><div className="signal-bottom">Belgede yazan tarih</div></div>
              </>}
            </div>

            {quality && <section className={`quality-panel${quality.issues.length ? " needs-review" : ""}`} aria-labelledby="quality-heading">
              <div className="quality-heading"><div><p className="eyebrow">VERİ KALİTESİ</p><h2 id="quality-heading">{quality.issues.length ? `${quality.issues.length} kontrol noktası var` : "Temel alanlar okundu"}</h2></div><span>{report.format} · {report.extractedLines} metin satırı</span></div>
              <div className="quality-checks">{quality.checks.map((check) => <div key={check.label} className={`quality-check ${check.state}`}><span>{check.label}</span><strong>{check.value}</strong></div>)}</div>
              {quality.issues.length > 0 && <ul className="quality-issues">{quality.issues.map((issue) => <li key={issue.title}><CircleAlert size={16} aria-hidden="true" /><div><strong>{issue.title}</strong><p>{issue.detail}</p></div></li>)}</ul>}
              <details className="quality-notes"><summary>Rapordan gelen diğer doğrulama notları ({report.caveats.length})</summary>{report.caveats.length ? <ul>{report.caveats.map((caveat, index) => <li key={index}>{caveat}</li>)}</ul> : <p>Ek not yok.</p>}</details>
            </section>}

            {report.kind === "EWA" && (report.componentCount !== null || report.lifecycle.length > 0) && <nav className="software-brief" aria-label="Yazılım bakımı ve sürümler">
              <div><span>Komponentler</span><strong>{report.componentCount === null ? "Tablo okunamadı" : `${report.componentCount} incelendi · ${report.componentUpdates.length} seviye farkı`}</strong><a href="#component-heading">Tabloyu gör <ArrowRight size={14} aria-hidden="true" /></a></div>
              <div><span>Ürün bakımı</span><strong>{report.lifecycle.find((item) => item.area === "SAP ürünü")?.name ?? "Rapor kaydı yok"}</strong><small>{report.lifecycle.find((item) => item.area === "SAP ürünü")?.endDate || "Tarih okunamadı"}</small>{report.lifecycle.length > 0 && <a href="#lifecycle-heading">Tarihleri gör <ArrowRight size={14} aria-hidden="true" /></a>}</div>
            </nav>}

            <div className="analysis-columns">
              <div className="main-column"><div className="section-heading"><div><p className="eyebrow">01 / ANALİZ</p><h2>Öncelikli bulgular</h2></div><span>{report.findings.length} bulgu</span></div><p className="data-note">Her bulgu bu dosyadaki ölçüm veya açık rapor ifadesiyle desteklenir. Kaynak bölüm ve varsa sayfa bilgisi kartta yer alır.</p><div className="findings">{report.findings.length ? report.findings.map((finding, index) => <FindingCard key={finding.id + index} report={report} finding={finding} translation={showTranslation ? translations.findings[index] : undefined} index={index} />) : <div className="empty-card">Bu rapordan güvenilir aksiyon çıkarılamadı. Kaynak dosyayı inceleyin.</div>}</div></div>
              <aside className="detail-column"><div className="detail-card"><p className="eyebrow">02 / SAYILAR</p><h2>{report.kind === "EWA" ? "KPI görünümü" : "Kontrol özeti"}</h2><div className="kpi-list">{report.kpis.map((kpi) => <div className="kpi-row" key={kpi.label}><span>{kpi.label}</span><strong>{kpi.value}</strong>{kpi.note && <small>{kpi.note}</small>}</div>)}</div></div></aside>
            </div>
            {report.kind === "EWA" && <div className="deep-analysis">
              <section className="deep-section" aria-labelledby="component-heading">
                <div className="section-heading"><div><p className="eyebrow">05 / YAZILIM BAKIMI</p><h2 id="component-heading">Komponent güncellemeleri</h2></div><span>{report.componentCount !== null ? `${report.componentCount} incelendi · ${report.componentUpdates.length} fark` : "Tablo okunamadı"}</span></div>
                {report.componentUpdates.length ? <div className="table-scroll"><table className="component-table"><thead><tr><th>Komponent</th><th>Sürüm</th><th>Seviye türü</th><th>Mevcut</th><th>Rapordaki son</th><th>Fark</th></tr></thead><tbody>{report.componentUpdates.map((item) => <tr key={`${item.component}-${item.version}`}><th scope="row">{item.component}<small>{item.description}</small></th><td data-label="Sürüm">{item.version}</td><td data-label="Seviye türü">{item.metric}</td><td data-label="Mevcut">{item.installedPatch}</td><td data-label="Rapordaki son">{item.latestPatch}</td><td data-label="Fark">+{item.latestPatch - item.installedPatch}</td></tr>)}</tbody></table></div> : <div className="empty-card">{report.componentCount === null ? "Komponent tablosu bu dosyada bulunamadı veya okunamadı." : "Rapordaki tabloda mevcut seviye ile son seviye arasında fark bulunmadı."}</div>}
                <p className="data-note">Son seviye raporun üretildiği andaki değerdir. Kurulum kararı için bağımlılıkları ve güncel bakım bilgisini doğrulayın.</p>
              </section>
              {report.lifecycle.length > 0 && <section className="deep-section" aria-labelledby="lifecycle-heading">
                <div className="section-heading"><div><p className="eyebrow">SÜRÜM VE DESTEK</p><h2 id="lifecycle-heading">Bakım bitiş tarihleri</h2></div><span>{report.lifecycle.length} kayıt</span></div>
                <div className="table-scroll"><table className="component-table"><thead><tr><th>Bileşen</th><th>Mevcut sürüm</th><th>Tarih türü</th><th>Tarih</th><th>Rapor bitişinde</th><th>Bugün</th><th>Durum</th><th>Kaynak</th></tr></thead><tbody>{report.lifecycle.map((item, index) => {
                  const end = report.period.match(/(\d{2}\.\d{2}\.\d{4})$/)?.[1] ?? "";
                  const today = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()).replace(/\//g, ".");
                  const isEndDate = !/Son paket oluşturma tarihi/i.test(item.dateLabel);
                  const atReport = isEndDate ? dateDelta(item.endDate, end) : null; const atToday = isEndDate ? dateDelta(item.endDate, today) : null;
                  const days = (value: number | null) => value === null ? "—" : value < 0 ? `${-value} gün geçmiş` : `${value} gün kaldı`;
                  return <tr key={`${item.name}-${index}`}><th scope="row">{item.name}<small>{item.area}</small></th><td data-label="Mevcut sürüm">{item.installed || "—"}</td><td data-label="Tarih türü">{item.dateLabel || "—"}</td><td data-label="Tarih">{item.endDate || "—"}{item.extendedEnd ? <small>Uzatılmış: {item.extendedEnd}</small> : null}</td><td data-label="Rapor bitişinde">{days(atReport)}</td><td data-label="Bugün">{days(atToday)}</td><td data-label="Durum">{item.status || "—"}</td><td data-label="Kaynak">{item.source}</td></tr>;
                })}</tbody></table></div><p className="data-note">Tarih hesabı türetilmiştir. Uzatılmış destek için sözleşme ve patch kapsamını ayrıca doğrulayın.</p>
              </section>}
              {report.decisive.length > 0 && <section className="deep-section"><div className="section-heading"><div><p className="eyebrow">RAPORUN KENDİ ÖNCELİĞİ</p><h2>Kırmızı raporu belirleyen bulgular</h2></div><span>{report.decisive.length} kayıt</span></div><div className="alert-list">{report.decisive.map((item, index) => <div className="alert-item severity-red" key={`${item}-${index}`}><span className="alert-dot" aria-hidden="true" /><span>{item}</span><strong>Kırmızı</strong></div>)}</div><p className="data-note">Bu kayıtlar Alert Overview toplamına ikinci kez eklenmez.</p></section>}
              {report.alerts.items.length > 0 && <section className="deep-section" aria-labelledby="alert-heading">
                <div className="section-heading"><div><p className="eyebrow">04 / RAPOR ALARMLARI</p><h2 id="alert-heading">Alert Overview</h2></div><span>{report.alerts.total} alarm</span></div>
                <div className="alert-list">{report.alerts.items.map((item, index) => <div key={`${index}-${item.title}`} className={`alert-item severity-${item.severity}`}><span className="alert-dot" aria-hidden="true" /><span>{item.title}</span>{item.severity !== "unknown" && <strong>{item.severity === "red" ? "Kırmızı" : "Sarı"}</strong>}</div>)}</div>
              </section>}
              {report.recommendations.length > 0 && <section className="deep-section" aria-labelledby="recommendation-heading">
                <div className="section-heading"><div><p className="eyebrow">SAP ÖNERİLERİ</p><h2 id="recommendation-heading">Rapordaki SAP önerileri</h2></div><span>{report.recommendations.length} öneri</span></div>
                <p className="data-note">Kırmızı ikon doğrulanan bölümdeki öneri kritik olarak işaretlenir. Diğer bölüm önerileri de kaynak metniyle listelenir; önerinin bulunması tek başına arıza kanıtı değildir.</p>
                <div className="recommendation-controls"><div className="recommendation-filters" role="group" aria-label="Öneri durumuna göre filtrele">{([
                  ["all", "Tümü"], ["red", "Kritik ikon"], ["yellow", "Sarı ikon"], ["other", "Diğer"],
                ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={recommendationFilter === value} className={recommendationFilter === value ? "active" : ""} onClick={() => setRecommendationFilter(value)}>{label} <span>{recommendationCounts[value]}</span></button>)}</div><label className="recommendation-search"><span className="sr-only">Önerilerde ara</span><input type="search" value={recommendationQuery} onChange={(event) => setRecommendationQuery(event.target.value)} placeholder="Kaynak veya öneride ara" /></label></div>
                <p className="recommendation-result" role="status">{visibleRecommendations.length} / {report.recommendations.length} öneri gösteriliyor</p>
                {visibleRecommendations.length ? <ol className="recommendation-list">{visibleRecommendations.map(({ item, index }) => <li className={`recommendation-item recommendation-${item.rating}`} key={`${item.source}-${index}`}>
                  <div className="recommendation-head"><span>{item.source}</span>{item.rating === "red" ? <strong>Kritik ikon</strong> : item.rating === "yellow" ? <strong>Sarı ikon</strong> : null}</div>
                  {showTranslation && translations.recommendations[index] ? <>
                    <p className="recommendation-turkish" lang="tr">{translations.recommendations[index]}</p>
                    <p className="recommendation-english" lang="en"><span>EN</span>{item.text}</p>
                  </> : <p lang={looksEnglish(item.text) ? "en" : "tr"}>{item.text}</p>}
                </li>)}</ol> : <div className="empty-card">Bu filtreyle eşleşen SAP önerisi bulunamadı.</div>}
              </section>}
              {report.sqlHotspots.length > 0 && <section className="deep-section" aria-labelledby="sql-heading">
                <div className="section-heading"><div><p className="eyebrow">06 / HANA SQL</p><h2 id="sql-heading">Raporda öne çıkan HANA SQL ölçümleri</h2></div><span>{report.sqlHotspots.length} benzersiz statement hash</span></div>
                {report.sqlWindow && <p className="data-note">Toplam süre ölçüm penceresi: {report.sqlWindow}</p>}
                <div className="sql-grid">
                  {report.sqlHotspots.some((item) => item.elapsedSeconds !== undefined) && <SqlPanel title="En yüksek toplam süre" metric="elapsedSeconds" items={[...report.sqlHotspots].filter((item) => item.elapsedSeconds !== undefined).sort((a, b) => b.elapsedSeconds! - a.elapsedSeconds!).slice(0, 5)} />}
                  {report.sqlHotspots.some((item) => item.memoryPerExecutionMb !== undefined) && <SqlPanel title="En yüksek bellek" metric="memoryPerExecutionMb" items={[...report.sqlHotspots].filter((item) => item.memoryPerExecutionMb !== undefined).sort((a, b) => b.memoryPerExecutionMb! - a.memoryPerExecutionMb!).slice(0, 5)} />}
                  {report.sqlHotspots.some((item) => item.cpuPeakSamples !== undefined) && <SqlPanel title="CPU zirvesi" metric="cpuPeakSamples" items={[...report.sqlHotspots].filter((item) => item.cpuPeakSamples !== undefined).sort((a, b) => b.cpuPeakSamples! - a.cpuPeakSamples!).slice(0, 5)} />}
                </div>
                <p className="data-note">Statement hash, kaynak ve çağıran bilgi rapordan alınmıştır. Plan cache ve thread örnekleri farklı ölçüm türleridir; yük nedeni için yürütme planını ayrıca inceleyin.</p>
              </section>}
              {report.topSqlStatements.length > 0 && <section className="deep-section" aria-labelledby="top-sql-heading">
                <div className="section-heading"><div><p className="eyebrow">RAPORDAKİ SQL</p><h2 id="top-sql-heading">Top SQL Statements</h2></div><span>{report.topSqlStatements.length} satır</span></div>
                <p className="data-note">Sıra ve ölçümler EWA tablosundan alınmıştır. Sıfır saniye raporda yuvarlanmış olabilir; yüksek yük anlamı çıkarılmaz.</p>
                <ol className="sql-record-list">{report.topSqlStatements.map((item) => <li className="sql-record" key={`${item.source}-${item.rank}`}>
                  <div className="sql-record-head"><span>Sıra {item.rank} · Madde {sectionBySource(report, item.source)?.number ?? "doğrulanamadı"}</span>{item.truncated && <span>SQL raporda kısaltılmış</span>}</div>
                  <code className="sql-statement">{item.statement}</code>
                  <dl className="sql-metrics"><div><dt>Toplam yanıt</dt><dd>{formatMeasure(item.accumulatedSeconds, 2)} sn</dd></div><div><dt>Çalıştırma</dt><dd>{formatMeasure(item.executions)}</dd></div><div><dt>Ortalama yanıt</dt><dd>{formatMeasure(item.averageMs, 2)} ms</dd></div></dl>
                  <p className="sql-reference">{item.source}</p>
                </li>)}</ol>
              </section>}
              {report.sqlLoads.length > 0 && <section className="deep-section" aria-labelledby="oracle-sql-heading">
                <div className="section-heading"><div><p className="eyebrow">VERİTABANI SQL</p><h2 id="oracle-sql-heading">Yük oluşturan ifadeler</h2></div><span>{report.sqlLoads.length} rapor satırı</span></div>
                {report.sqlLoadImpact && <p className="data-note">Toplu etki: {report.sqlLoadImpact.impact} · CPU %{report.sqlLoadImpact.cpu} · I/O %{report.sqlLoadImpact.io} · süre %{report.sqlLoadImpact.elapsed}. Kaynak: {report.sqlLoadImpact.source}</p>}
                <div className="sql-record-list">{sqlRows.map((item, index) => <article className="sql-record" key={`${item.source}-${item.object}-${index}`}>
                  <div className="sql-record-head"><span>{sectionBySource(report, item.source)?.number ? `Madde ${sectionBySource(report, item.source)!.number}` : "Veritabanı ölçümü"}</span></div>
                  <h3>{item.object}</h3>
                  <dl className="sql-metrics"><div><dt>Süre payı</dt><dd>%{formatMeasure(item.elapsedPercent, 2)}</dd></div><div><dt>CPU yükü</dt><dd>%{formatMeasure(item.cpuPercent, 2)}</dd></div><div><dt>I/O yükü</dt><dd>%{formatMeasure(item.ioPercent, 2)}</dd></div><div><dt>Çalıştırma</dt><dd>{item.executions}</dd></div><div><dt>İşlenen kayıt</dt><dd>{item.records}</dd></div></dl>
                  <p className="sql-reference">{item.source}</p>
                </article>)}</div>
              </section>}
              {report.sqlServerStatements.length > 0 && <section className="deep-section" aria-labelledby="sql-server-heading">
                <div className="section-heading"><div><p className="eyebrow">SQL SERVER</p><h2 id="sql-server-heading">Pahalı sorgu nesneleri</h2></div><span>{report.sqlServerStatements.length} rapor satırı</span></div>
                <p className="data-note">Rapor bu tabloda SQL metnini vermiyor; nesne adını ve mantıksal okuma ağırlığını gösteriyor.</p>
                <div className="sql-record-list">{report.sqlServerStatements.map((item, index) => <article className="sql-record" key={`${item.source}-${index}`}>
                  <div className="sql-record-head"><span>{sectionBySource(report, item.source)?.number ? `Madde ${sectionBySource(report, item.source)!.number}` : "SQL Server ölçümü"}</span><span>Rapor sırası {index + 1}</span></div>
                  <h3>{item.object}</h3>
                  <dl className="sql-metrics"><div><dt>Mantıksal okuma</dt><dd>%{formatMeasure(item.logicalReadsPercent)}</dd></div><div><dt>Fiziksel okuma</dt><dd>%{formatMeasure(item.physicalReadsPercent)}</dd></div><div><dt>CPU süresi</dt><dd>%{formatMeasure(item.cpuPercent)}</dd></div><div><dt>Geçen süre</dt><dd>%{formatMeasure(item.elapsedPercent)}</dd></div><div><dt>Çağrı</dt><dd>{formatMeasure(item.calls)}</dd></div><div><dt>Toplam kayıt</dt><dd>{formatMeasure(item.totalRows)}</dd></div></dl>
                  <p className="sql-reference">{item.source}</p>
                </article>)}</div>
              </section>}
              {report.hanaParameters.length > 0 && <section className="deep-section" aria-labelledby="hana-param-heading">
                <div className="section-heading"><div><p className="eyebrow">07 / HANA YAPILANDIRMASI</p><h2 id="hana-param-heading">Parametre önerileri</h2></div><span>{report.hanaParameters.length} kayıt</span></div>
                <div className="sql-record-list">{report.hanaParameters.map((item, index) => <article className="sql-record" key={`${item.parameter}-${index}`}>
                  <div className="sql-record-head"><span>{item.location}</span>{item.note && <span>SAP Note {item.note}</span>}</div><h3><code>{item.parameter}</code></h3>
                  <dl className="sql-metrics"><div><dt>Mevcut</dt><dd>{item.current}</dd></div><div><dt>Raporda önerilen</dt><dd>{item.recommended}</dd></div></dl>
                </article>)}</div>
                <p className="data-note">Önerilen değeri uygulamadan önce tenant, katman ve ilgili SAP Note ile kontrol edin.</p>
              </section>}
            </div>}
          </section> : <div className="analysis-empty" aria-live="polite" aria-busy={working}>
            <FileText size={25} aria-hidden="true" />
            <h2>{working ? "Rapor okunuyor…" : error ? "Bu dosya için analiz oluşturulamadı" : "Analiz için rapor seçin"}</h2>
            <p>{working ? "Dosyanın metni ve kontrol bölümleri çıkarılıyor." : error ? "Önceki raporun bulguları gösterilmiyor. Hata açıklamasını kontrol edip dosyayı yeniden seçin." : "EWA veya aylık bakım raporunu yüklediğinde sonuç burada görünecek."}</p>
          </div>}
          <footer className="workspace-footer">Karar vermeden önce kaynak rapordaki tablo ve grafiklerle sayıları karşılaştırın. <span>EWA Radar v22</span></footer>
        </div>
      </main>
    </div>
  );
}
