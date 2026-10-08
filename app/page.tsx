"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Activity, ArrowDownToLine, ArrowRight, Check, ChevronDown, CircleAlert, Clipboard, Database, FileSpreadsheet, FileText, Home as HomeIcon, Languages, Layers, LockKeyhole, Search, ShieldCheck, TriangleAlert, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeEwa, toMarkdown, type EwaReport, type Finding } from "@/lib/ewa";
import { dateDelta } from "@/lib/lifecycle";
import { sectionBySource, sectionReference } from "@/lib/section-reference";
import { parameterRows, parameterReference } from "@/lib/parameter-presentation";
import { findingEvidence } from "@/lib/finding-evidence";
import { assessDataQuality } from "@/lib/data-quality";
import { kpiPercent, orderedKpis, sectionCoverage } from "@/lib/dashboard-metrics";
import { filterFindings, groupFindingsByOwner, type FindingFilter } from "@/lib/finding-dashboard";
import { systemOverview } from "@/lib/multi-report";
import { browserTranslator, translationDeadline, reportLabel, emptyTranslations, knownSapTranslation, translateText, type LocalTranslator, type TranslatedFinding } from "@/lib/local-translation";
import { prepareOfflineTranslator } from "@/lib/offline-translator";
import { prepareDeviceTranslator } from "@/lib/device-translator";
import { reportTranslationPlan } from "@/lib/translation-plan";
import { findingCopy, type BilingualCopy } from "@/lib/finding-copy";
import { recommendationDisplay, groundedRecommendationSummary } from "@/lib/recommendation-presentation";
import { sapSourceLabel } from "@/lib/sap-terminology";
import { alertPresentation } from "@/lib/alert-presentation";
import { findingSeverityLabel, sourceRatingLabels } from "@/lib/source-severity";
import { shortSqlHash, sqlSourceLabel } from "@/lib/sql-display";

const formatMeasure = (value: number, digits = 0) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits }).format(value);

function FindingCard({ report, finding, index, translation, bilingual }: { report: EwaReport; finding: Finding; index: number; translation?: TranslatedFinding; bilingual: boolean }) {
  const section = sectionReference(report, finding);
  const proof = findingEvidence(report, finding);
  const pair = (original: string | undefined, field: keyof TranslatedFinding): BilingualCopy => {
    if (!original) return { primary: "" };
    return bilingual ? findingCopy(original, translation?.[field], finding.id, field) : { primary: original };
  };
  const title = pair(finding.title, "title");
  const evidence = pair(finding.evidence, "evidence");
  const impact = pair(finding.impact, "impact");
  const cause = pair(finding.cause, "cause");
  const action = pair(finding.action, "action");
  const rating = proof.section?.rating;
  const ratingText = rating === "red" ? "Kırmızı" : rating === "yellow" ? "Sarı" : rating === "green" ? "Yeşil" : "Okunamadı";
  return (
    <article className={`finding-card priority-${finding.priority} source-rating-${finding.sourceRating ?? "maintenance"}`}>
      <span className="finding-index">{String(index + 1).padStart(2, "0")}</span>
      <div className="finding-body">
        <div className="finding-heading">
          <h3>{title.primary}{title.missingTurkish && <small className="source-language-badge">EN · Kaynak</small>}</h3>
          <span className={`priority-tag ${finding.priority} source-rating-${finding.sourceRating ?? "maintenance"}`}>{findingSeverityLabel(finding)}</span>
        </div>
        {finding.severitySource && <p className="severity-origin">{finding.severitySource}</p>}
        <p className="finding-evidence">{evidence.primary}{evidence.missingTurkish && <small className="source-language-badge">EN · Kaynak</small>}</p>
        <div className="finding-meta"><span>{finding.owner}</span>{section?.number && <span>EWA Madde {section.number}{section.page ? ` · s. ${section.page}` : ""}</span>}<span title={finding.source}>{bilingual ? sapSourceLabel(finding.source) : finding.source}</span></div>
        <details className="finding-expanded">
          <summary><span>Öneriyi ve kanıtı incele</span><ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="finding-expanded-inner">
            {title.english && <p className="translation-original-title" lang="en"><strong>Özgün başlık:</strong> {title.english}</p>}
            {evidence.english && <p className="translation-original-line" lang="en"><strong>Özgün ifade:</strong> {evidence.english}</p>}
            {finding.impact && <div className="finding-context"><p><strong>Rapordaki etki:</strong> {impact.primary}</p>{impact.english && <p className="translation-original-line" lang="en">{impact.english}</p>}</div>}
            {finding.cause && <div className="finding-context"><p><strong>Rapordaki neden:</strong> {cause.primary}</p>{cause.english && <p className="translation-original-line" lang="en">{cause.english}</p>}</div>}
            <div className="finding-action"><ArrowRight size={17} aria-hidden="true" /><div><p>{finding.recommendation ? <strong>SAP önerisi · </strong> : null}{action.primary}</p>{action.english && <p className="translation-original-action" lang="en"><span>Özgün İngilizce:</span> {action.english}</p>}</div></div>
            <details className="finding-proof"><summary>Kaynak ve kanıt ayrıntıları</summary>
              <div className="proof-content">
                <div className="proof-facts">
                  <p><strong>Kaynak</strong><span>{proof.section ? `${proof.section.number ? `Madde ${proof.section.number} · ` : "Numara doğrulanamadı · "}${proof.section.path}${proof.section.page ? ` · s. ${proof.section.page}` : ""}` : finding.source}</span></p>
                  {report.kind === "EWA" && <p><strong>Raporun bölüm rengi</strong><span>{proof.section ? ratingText : "Bölüm eşleşmedi"}{proof.alert ? ` · Alert Overview: ${proof.alert.severity === "red" ? "Kırmızı" : "Sarı"}` : ""}</span></p>}
                  <p><strong>Analiz güveni</strong><span>{finding.confidence} · Gösterilen seviye: {findingSeverityLabel(finding)}</span></p>
                </div>
                <p className="proof-note">EWA seviyesi doğrulanan kaynak bölümünden veya birebir eşleşen alarmdan alınır. Okunamayan renkler için seviye atanmaz.</p>
                <div className="proof-source"><strong>Analizde kullanılan kanıt</strong><p>{finding.evidence}</p></div>
                {proof.observation && <div className="proof-source"><strong>Bulguya eşleşen özgün SAP ifadesi</strong><p lang="en">{proof.observation}</p></div>}
                {!proof.observation && proof.sourceStatement && <div className="proof-source"><strong>Kaynak bölümün genel açıklaması (doğrudan kanıt değil)</strong><p lang="en">{proof.sourceStatement}</p></div>}
                {proof.table && <div className="proof-source"><strong>Kaynak tablo · {proof.table.title}</strong><dl>{proof.table.values.filter((cell) => cell.value).map((cell, at) => <div key={`${cell.label}-${at}`}><dt>{cell.label}</dt><dd>{cell.value}</dd></div>)}</dl>{proof.table.omitted > 0 && <small>{proof.table.omitted} sütun daha var; kaynağı inceleyin.</small>}</div>}
                {proof.section && !proof.observation && !proof.table && <p className="proof-note">Kaynak bölüm eşleşti ancak doğrudan tablo satırı/alinti eşleşmedi. Orijinal rapordan doğrulayın.</p>}
                {!proof.section && report.kind === "EWA" && <p className="proof-note">Tekil EWA maddesi eşleşmedi. Kaynak raporu kontrol edin.</p>}
              </div>
            </details>
          </div>
        </details>
      </div>
    </article>
  );
}

function KpiMetric({ metric, turkish = false }: { metric: EwaReport["kpis"][number]; turkish?: boolean }) {
  const percent = kpiPercent(metric);
  const tone = /HANA/i.test(metric.label) ? "amber" : /SQL.*süre|CPU/i.test(metric.label) ? "coral" : /DATA|disk/i.test(metric.label) ? "sky" : "blue";
  return <div className={`metric-rail metric-${tone}`}>
    <div className="metric-rail-head"><span>{turkish ? reportLabel(metric.label, true) : metric.label}</span><strong>{turkish ? reportLabel(metric.value, true) : metric.value}</strong></div>
    {metric.note && <small>{turkish ? reportLabel(metric.note, true) : metric.note}</small>}
    {percent !== null && <div className="metric-ratio"><div className="metric-track" role="progressbar" aria-label={`${metric.label} için rapordaki oran`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><span style={{ width: `${percent}%` }} /></div><span className="metric-ratio-label">%{percent.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span></div>}
  </div>;
}

function SqlPanel({ title, items, metric }: { title: string; items: EwaReport["sqlHotspots"]; metric: "elapsedSeconds" | "memoryPerExecutionMb" | "cpuPeakSamples" }) {
  const unit = metric === "elapsedSeconds" ? "sn" : metric === "memoryPerExecutionMb" ? "MB / çalıştırma" : "örnek";
  return <div className="sql-panel">
    <div className="sql-panel-title"><h3>{title}</h3><span>{items.length} ölçüm</span></div>
    {items.length ? <div className="sql-table-scroll"><table className="sql-overview-table">
      <thead><tr><th scope="col">Sıra</th><th scope="col">Statement hash / kaynak</th><th scope="col">Ölçüm</th><th scope="col">Çalıştırma</th><th scope="col">Ortalama</th></tr></thead>
      <tbody>{items.map((item, index) => <tr key={`${item.hash}-${index}`}>
        <td data-label="Sıra">{index + 1}</td>
        <th scope="row"><details className="sql-statement-detail"><summary>
          <span className="sql-hash-label" title={item.hash}>{shortSqlHash(item.hash)}</span>
          <span className="sql-source-label">{sqlSourceLabel(item.source)}</span>
          <span className="sql-expand-label">Kaynak / sorgu ayrıntısı</span>
        </summary><div className="sql-disclosure">
          <div><strong>Orijinal statement hash</strong><code>{item.hash}</code></div>
          {item.source && <div><strong>Kaynak SQL veya tablo</strong><pre>{item.source}</pre></div>}
          {item.reportSource && <div><strong>Rapor bölümü</strong><p>{item.reportSource}</p></div>}
          {item.origin && <div><strong>Çağıran uygulama</strong><p>{item.origin}</p></div>}
        </div></details></th>
        <td data-label="Ölçüm" className="sql-primary-number"><strong>{formatMeasure(item[metric]!, metric === "cpuPeakSamples" ? 0 : 1)}</strong><small>{unit}</small></td>
        <td data-label="Çalıştırma">{item.executions === undefined ? "—" : formatMeasure(item.executions)}</td>
        <td data-label="Ortalama">{item.averageMs === undefined ? "—" : `${formatMeasure(item.averageMs, 1)} ms`}</td>
      </tr>)}</tbody>
    </table></div> : <p className="sql-empty">Bu ölçüm raporda okunamadı.</p>}
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
  const [translations, setTranslations] = useState(emptyTranslations);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationReady, setTranslationReady] = useState(false);
  const [translationWorking, setTranslationWorking] = useState(false);
  const [translationStatus, setTranslationStatus] = useState("");
  const [translationCoverage, setTranslationCoverage] = useState({ total: 0, ready: 0, unresolved: 0 });
  const [recommendationFilter, setRecommendationFilter] = useState<"all" | "red" | "yellow" | "green" | "unknown">("all");
  const [recommendationQuery, setRecommendationQuery] = useState("");
  const [findingQuery, setFindingQuery] = useState("");
  const [findingFilter, setFindingFilter] = useState<FindingFilter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const loadSequence = useRef(0);
  const translatorRef = useRef<LocalTranslator | null>(null);
  const translationCache = useRef(new Map<string, string>());
  const translationStarted = useRef(false);
  const modelController = useRef<AbortController | null>(null);
  const offlineEngine = useRef(false);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  useEffect(() => () => { modelController.current?.abort(); translatorRef.current?.destroy?.(); }, []);
  function cancelTranslation() {
    ++loadSequence.current;
    modelController.current?.abort();
    translatorRef.current?.destroy?.();
    translatorRef.current = null;
    translationStarted.current = false;
    setTranslationWorking(false);
    setModelProgress(null);
    setTranslationStatus("Çeviri durduruldu. Hazır çeviriler ve kaynak rapor korundu.");
  }

  function clearWorkspace() {
    cancelTranslation();
    translationCache.current.clear();
    setReport(null); setReports([]); setTranslations(emptyTranslations());
    setShowTranslation(false); setTranslationReady(false);
    setTranslationCoverage({total:0,ready:0,unresolved:0});
    setTranslationStatus(""); setError(""); setLoadStatus(""); setWorking(false);
    setFindingQuery(""); setRecommendationQuery(""); setFindingFilter("all");
    if(inputRef.current) inputRef.current.value = "";
  }
  function showReport(target: EwaReport) {
    if (target === report) return;
    modelController.current?.abort();
    translatorRef.current?.destroy?.(); translatorRef.current = null;
    setModelProgress(null);
    ++loadSequence.current;
    setReport(target);
    setTranslations(emptyTranslations());
    setShowTranslation(false);
    setTranslationReady(false);
    setTranslationCoverage({ total: 0, ready: 0, unresolved: 0 });
    setTranslationStatus("");
    setTranslationWorking(false);
    translationStarted.current = false;
    setRecommendationFilter("all");
    setRecommendationQuery("");
    setFindingQuery("");
    setFindingFilter("all");
  }

  async function loadFiles(files: File[]) {
    if (!files.length) return;
    modelController.current?.abort();
    translatorRef.current?.destroy?.(); translatorRef.current = null;
    setModelProgress(null);
    const sequence = ++loadSequence.current;
    setReport(null);
    setReports([]);
    setTranslations(emptyTranslations());
    setShowTranslation(false);
    setTranslationReady(false);
    setTranslationCoverage({ total: 0, ready: 0, unresolved: 0 });
    setTranslationStatus("");
    setTranslationWorking(false);
    translationStarted.current = false;
    setRecommendationFilter("all");
    setRecommendationQuery("");
    setFindingQuery("");
    setFindingFilter("all");
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
  async function translateReport(target: EwaReport, useOfflineModel = false) {
    if (translationStarted.current) return;
    const sequence = loadSequence.current;
    if(useOfflineModel && !offlineEngine.current) { translatorRef.current?.destroy?.(); translatorRef.current = null; }
    translationStarted.current = true;
    setTranslationWorking(true);
    setModelProgress(null);
    setShowTranslation(true);
    const { reviewed, tasks } = reportTranslationPlan(target);
    if (sequence !== loadSequence.current) return;
    setTranslations(reviewed);
    const reviewedCount = Object.values(reviewed.findings).reduce((count, item) => count + Object.keys(item).length, 0) + Object.keys(reviewed.recommendations).length + Object.keys(reviewed.alerts ?? {}).length + Object.keys(reviewed.decisive ?? {}).length;
    setTranslationCoverage({ total: reviewedCount + tasks.length, ready: reviewedCount, unresolved: tasks.length });
    setTranslationReady(reviewedCount > 0);
    setTranslationStatus(tasks.length ? `Bilinen SAP ifadeleri Türkçeleştirildi (${reviewedCount}). Kalan İngilizce metinler için cihazdaki çeviri özelliği kontrol ediliyor.` : "Türkçe açıklamalar hazır; SAP metinlerinin orijinali korunuyor.");
    if (!tasks.length) { setTranslationWorking(false); translationStarted.current = false; return; }
    try {
      let translator = translatorRef.current;
      if (!translator) {
        modelController.current?.abort();
        const controller = new AbortController();
        modelController.current = controller;
        setModelProgress(0);
        setTranslationStatus("Cihazdaki İngilizce–Türkçe model hazırlanıyor. İlk kullanımda dil paketi indirilir; rapor metni gönderilmez.");
        const progress = (fraction: number) => { if (sequence === loadSequence.current) setModelProgress(fraction); };
        if(useOfflineModel) {
          setTranslationStatus("Yerel model indiriliyor (yaklaşık 540 MB). İlk hazırlık birkaç dakika sürebilir. Rapor metni dışarı gönderilmez.");
          translator = await prepareOfflineTranslator(controller.signal, progress);
          offlineEngine.current = true;
        } else {
          translator = await prepareDeviceTranslator(browserTranslator(), { signal: controller.signal, onProgress: progress });
          offlineEngine.current = false;
        }
        if (sequence !== loadSequence.current) { translator.destroy?.(); return; }
        setModelProgress(null);
        translatorRef.current = translator;
      }
      if (sequence !== loadSequence.current) return;
      const cache = translationCache.current;
      let failed = 0;
      let completed = 0;
      let translatedCount = reviewedCount;
      const deadline = Date.now() + 600000;
      for (const task of tasks) {
        if (Date.now() > deadline) { failed += tasks.length - completed; break; }
        if (sequence !== loadSequence.current) return;
        try {
          let result = cache.get(task.original);
          if (result === undefined) { result = await translationDeadline(translateText(translator, task.original), offlineEngine.current ? 180000 : 20000); if (result !== task.original) cache.set(task.original, result); }
          if (sequence !== loadSequence.current) return;
          if (result !== task.original) {
            translatedCount += 1;
            if (task.kind === "finding") setTranslations((previous) => ({ ...previous, findings: { ...previous.findings, [task.index]: { ...previous.findings[task.index], [task.field]: result } } }));
            else if (task.kind === "recommendation") setTranslations((previous) => ({ ...previous, recommendations: { ...previous.recommendations, [task.index]: result } }));
            else if (task.kind === "alert") setTranslations((previous) => ({ ...previous, alerts: { ...previous.alerts, [task.index]: result } }));
            else setTranslations((previous) => ({ ...previous, decisive: { ...previous.decisive, [task.index]: result } }));
          } else failed += 1;
        } catch {
          failed += tasks.length - completed;
          translator.destroy?.(); translatorRef.current = null;
          break;
        }
        completed += 1;
        if (sequence === loadSequence.current) setTranslationStatus(`Türkçe çeviri: ${completed}/${tasks.length}${failed ? ` · ${failed} metin özgün bırakıldı` : ""}`);
        if (sequence === loadSequence.current) setTranslationCoverage({ total: reviewedCount + tasks.length, ready: translatedCount, unresolved: tasks.length - completed + failed });
      }
      if (sequence !== loadSequence.current) return;
      setTranslationReady(translatedCount > 0);
      setTranslationCoverage({ total: reviewedCount + tasks.length, ready: translatedCount, unresolved: failed });
      setTranslationStatus(failed ? `Türkçe gösterilen metin: ${translatedCount}. Çevrilemeyen ${failed} metnin özgün SAP İngilizcesi korunuyor.` : `Türkçe gösterilen metin: ${translatedCount}. Kaynak SAP İngilizcesi korunuyor.`);
    } catch (caught) {
      if (sequence === loadSequence.current) {
        setTranslationStatus(caught instanceof Error ? caught.message : "Yerel çeviri başlatılamadı; Türkçe teknik açıklamalar ve İngilizce kaynak korunuyor.");
      }
    } finally {
      if (sequence === loadSequence.current) { setTranslationWorking(false); setModelProgress(null); translationStarted.current = false; }
    }
  }
  function toggleTranslation() {
    if (!report || translationWorking) return;
    if (showTranslation) {
      setShowTranslation(false);
      setTranslationStatus("Kaynak metin ve uygulamanın özgün analizi gösteriliyor.");
    } else if (translationReady) {
      setShowTranslation(true);
      setTranslationStatus("Türkçe üstte, özgün İngilizce hemen altında.");
    } else void translateReport(report);
  }
  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); void loadFiles(Array.from(event.dataTransfer.files)); }
  async function copy() {
    if (!report) return;
    try { await navigator.clipboard.writeText(toMarkdown(report, showTranslation ? translations : emptyTranslations())); setCopied(true); window.setTimeout(() => setCopied(false), 2400); }
    catch { setError("Panoya kopyalanamadı. Markdown dosyasını indirebilirsiniz."); }
  }
  function download() {
    if (!report) return;
    const blob = new Blob([toMarkdown(report, showTranslation ? translations : emptyTranslations())], { type: "text/markdown;charset=utf-8" });
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
      const blob = await createActionWorkbook(report, showTranslation ? translations : emptyTranslations());
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
  const high = report?.findings.filter((item) => item.priority === "yuksek").length ?? 0;
  const others = report ? report.findings.length - critical - high : 0;
  const visibleFindings = filterFindings(report?.findings ?? [], findingFilter, findingQuery, translations.findings);
  const ownerGroups = groupFindingsByOwner(report?.findings ?? []);
  const maxOwnerFindings = Math.max(1, ...ownerGroups.map((item) => item.total));
  const recommendationCounts = {
    all: report?.recommendations.length ?? 0,
    red: report?.recommendations.filter((item) => item.rating === "red").length ?? 0,
    yellow: report?.recommendations.filter((item) => item.rating === "yellow").length ?? 0,
    green: report?.recommendations.filter((item) => item.rating === "green").length ?? 0,
    unknown: report?.recommendations.filter((item) => item.rating === "unknown").length ?? 0,
  };
  const visibleRecommendations = report?.recommendations.map((item, index) => ({ item, index })).filter(({ item, index }) => {
    if (recommendationFilter === "red" && item.rating !== "red") return false;
    if (recommendationFilter === "yellow" && item.rating !== "yellow") return false;
    if (recommendationFilter !== "all" && item.rating !== recommendationFilter) return false;
    const query = recommendationQuery.trim().toLocaleLowerCase("tr-TR");
    return !query || [item.source, item.text, showTranslation ? translations.recommendations[index] || knownSapTranslation(item.text) || groundedRecommendationSummary(item.text) || "" : ""].some((part) => part.toLocaleLowerCase("tr-TR").includes(query));
  }) ?? [];
  const sqlRows = report ? [...report.sqlLoads].sort((a, b) => a.source.localeCompare(b.source) || b.elapsedPercent - a.elapsedPercent) : [];
  const quality = report ? assessDataQuality(report) : null;
  const orderedMetrics = report ? orderedKpis(report.kpis) : [];
  const coverage = report ? sectionCoverage(report.sections) : null;
  const overview = systemOverview(reports);

  return (
    <div className="app-shell noir-shell architect-shell modern-shell" data-has-report={Boolean(report)}>
      <aside className="noir-sidebar" aria-label="Ana gezinme">
        <a className="noir-logo" href="#ust"><img src="/sap-logo.svg" width="72" height="36" alt="SAP logosu" decoding="async" /><span><strong>EWA RADAR</strong><small>Basis çalışma alanı · v51</small></span></a>
        <nav className="noir-side-nav">
          <a href="#ust"><HomeIcon size={18} aria-hidden="true" /> Genel bakış</a>
          {report && <><a href="#bulgular"><TriangleAlert size={18} aria-hidden="true" /> Bulgular</a><a href="#sayilar"><Database size={18} aria-hidden="true" /> Sistem metrikleri</a>{report.kind === "EWA" && <a href="#quality-heading"><ShieldCheck size={18} aria-hidden="true" /> Veri kalitesi</a>}{report.recommendations.length > 0 && <a href="#sap-onerileri"><Layers size={18} aria-hidden="true" /> SAP önerileri</a>}</>}
          {reports.length > 1 && <a href="#sistemler"><Layers size={18} aria-hidden="true" /> Yüklenen raporlar</a>}
          <button type="button" onClick={() => inputRef.current?.click()}><UploadCloud size={18} aria-hidden="true" /> Yeni rapor aç</button>
        </nav>
        {report && <button type="button" className="clear-workspace" onClick={clearWorkspace}>Raporları oturumdan temizle</button>}
        <div className="noir-sidebar-bottom"><div className="noir-sidebar-line" /><strong>Kaynağı belli. Verisi yerel.</strong><span>Kaynağı görünür karar desteği.</span><p><LockKeyhole size={13} aria-hidden="true" /> Rapor dosyaları cihazda işlenir.</p></div>
      </aside>
      <header className="site-header">
        <div className="header-inner">
          <details className="noir-mobile-menu">
            <summary aria-label="Gezinme menüsünü aç"><span className="menu-lines" aria-hidden="true"><i /><i /><i /></span><span>Menü</span></summary>
            <nav aria-label="Mobil gezinme" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>
              <a href="#ust">Genel bakış</a>
              {report && <><a href="#bulgular">Bulgular</a><a href="#sayilar">Sistem metrikleri</a>{report.kind === "EWA" && <a href="#quality-heading">Veri kalitesi</a>}{report.recommendations.length > 0 && <a href="#sap-onerileri">SAP önerileri</a>}</>}
              {reports.length > 1 && <a href="#sistemler">Yüklenen raporlar</a>}
              <a href="#rapor-yukle">Yeni rapor aç</a>
            </nav>
          </details>
          <a className="header-brand" href="#ust" aria-label="EWA Radar · Sayfa başı">
            <span className="brand-title">EWA RADAR<small>SAP SİSTEMLERİ İÇİN ANALİZ VE TAKİP</small></span>
          </a>
          <nav className="header-nav" aria-label="Sayfa bölümleri">
            <a href={report ? "#analiz" : "#rapor-yukle"} className="nav-primary">Sistem analizi</a>
            {reports.length > 1 && <a href="#sistemler">Sistemler</a>}
            {report && <><a href="#bulgular">Bulgular</a><a href="#sayilar">Ölçümler</a>{report.kind === "EWA" && report.recommendations.length > 0 && <a href="#sap-onerileri">SAP önerileri</a>}</>}
          </nav>
          <div className="header-tools">
            {report && <label className="noir-header-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Bulgular içinde ara</span><input type="search" placeholder="Bulgularda ara…" value={findingQuery} onChange={(event) => setFindingQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") document.getElementById("bulgular")?.scrollIntoView({ behavior: "smooth" }); }} /></label>}
            <button className="header-upload" type="button" disabled={working} onClick={() => inputRef.current?.click()}><UploadCloud size={16} aria-hidden="true" /> {working ? "İşleniyor" : "Rapor yükle"}</button>
          </div>
        </div>
      </header>
      <main className="workspace" id="ust">
        <div className="workspace-content">
          <section className="editorial-hero" aria-label="EWA Radar rapor özet alanı">
            <div className="hero-geometry" aria-hidden="true" />
            <div className="hero-copy">
              <p className="eyebrow">{report ? "ANALİZ SONUÇLARI" : "EARLYWATCH ANALYTICS"}</p>
              <h1>{report ? "Sistem sağlığını tek ekranda görün" : "SAP sistemlerinizin sağlığını görün"}</h1>
              <p>{report ? "Raporunuzdan okunan ölçümleri, doğrulanabilir bulguları ve teknik önerileri tek çalışma alanında inceleyin." : "EarlyWatch Alert ve aylık bakım raporlarını tarayıcınızda analiz edin; bulgulara, kaynağına ve teknik önerilere ulaşın."}</p>
              <span className="hero-rule" aria-hidden="true" />
            </div>
            <div className="hero-side">
              <div className="hero-report-card" aria-label="Rapor özeti">
                <div><FileText size={18} aria-hidden="true" /><span><small>{report ? "Rapor dönemi" : "Dosya formatları"}</small><strong>{report ? report.period : "PDF · DOCX · SAP DOC"}</strong></span></div>
                <div><Activity size={18} aria-hidden="true" /><span><small>{report ? "Analiz kapsamı" : "Analiz yöntemi"}</small><strong>{report ? (coverage?.total ? `%${coverage.percent} · ${coverage.withContent}/${coverage.total} bölüm` : `${report.sections.length} bölüm okundu`) : "Tarayıcı üzerinde"}</strong></span></div>
              </div>

            </div>
          </section>

          <section className={`upload-panel${report ? " upload-panel-compact" : ""}`} id="rapor-yukle" aria-labelledby="upload-heading">
            <div className="upload-copy"><div className="upload-icon"><UploadCloud size={23} aria-hidden="true" /></div><div><h2 id="upload-heading">{report ? "Başka rapor analiz et" : "Raporlarınızı yükleyin"}</h2><p>PDF, DOCX, SAP Word XML ve HTML · En fazla 12 dosya · Dosya başına 25 MB</p></div></div>
            <div className="upload-actions"><input ref={inputRef} className="sr-only" type="file" multiple accept=".pdf,.doc,.docx,.htm,.html" aria-label="EWA dosyalarını seç" onChange={(event) => void loadFiles(Array.from(event.target.files ?? []))} /><Button className="upload-button" disabled={working} onClick={() => inputRef.current?.click()}>{working ? "Analiz ediliyor…" : report ? "Yeni dosya seç" : "Dosya seç"}<ArrowRight size={17} aria-hidden="true" /></Button></div>
            <div className="drop-layer" onDragOver={(event) => event.preventDefault()} onDrop={drop} aria-hidden="true" />
          </section>
          {!report && !working && !error && <div className="welcome-features" aria-label="Analiz özellikleri">
            <div><span>01</span><strong>Kaynakla doğrulanan bulgular</strong><p>Öncelikli sonuçları rapordaki bölüm ve ölçümlerle birlikte inceleyin.</p></div>
            <div><span>02</span><strong>Önemli ölçümler tek ekranda</strong><p>Sürüm, bellek, SQL ve diğer rapor KPI’larına hızlı erişin.</p></div>
            <div><span>03</span><strong>Orijinal SAP metni</strong><p>Çevrilen açıklamaların yanında SAP’nin özgün ifadelerine ulaşın.</p></div>
          </div>}
          {loadStatus && <div className="load-status" role="status">{loadStatus}</div>}
          {error && <div className="error-banner" role="alert"><CircleAlert size={18} aria-hidden="true" /><div><strong>{/OCR|PDF metni çıkarılamadı/i.test(error) ? "Taranmış PDF · OCR gerekli" : "Dosya kontrolü"}</strong><p>{error}</p></div></div>}

          {reports.length > 1 && <section className="system-overview" id="sistemler" aria-label="Yüklenen sistemlerin özeti">
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

          {report ? <section className="analysis-section" id="analiz" aria-live="polite" aria-busy={working}>
            <div className="analysis-topline">
              <div><p className="eyebrow">{report.kind === "EWA" ? "EWA ANALİZİ" : "AYLIK BAKIM ANALİZİ"}</p><h2>{report.sid} <span>/ {report.period}</span></h2><p className="source-file"><FileText size={16} aria-hidden="true" />{report.filename} · {report.format}{report.product ? ` · ${report.product}` : ""}{report.database ? ` · ${report.database}` : ""}</p></div>
              <div className="result-actions">
                <Button variant="outline" className="secondary-button" onClick={clearWorkspace}>Oturumu temizle</Button>
                <Button variant="outline" className="secondary-button" disabled={translationWorking} onClick={toggleTranslation}><Languages size={16} />{showTranslation ? "Özgün metni göster" : "Türkçeyi göster"}</Button>
                <Button variant="outline" className="secondary-button" disabled={translationWorking} onClick={() => void copy()}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Kopyalandı" : "Özeti kopyala"}</Button>
                <Button variant="outline" className="secondary-button" disabled={translationWorking} onClick={download}><ArrowDownToLine size={16} /> Markdown indir</Button>
                <Button variant="outline" className="secondary-button" disabled={excelWorking || translationWorking} onClick={() => void downloadExcel()}><FileSpreadsheet size={16} />{excelWorking ? "Excel hazırlanıyor…" : "Excel indir"}</Button>
              </div>
            </div>
            <section className={`translation-hub${showTranslation && translationCoverage.unresolved ? " has-pending" : ""}`} aria-label="Teknik çeviri durumu">
              <div className="translation-hub-title"><Languages size={19} aria-hidden="true"/><div><strong>{showTranslation ? "Teknik Türkçe · İngilizce kaynak" : "Özgün SAP metni"}</strong><small>İlk Türkçe kullanımında cihazınıza dil paketi indirilebilir. dump, kernel, partitioning ve parametre adları korunur.</small></div></div>
              {showTranslation && <div className="translation-hub-metrics" aria-live="polite">
                <span>{translationCoverage.ready} / {translationCoverage.total} Türkçe metin</span>
                {translationCoverage.unresolved > 0 && <span className="translation-pending">{translationCoverage.unresolved} özgün İngilizce metin</span>}
              </div>}
              <p className="translation-note" role="status">{showTranslation ? translationStatus || "Türkçe açıklamalar hazırlanıyor." : "Özgün SAP metni gösteriliyor. Türkçe görünüm için yukarıdaki düğmeye basın."}</p>
              {showTranslation && !translationWorking && translationCoverage.unresolved > 0 && <button type="button" className="secondary-button" onClick={() => void translateReport(report)}>Eksik çevirileri yeniden dene</button>}
              {showTranslation && !translationWorking && translationCoverage.unresolved > 0 && <div className="offline-option"><button className="secondary-button" type="button" onClick={() => void translateReport(report, true)}>Bağımsız yerel modelle çevir</button><small>İlk kullanımda yaklaşık 540 MB model indirilir. Sonraki kullanımlarda tarayıcı önbelleği kullanılır. Çeviri cihazda yapılır. OPUS-MT / Helsinki-NLP · CC BY 4.0.</small></div>}
              {modelProgress !== null && <div className="model-install" role="status"><strong>Dil paketi hazırlanıyor · %{Math.round(modelProgress * 100)}</strong><progress max={1} value={modelProgress} aria-label="Dil paketi indirme ilerlemesi" /><small>Yalnızca model dosyaları indirilir. EWA içeriği cihazınızda kalır.</small></div>}
              {translationWorking && <button className="secondary-button" type="button" onClick={cancelTranslation}>Çeviriyi durdur</button>}
              {translationWorking && <div className="translation-progress" role="status"><span className="translation-spinner" aria-hidden="true"/>Türkçe açıklamalar hazırlanıyor.</div>}
              {showTranslation && translationCoverage.unresolved > 0 && <small className="translation-hub-foot">Cihazdaki model ve SAP sözlüğü birlikte kullanılır. Teknik kontrolden geçmeyen metinler özgün bırakılır. Yerel model çevirilerini İngilizce kaynakla karşılaştırabilirsiniz.</small>}
            </section>
            {report.kind === "EWA" && <aside className="severity-guide" aria-label="Seviyeler nasıl okunur"><strong>Listelerdeki sayılar neden farklı?</strong><p><b>{report.decisive.length} kırmızı rapor nedeni</b> genel rapor sonucunu açıklar. <b>{report.alerts.items.length} alarm</b> SAP Alarm Özeti kayıtlarıdır. <b>{report.recommendations.length} öneri</b> bölüm bazındaki SAP talimatlarıdır. Aşağıdaki bulgular ise kanıt ve aksiyonları bir araya getirir; bu sayılar toplanmaz.</p><p>Kırmızı = Kritik · Sarı = Uyarı · Yeşil = Normal · Gri = Seviye okunamadı. Aynı kaynak bölümünü kullanan bulgu ve öneri aynı seviyeyi gösterir.</p></aside>}
            <div className="signal-grid noir-signals" aria-label="Rapor özet göstergeleri">
              <div className="signal-card signal-critical"><div className="signal-icon"><CircleAlert size={19} aria-hidden="true" /></div><div className="signal-label">Kritik bulgular</div><strong>{critical}</strong><div className="signal-bottom">Kaynakta kırmızı doğrulananlar</div><div className="signal-mini-bars" aria-hidden="true" /></div>
              <div className="signal-card signal-high"><div className="signal-icon"><TriangleAlert size={19} aria-hidden="true" /></div><div className="signal-label">Sarı seviyeli bulgular</div><strong>{high}</strong><div className="signal-bottom">Takip edilmesi gerekenler</div><div className="signal-mini-bars" aria-hidden="true" /></div>
              <div className="signal-card signal-other"><div className="signal-icon"><FileText size={19} aria-hidden="true" /></div><div className="signal-label">Diğer bulgular</div><strong>{others}</strong><div className="signal-bottom">Normal veya seviyesi okunamayan</div><div className="signal-mini-bars" aria-hidden="true" /></div>
              <div className="signal-card signal-coverage"><div className="signal-icon"><Layers size={19} aria-hidden="true" /></div><div className="signal-label">{coverage?.total ? "Bölüm kapsamı" : "Okunan KPI"}</div><strong>{coverage?.total ? `${coverage.withContent}/${coverage.total}` : report.kpis.length}</strong><div className="signal-bottom">{coverage?.total ? "İçeriği eşleşen / başlığı okunan" : "Raporun sayısal ölçümleri"}</div>{coverage?.percent !== null && coverage?.percent !== undefined && <span className="signal-donut" style={{ background: `conic-gradient(#52c7aa ${coverage.percent}%, #314b62 ${coverage.percent}% 100%)` }} aria-hidden="true" />}</div>
            </div>


            {report.kind === "EWA" && (report.componentCount !== null || report.lifecycle.length > 0) && <nav className="software-brief" aria-label="Yazılım bakımı ve sürümler">
              <div><span>Komponentler</span><strong>{report.componentCount === null ? "Tablo okunamadı" : `${report.componentCount} incelendi · ${report.componentUpdates.length} seviye farkı`}</strong><a href="#component-heading">Tabloyu gör <ArrowRight size={14} aria-hidden="true" /></a></div>
              <div><span>Ürün bakımı</span><strong>{report.lifecycle.find((item) => item.area === "SAP ürünü")?.name ?? "Rapor kaydı yok"}</strong><small>{report.lifecycle.find((item) => item.area === "SAP ürünü")?.endDate || "Tarih okunamadı"}</small>{report.lifecycle.length > 0 && <a href="#lifecycle-heading">Tarihleri gör <ArrowRight size={14} aria-hidden="true" /></a>}</div>
            </nav>}

            <div className="analysis-columns">
              <div className="main-column" id="bulgular">
                <div className="section-heading"><div><p className="eyebrow">01 / ANALİZ</p><h2>Bulgular</h2></div><span>{visibleFindings.length} / {report.findings.length} bulgu</span></div>
                <div className="noir-findings-tools">
                  <div className="noir-filters" role="group" aria-label="Bulguları önceliğe göre filtrele">
                    {(report.kind === "EWA" ? [["all", "Tümü", report.findings.length], ["kritik", "Kritik · Kırmızı", critical], ["yuksek", "Uyarı · Sarı", high], ["green", "Normal · Yeşil", report.findings.filter(item => item.sourceRating === "green").length], ["unknown", "Seviye okunamadı", report.findings.filter(item => item.sourceRating === "unknown").length]] as const : [["all", "Tümü", report.findings.length], ["kritik", "Kritik", critical], ["yuksek", "Yüksek", high], ["other", "Diğer", others]] as const).map(([id, title, count]) => <button type="button" key={id} aria-pressed={findingFilter === id} onClick={() => setFindingFilter(id)}>{title} <span>{count}</span></button>)}
                  </div>
                  <label className="noir-findings-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Bulgu, kaynak veya öneride ara</span><input type="search" value={findingQuery} onChange={(event) => setFindingQuery(event.target.value)} placeholder="Bulgularda ara…" /></label>
                </div>
                <div className="noir-findings-head" aria-hidden="true"><span>No</span><span>Bulgu ve rapor ifadesi</span><span>Öncelik</span><span>Ayrıntı</span></div>
                <div className="findings">{visibleFindings.length ? visibleFindings.map(({ finding, index }) => <FindingCard key={finding.id + index} report={report} finding={finding} translation={translations.findings[index]} bilingual={showTranslation} index={index} />) : <div className="empty-card">{report.findings.length ? "Bu arama veya filtreyle eşleşen bulgu bulunamadı." : "Bu rapordan güvenilir aksiyon çıkarılamadı. Kaynak dosyayı inceleyin."}</div>}</div>
                <p className="noir-evidence-note">Her bulgunun kaynak bölümü ve varsa kanıtı, ayrıntıları açtığınızda gösterilir.</p>
              </div>
              <aside className="detail-column" id="sayilar" aria-label="Sistem metrikleri ve analiz kapsamı">
                <section className="detail-card metric-dashboard" aria-labelledby="metric-dashboard-heading">
                  <div className="side-panel-heading"><div><Activity size={20} aria-hidden="true"/><h2 id="metric-dashboard-heading">Sistem metrikleri</h2></div><span className="metric-count">{orderedMetrics.length} ölçüm</span></div>
                  <p className="metric-intro">Rapordaki ölçümler ve ölçüm kapsamı</p>
                  <div className="metric-dashboard-list">{orderedMetrics.length ? orderedMetrics.map((metric, index) => <KpiMetric key={`${metric.label}-${index}`} metric={metric} turkish={showTranslation} />) : <p className="metric-no-data">Bu raporda görüntülenebilen KPI bulunamadı.</p>}</div>
                  <p className="metric-disclaimer">Değerler rapor dönemine aittir. Oran çubuğu yalnızca karşılaştırılabilir ölçümlerde gösterilir.</p>
                </section>
                {report.kind === "EWA" && coverage && <section className="detail-card coverage-dashboard" aria-labelledby="coverage-dashboard-heading">
                  <div className="side-panel-heading"><div><Activity size={18} aria-hidden="true"/><h2 id="coverage-dashboard-heading">Bölüm kapsamı</h2></div></div>
                  {coverage.total ? <><div className="coverage-main">
                    <div className="coverage-donut" role="img" aria-label={`${coverage.total} bölümden ${coverage.withContent} bölümde içerik eşleşti`} style={{ background: `conic-gradient(#58ae90 ${coverage.percent}%, #e2e5e2 ${coverage.percent}% 100%)` }}>
                      <div><strong>{coverage.withContent} / {coverage.total}</strong><span>içerik eşleşen bölüm</span></div>
                    </div>
                    <div className="coverage-legend"><div><i className="legend-content"/><span>İçerik eşleşti</span><strong>{coverage.withContent}</strong></div><div><i className="legend-heading"/><span>Yalnızca başlık</span><strong>{coverage.headingsOnly}</strong></div></div>
                  </div><p className="coverage-note">Başlığı okunan ancak içeriği eşleşmeyen bölümler otomatik olarak hatalı sayılmaz.</p></> : <p className="metric-no-data">Bölüm kapsamı bu raporda belirlenemedi.</p>}
                </section>}
                {quality && <section className={`detail-card quality-compact${quality.issues.length ? " has-issues" : ""}`} aria-labelledby="quality-compact-heading">
                  <div className="side-panel-heading"><div>{quality.issues.length ? <CircleAlert size={18} aria-hidden="true"/> : <Check size={18} aria-hidden="true"/>}<h2 id="quality-compact-heading">Veri kalitesi</h2></div></div>
                  <div className="quality-compact-status"><span>{quality.issues.length ? <CircleAlert size={17} aria-hidden="true"/> : <Check size={17} aria-hidden="true"/>}</span><div><strong>{quality.issues.length ? `${quality.issues.length} kontrol noktası var` : "Temel kontroller başarılı"}</strong><p>{quality.issues.length ? "Bazı alanların kaynak rapordan doğrulanması gerekiyor." : "Temel rapor alanları okunabildi."}</p></div></div>
                  <a href="#quality-heading">Kontrol ayrıntılarını incele <ArrowRight size={14} aria-hidden="true"/></a>
                </section>}
              </aside>
            </div>
            {ownerGroups.length > 0 && <section className="noir-breakdown" aria-labelledby="noir-breakdown-heading">
              <div className="section-heading"><div><p className="eyebrow">BULGU DAĞILIMI</p><h2 id="noir-breakdown-heading">Sorumlu alanlara göre bulgular</h2></div><span>Rapordaki {report.findings.length} bulgu</span></div>
              <div className="noir-breakdown-legend"><span><i className="tone-critical" /> Kritik</span><span><i className="tone-high" /> Yüksek</span><span><i className="tone-other" /> Diğer</span></div>
              <div className="noir-breakdown-grid">{ownerGroups.map((group) => <div className="noir-breakdown-row" key={group.label}><span title={group.label}>{group.label}</span><div className="noir-stacked-track" role="img" aria-label={`${group.label}: ${group.critical} kritik, ${group.high} yüksek, ${group.other} diğer, toplam ${group.total}`}><i className="tone-critical" style={{ width: `${group.critical / maxOwnerFindings * 100}%` }} /><i className="tone-high" style={{ width: `${group.high / maxOwnerFindings * 100}%` }} /><i className="tone-other" style={{ width: `${group.other / maxOwnerFindings * 100}%` }} /></div><strong>{group.total}</strong></div>)}</div>
              <p>Dağılım yalnızca yüklenen rapordan çıkarılan bulgulara dayanır; önceki rapora göre değişim hesaplanmaz.</p>
            </section>}
            {quality && <section className={`quality-panel${quality.issues.length ? " needs-review" : ""}`} aria-labelledby="quality-heading">
              <div className="quality-heading">
                <div><p className="eyebrow">VERİ KALİTESİ</p><h2 id="quality-heading">{quality.issues.length ? `${quality.issues.length} kontrol noktası var` : "Temel alanlar okundu"}</h2></div>
                <span >{report.format} · {report.extractedLines} metin satırı</span>
              </div>
              <div className="quality-checks">{quality.checks.map((check) =>
                <div key={check.label} className={`quality-check ${check.state}`} >
                  <span >{check.label}</span><strong >{check.value}</strong>
                </div>
              )}</div>
              {quality.issues.length > 0 && <ul className="quality-issues">{quality.issues.map((issue) =>
                <li key={issue.title} ><CircleAlert size={16} aria-hidden="true"  />
                  <div><strong >{issue.title}</strong><p >{issue.detail}</p></div>
                </li>
              )}</ul>}
              <details className="quality-notes">
                <summary >Rapordan gelen diğer doğrulama notları ({report.caveats.length})</summary>
                {report.caveats.length ? <ul>{report.caveats.map((caveat, index) => <li key={index}>{caveat}</li>)}</ul> : <p>Ek not yok.</p>}
              </details>
            </section>}

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
                  return <tr key={`${item.name}-${index}`}><th scope="row">{item.name}<small>{item.area}</small></th><td data-label="Mevcut sürüm">{item.installed || "—"}</td><td data-label="Tarih türü">{item.dateLabel || "—"}</td><td data-label="Tarih">{item.endDate || "—"}{item.extendedEnd ? <small>Uzatılmış: {item.extendedEnd}</small> : null}</td><td data-label="Rapor bitişinde">{days(atReport)}</td><td data-label="Bugün">{days(atToday)}</td><td data-label="Durum">{item.status || "—"}</td><td data-label="Kaynak" title={item.source}>{showTranslation ? sapSourceLabel(item.source) : item.source}</td></tr>;
                })}</tbody></table></div><p className="data-note">Tarih hesabı türetilmiştir. Uzatılmış destek için sözleşme ve patch kapsamını ayrıca doğrulayın.</p>
              </section>}
              {report.decisive.length > 0 && <section className="deep-section" aria-labelledby="decisive-heading"><div className="section-heading"><div><p className="eyebrow">RAPORUN ÖNCELİĞİ</p><h2 id="decisive-heading">Kırmızı raporu belirleyen bulgular</h2></div><span>{report.decisive.length} kayıt</span></div><div className="alert-list">{report.decisive.map((item, index) => { const display = alertPresentation(item, translations.decisive?.[index], showTranslation); return <div className="alert-item severity-red" key={`${item}-${index}`}><span className="alert-dot" aria-hidden="true" /><div className="alert-copy"><p lang={showTranslation && !display.untranslated ? "tr" : "en"}>{display.primary}</p>{display.original && <details className="alert-source"><summary>Orijinal SAP metni (EN)</summary><p lang="en">{display.original}</p></details>}{display.untranslated && <small>Özgün SAP metni (EN) · doğrulanmış Türkçe karşılık yok</small>}</div><strong>{sourceRatingLabels.red}</strong></div>; })}</div><p className="data-note">Bu liste raporun neden kırmızı olduğunu açıklayan ayrı SAP kaydıdır. Alarm özeti ve aksiyon kartları farklı kapsamlardır; sayıları birbirine eklenmez.</p></section>}
              {report.alerts.items.length > 0 && <section className="deep-section" aria-labelledby="alert-heading">
                <div className="section-heading"><div><p className="eyebrow">04 · RAPOR ALARMLARI</p><h2 id="alert-heading">Alarm özeti <span className="heading-original">Alert Overview</span></h2></div><span>{report.alerts.total} alarm</span></div>
                {report.alerts.items.some((item) => /anything in client 000/i.test(item.title)) && report.alerts.items.some((item) => /anything in other client\(s\) than 000/i.test(item.title)) && <p className="data-note">İstemci 000 ve 000 dışındaki istemciler için iki ayrı güvenlik alarmı var; kapsamları farklıdır.</p>}
                <div className="alert-list">{report.alerts.items.map((item, index) => { const display = alertPresentation(item.title, translations.alerts?.[index], showTranslation); return <div key={`${index}-${item.title}`} className={`alert-item severity-${item.severity}`}><span className="alert-dot" aria-hidden="true" /><div className="alert-copy"><p lang={showTranslation && !display.untranslated ? "tr" : "en"}>{display.primary}</p>{display.original && <details className="alert-source"><summary>Orijinal SAP metni (EN)</summary><p lang="en">{display.original}</p></details>}{display.untranslated && <small>Özgün SAP metni (EN) · doğrulanmış Türkçe karşılık yok</small>}</div><strong>{sourceRatingLabels[item.severity]}</strong></div>; })}</div>
              </section>}
              {report.recommendations.length > 0 && <section className="deep-section" id="sap-onerileri" aria-labelledby="recommendation-heading">
                <div className="section-heading"><div><p className="eyebrow">05 · SAP ÖNERİLERİ</p><h2 id="recommendation-heading">Rapordaki SAP önerileri</h2></div><span>{report.recommendations.length} öneri</span></div>
                <p className="data-note">Etiket önerinin kaynak bölümündeki seviyedir. Seviye okunamadı, risksiz demek değildir. Bir bölümde birden fazla öneri bulunabilir; öneri sayısı alarm sayısıyla aynı olmak zorunda değildir.</p>
                <div className="recommendation-controls"><div className="recommendation-filters" role="group" aria-label="Öneri durumuna göre filtrele">{([
                  ["all", "Tümü"], ["red", "Kritik · Kırmızı"], ["yellow", "Uyarı · Sarı"], ["green", "Normal · Yeşil"], ["unknown", "Seviye okunamadı"],
                ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={recommendationFilter === value} className={recommendationFilter === value ? "active" : ""} onClick={() => setRecommendationFilter(value)}>{label} <span>{recommendationCounts[value]}</span></button>)}</div><label className="recommendation-search"><span className="sr-only">Önerilerde ara</span><input type="search" value={recommendationQuery} onChange={(event) => setRecommendationQuery(event.target.value)} placeholder="Kaynak veya öneride ara" /></label></div>
                <p className="recommendation-result" role="status">{visibleRecommendations.length} / {report.recommendations.length} öneri gösteriliyor</p>
                {visibleRecommendations.length ? <ol className="recommendation-list">{visibleRecommendations.map(({ item, index }) => {
                  const view = recommendationDisplay(item.text, translations.recommendations[index], showTranslation);
                  return <li className={`recommendation-item recommendation-${item.rating}`} key={`${item.source}-${index}`}>
                    <div className="recommendation-head"><span title={item.source}>{item.number && `EWA Madde ${item.number} · `}{showTranslation ? sapSourceLabel(item.source) : item.source}</span><strong className={`source-rating-${item.rating}`}>{sourceRatingLabels[item.rating]}</strong></div>
                    {view.turkish && <div className="recommendation-main" lang="tr">
                      {view.kind === "summary" && <span className="recommendation-kind" title="Bu metin özgün SAP önerisindeki doğrulanabilen işlemlerin kısa özetidir; bütün talimatlar için altındaki İngilizce metni açın.">Kısa Türkçe değerlendirme</span>}
                      <p>{view.turkish}</p>
                    </div>}
                    {view.kind === "source" && view.sourcePreview && <div className="recommendation-main recommendation-source-preview">
                      <span className="recommendation-kind">SAP önerisi · İngilizce kaynak</span>
                      <p lang="en">{view.sourcePreview}</p>
                    </div>}
                    {view.collapsedEnglish ? <details className="recommendation-original">
                      <summary>{view.kind === "source" ? "Tam SAP önerisini İngilizce görüntüle" : "SAP önerisinin tam İngilizce metni"} <span>({item.text.length} karakter)</span></summary>
                      <p lang="en">{view.english}</p>
                    </details> : <p className={view.kind === "source" ? "recommendation-english recommendation-source" : "recommendation-english"} lang="en">{view.english}</p>}
                    {item.context && <div className="recommendation-context"><strong>Rapordaki ilgili tablo · {reportLabel(item.context.title || "Ölçüm değerleri", showTranslation)}</strong><div className="recommendation-table-wrap"><table><thead><tr>{item.context.header.map((cell, at) => <th scope="col" key={`${cell}-${at}`}>{reportLabel(cell || `Sütun ${at + 1}`, showTranslation)}</th>)}</tr></thead><tbody>{item.context.rows.map((row, at) => <tr key={at}>{item.context!.header.map((_, cell) => <td key={cell}>{row[cell] || "—"}</td>)}</tr>)}</tbody></table></div>{item.context.totalRows > item.context.rows.length && <small>{item.context.totalRows - item.context.rows.length} satır daha var; tamamı kaynak raporda.</small>}</div>}
                  </li>;
                })}</ol> : <div className="empty-card">Bu filtreyle eşleşen SAP önerisi bulunamadı.</div>}
              </section>}
              {report.sqlHotspots.length > 0 && <section className="deep-section" aria-labelledby="sql-heading">
                <div className="section-heading"><div><p className="eyebrow">06 · HANA SQL ANALİZİ</p><h2 id="sql-heading">Raporda öne çıkan HANA SQL ölçümleri</h2></div><span>{report.sqlHotspots.length} benzersiz statement hash</span></div>
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
                  <p className="sql-reference" title={item.source}>{showTranslation ? sapSourceLabel(item.source) : item.source}</p>
                </li>)}</ol>
              </section>}
              {report.sqlLoads.length > 0 && <section className="deep-section" aria-labelledby="oracle-sql-heading">
                <div className="section-heading"><div><p className="eyebrow">VERİTABANI SQL</p><h2 id="oracle-sql-heading">Yük oluşturan ifadeler</h2></div><span>{report.sqlLoads.length} rapor satırı</span></div>
                {report.sqlLoadImpact && <p className="data-note">Toplu etki: {report.sqlLoadImpact.impact} · CPU %{report.sqlLoadImpact.cpu} · I/O %{report.sqlLoadImpact.io} · süre %{report.sqlLoadImpact.elapsed}. Kaynak: {report.sqlLoadImpact.source}</p>}
                <div className="sql-record-list">{sqlRows.map((item, index) => <article className="sql-record" key={`${item.source}-${item.object}-${index}`}>
                  <div className="sql-record-head"><span>{sectionBySource(report, item.source)?.number ? `Madde ${sectionBySource(report, item.source)!.number}` : "Veritabanı ölçümü"}</span></div>
                  <h3>{item.object}</h3>
                  <dl className="sql-metrics"><div><dt>Süre payı</dt><dd>%{formatMeasure(item.elapsedPercent, 2)}</dd></div><div><dt>CPU yükü</dt><dd>%{formatMeasure(item.cpuPercent, 2)}</dd></div><div><dt>I/O yükü</dt><dd>%{formatMeasure(item.ioPercent, 2)}</dd></div><div><dt>Çalıştırma</dt><dd>{item.executions}</dd></div><div><dt>İşlenen kayıt</dt><dd>{item.records}</dd></div></dl>
                  <p className="sql-reference" title={item.source}>{showTranslation ? sapSourceLabel(item.source) : item.source}</p>
                </article>)}</div>
              </section>}
              {report.sqlServerStatements.length > 0 && <section className="deep-section" aria-labelledby="sql-server-heading">
                <div className="section-heading"><div><p className="eyebrow">SQL SERVER</p><h2 id="sql-server-heading">Pahalı sorgu nesneleri</h2></div><span>{report.sqlServerStatements.length} rapor satırı</span></div>
                <p className="data-note">Rapor bu tabloda SQL metnini vermiyor; nesne adını ve mantıksal okuma ağırlığını gösteriyor.</p>
                <div className="sql-record-list">{report.sqlServerStatements.map((item, index) => <article className="sql-record" key={`${item.source}-${index}`}>
                  <div className="sql-record-head"><span>{sectionBySource(report, item.source)?.number ? `Madde ${sectionBySource(report, item.source)!.number}` : "SQL Server ölçümü"}</span><span>Rapor sırası {index + 1}</span></div>
                  <h3>{item.object}</h3>
                  <dl className="sql-metrics"><div><dt>Mantıksal okuma</dt><dd>%{formatMeasure(item.logicalReadsPercent)}</dd></div><div><dt>Fiziksel okuma</dt><dd>%{formatMeasure(item.physicalReadsPercent)}</dd></div><div><dt>CPU süresi</dt><dd>%{formatMeasure(item.cpuPercent)}</dd></div><div><dt>Geçen süre</dt><dd>%{formatMeasure(item.elapsedPercent)}</dd></div><div><dt>Çağrı</dt><dd>{formatMeasure(item.calls)}</dd></div><div><dt>Toplam kayıt</dt><dd>{formatMeasure(item.totalRows)}</dd></div></dl>
                  <p className="sql-reference" title={item.source}>{showTranslation ? sapSourceLabel(item.source) : item.source}</p>
                </article>)}</div>
              </section>}
              {report.hanaParameters.length > 0 && <section className="deep-section" aria-labelledby="hana-param-heading">
                <div className="section-heading"><div><p className="eyebrow">07 / HANA YAPILANDIRMASI</p><h2 id="hana-param-heading">Parametre önerileri</h2></div><span>{parameterRows(report).length} kayıt</span></div>
                <div className="parameter-table-wrap"><table className="component-table parameter-table">
                  <caption>Rapordan okunan mevcut ve önerilen HANA parametre değerleri</caption>
                  <colgroup><col style={{width:"25%"}} /><col style={{width:"19%"}} /><col style={{width:"12%"}} /><col style={{width:"22%"}} /><col style={{width:"11%"}} /><col style={{width:"11%"}} /></colgroup>
                  <thead><tr><th scope="col">Parametre</th><th scope="col">Dosya / bölüm</th><th scope="col">Mevcut değer</th><th scope="col">Raporda önerilen</th><th scope="col">SAP Note</th><th scope="col">EWA referansı</th></tr></thead>
                  <tbody>{parameterRows(report).map((item, index) => <tr key={`${item.parameter}-${index}`}>
                    <th scope="row"><code>{item.parameter}</code></th>
                    <td data-label="Dosya / bölüm"><code>{item.location}</code></td>
                    <td data-label="Mevcut değer">{item.current && item.current !== "—" ? <code>{item.current}</code> : <span className="parameter-missing">Raporda okunamadı</span>}</td>
                    <td data-label="Raporda önerilen"><code>{item.recommended}</code></td>
                    <td data-label="SAP Note">{item.note || "Belirtilmemiş"}</td>
                    <td data-label="EWA referansı">{parameterReference(report, item)}</td>
                  </tr>)}</tbody>
                </table></div>
                <p className="data-note">Önerilen değeri uygulamadan önce tenant, katman ve ilgili SAP Note ile kontrol edin.</p>
              </section>}
            </div>}
          </section> : (working || error) ? <div className="analysis-empty" aria-live="polite" aria-busy={working}>
            <FileText size={25} aria-hidden="true" />
            <h2>{working ? "Rapor okunuyor…" : error ? "Bu dosya için analiz oluşturulamadı" : "Analiz için rapor seçin"}</h2>
            <p>{working ? "Dosyanın metni ve kontrol bölümleri çıkarılıyor." : error ? "Önceki raporun bulguları gösterilmiyor. Hata açıklamasını kontrol edip dosyayı yeniden seçin." : "EWA veya aylık bakım raporunu yüklediğinde sonuç burada görünecek."}</p>
          </div> : null}
          <footer className="workspace-footer"><div>Analiz sonuçları karar desteğidir; kritik işlemlerden önce orijinal SAP raporuyla karşılaştırın.<br /><small>EWA Radar bağımsız bir analiz aracıdır; SAP tarafından geliştirilmiş veya desteklenmiş değildir. SAP, ilgili hak sahiplerinin ticari markasıdır.</small></div><span>EWA RADAR</span></footer>
        </div>
      </main>
    </div>
  );
}
