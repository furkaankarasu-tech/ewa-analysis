import { parseEwaDetails, type ComponentUpdate, type HanaParameter, type SqlHotspot } from "./ewa-detail.ts";
import { parseReportSections, type ReportSection } from "./report-structure.ts";
import { parsePdfLayout } from "./pdf-layout.ts";
import { pdfAlerts } from "./pdf-ewa.ts";
import { pdfSectionRatings } from "./pdf-ratings.ts";
import { dateDelta, parseLifecycle, parseLifecycleTables, parsePdfLifecycleSections, type LifecycleRecord } from "./lifecycle.ts";
import { parseSqlLoad, type SqlLoad, type SqlServerStatement } from "./sql-load.ts";
import { parseTopSqlTables, type TopSqlStatement } from "./top-sql.ts";
import { collectSapRecommendations, deriveSectionFindings, type SapRecommendation } from "./report-insights.ts";
import { parseHtmlEwa } from "./html-ewa.ts";
import { sectionReference } from "./section-reference.ts";
import type { TranslationBundle } from "./local-translation.ts";

export type Priority = "kritik" | "yuksek" | "orta" | "izle";

export type Finding = {
  id: string;
  priority: Priority;
  title: string;
  evidence: string;
  action: string;
  owner: string;
  source: string;
  confidence: "Rapor bulgusu" | "Türetilmiş" | "Kontrol gerekli";
  impact?: string;
  cause?: string;
  recommendation?: boolean;
};

export type EwaReport = {
  kind: "EWA" | "Bakım";
  sid: string;
  period: string;
  rating: string;
  filename: string;
  format: string;
  product: string;
  database: string;
  example: boolean;
  alerts: { red: number | null; yellow: number | null; total: number | null; items: { title: string; severity: "red" | "yellow" | "unknown" }[] };
  decisive: string[];
  kpis: { label: string; value: string; note?: string }[];
  findings: Finding[];
  recommendations: SapRecommendation[];
  caveats: string[];
  extractedLines: number;
  componentUpdates: ComponentUpdate[];
  componentCount: number | null;
  sqlHotspots: SqlHotspot[];
  sqlWindow: string | null;
  sqlLoads: SqlLoad[];
  sqlServerStatements: SqlServerStatement[];
  topSqlStatements: TopSqlStatement[];
  sqlLoadImpact: { impact: string; cpu: string; io: string; elapsed: string; source: string } | null;
  hanaParameters: HanaParameter[];
  sections: ReportSection[];
  lifecycle: LifecycleRecord[];
};

const WORDML = "http://schemas.microsoft.com/office/word/2003/wordml";
const DOCX = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const VML = "urn:schemas-microsoft-com:vml";

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function xmlLines(xml: string, namespace: string) {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error("Dış varlık veya DTD içeren Word XML güvenli olarak açılamadı.");
  const document = new DOMParser().parseFromString(xml, "text/xml");
  if (document.querySelector("parsererror")) throw new Error("Word XML ayrıştırılamadı.");
  const paragraphs = Array.from(document.getElementsByTagNameNS(namespace, "p"));
  const lines = paragraphs.map((paragraph) => {
    const pieces = Array.from(paragraph.getElementsByTagNameNS(namespace, "t"));
    return clean(pieces.map((piece) => piece.textContent ?? "").join(""));
  }).filter(Boolean);
  return { document, lines };
}

function findLine(lines: string[], needle: string, start = 0) {
  return lines.findIndex((line, index) => index >= start && line.toLocaleLowerCase("tr").includes(needle.toLocaleLowerCase("tr")));
}

function lastHeading(lines: string[], heading: string) {
  return lines.findLastIndex((line) => line.toLocaleLowerCase("tr") === heading.toLocaleLowerCase("tr"));
}

function valueAfter(lines: string[], needle: string, offset = 1, start = 0) {
  const index = findLine(lines, needle, start);
  return index >= 0 ? lines[index + offset] ?? "" : "";
}

function numeric(value: string) {
  const trimmed = value.replace(/[^\d.,-]/g, "");
  if (!trimmed) return NaN;
  if (trimmed.includes(",")) return Number(trimmed.replace(/\./g, "").replace(",", "."));
  if ((trimmed.match(/\./g) ?? []).length === 1 && trimmed.split(".")[1].length !== 3) return Number(trimmed);
  return Number(trimmed.replace(/\./g, ""));
}

function displayNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits }).format(value);
}

const priorityOrder: Record<Priority, number> = { kritik: 0, yuksek: 1, orta: 2, izle: 3 };
const priorityLabel: Record<Priority, string> = { kritik: "KRİTİK", yuksek: "YÜKSEK", orta: "ORTA", izle: "TAKİP" };
const reportPriority = (rating: "red" | "yellow" | "green" | "unknown"): Priority =>
  rating === "red" ? "kritik" : rating === "yellow" ? "yuksek" : "izle";

function maintenanceOwner(heading: string) {
  if (/yetki|şifre|parola|audit/i.test(heading)) return "Security + Basis";
  if (/dump|artalan|job|sistem log/i.test(heading)) return "Basis + ABAP";
  if (/tablo|index/i.test(heading)) return "DBA + ABAP";
  return "Basis";
}

function maintenancePriority(risk: string): Priority {
  if (/KRİTİK|CRITICAL/i.test(risk)) return "kritik";
  if (/YÜKSEK|HIGH/i.test(risk)) return "yuksek";
  if (/ORTA|MEDIUM/i.test(risk)) return "orta";
  return "izle";
}

function maintenanceReport(file: File, extracted: Awaited<ReturnType<typeof extractFile>>): EwaReport {
  const { document, lines, format } = extracted;
  if (!document || format !== "DOCX") throw new Error("Aylık bakım raporu için metin içeren DOCX dosyası gerekir.");
  const body = document.getElementsByTagNameNS(DOCX, "body")[0];
  if (!body) throw new Error("Word belgesinin ana içeriği bulunamadı.");
  const textOf = (node: Element) => clean(Array.from(node.getElementsByTagNameNS(DOCX, "t")).map((part) => part.textContent ?? "").join(""));
  const cellText = (cell: Element) => clean(Array.from(cell.getElementsByTagNameNS(DOCX, "p")).map(textOf).filter(Boolean).join("; "));
  const findings: Finding[] = [];
  let heading = "Genel kontrol";
  let controls = 0;
  let noIssue = 0;
  let reportDate = "";
  for (const node of Array.from(body.childNodes).filter((child) => child.nodeType === 1) as Element[]) {
    if (node.namespaceURI !== DOCX) continue;
    if (node.localName === "p") {
      const style = node.getElementsByTagNameNS(DOCX, "pStyle")[0]?.getAttributeNS(DOCX, "val") ?? "";
      if (/Heading2|Balk2/i.test(style)) { heading = textOf(node); controls++; }
      else if (/Problem bulunmamaktadır/i.test(textOf(node))) noIssue++;
    } else if (node.localName === "tbl") {
      const rows = Array.from(node.getElementsByTagNameNS(DOCX, "tr"));
      const fields = new Map<string, string>();
      for (const row of rows) {
        const cells = (Array.from(row.childNodes).filter((child) => child.nodeType === 1) as Element[]).filter((child) => child.namespaceURI === DOCX && child.localName === "tc");
        if (cells.length >= 2) fields.set(cellText(cells[0]).replace(/:$/, "").toLocaleLowerCase("tr"), cellText(cells[1]));
      }
      if (!reportDate) reportDate = textOf(node).match(/Tarih\s*:\s*(\d{2}\.\d{2}\.\d{4})/i)?.[1] ?? "";
      const risk = fields.get("risk düzeyi") ?? "";
      if (!risk) continue;
      const explanation = fields.get("hata açıklaması") ?? "Açıklama metni yok";
      const solution = fields.get("çözüm önerisi") ?? "Kaynak rapordaki ilgili kontrolü inceleyin.";
      findings.push({
        id: `maintenance-${findings.length + 1}`, priority: maintenancePriority(risk), title: heading,
        evidence: `Risk düzeyi: ${risk}. Hata açıklaması: ${explanation}.`,
        action: solution, owner: maintenanceOwner(heading), source: `Aylık Bakım Raporu / ${heading}`, confidence: "Rapor bulgusu",
      });
    }
  }
  if (!controls && !findings.length) throw new Error("Bakım raporunun kontrol başlıkları okunamadı.");
  const sid = file.name.match(/_([A-Z0-9]{3})_\d{2}_\d{4}/i)?.[1]?.toUpperCase() ?? lines.slice(0, 30).join(" ").match(/\(([A-Z0-9]{3})\)/)?.[1] ?? "SID okunamadı";
  const month = file.name.match(/_(\d{2})_(\d{4})_/) ;
  const period = month ? `${month[1]}/${month[2]}` : "Dönem okunamadı";
  const highest = findings.map((item) => priorityOrder[item.priority]).sort((a, b) => a - b)[0];
  const rating = highest === 0 ? "KRİTİK" : highest === 1 ? "YÜKSEK" : highest === 2 ? "ORTA" : findings.length ? "DÜŞÜK" : "Risk kaydı yok";
  const riskHeadings = new Set(findings.map((item) => item.title));
  const kpis = [
    { label: "Risk kaydı", value: String(findings.length) },
    { label: "Kontrol başlığı", value: String(controls) },
    { label: "Sorunsuz işaretli", value: String(noIssue) },
    ...(reportDate ? [{ label: "Rapor tarihi", value: reportDate }] : []),
  ];
  const caveats = ["Bu bir aylık bakım raporudur; EWA alarmı veya HANA KPI'ı gibi değerlendirilmez.", "Risk tabloları ve çözüm önerileri belge metninden aktarılmıştır; önerileri uygulamadan önce doğrulayın.", "Word içindeki ekran görüntüleri ve sayısal değerleri otomatik doğrulanmamıştır."];
  if (noIssue + riskHeadings.size < controls) caveats.push("Bazı kontrol başlıkları yalnızca görsel içeriyor olabilir; bu bölümleri kaynak belgede ayrıca kontrol edin.");
  return { kind: "Bakım", sid, period, rating, filename: file.name, format, product: "", database: "", example: false, alerts: { red: null, yellow: null, total: findings.length, items: [] }, decisive: [], kpis, findings: findings.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]), recommendations: [], caveats, extractedLines: lines.length, componentUpdates: [], componentCount: null, sqlHotspots: [], sqlWindow: null, sqlLoads: [], sqlServerStatements: [], topSqlStatements: [], sqlLoadImpact: null, hanaParameters: [], sections: [], lifecycle: [] };
}

function wordRowText(row: Element) {
  return clean(Array.from(row.getElementsByTagNameNS(WORDML, "t")).map((node) => node.textContent ?? "").join(" "));
}

function reportIdentity(document: Document | null, format: string, pdfTables: string[][][], sid: string) {
  const namespace = format === "Word XML (.doc)" ? WORDML : format === "DOCX" ? DOCX : "";
  const tables = namespace && document ? Array.from(document.getElementsByTagNameNS(namespace, "tbl")).map((table) =>
    Array.from(table.getElementsByTagNameNS(namespace, "tr")).map((row) =>
      (Array.from(row.childNodes).filter((node) => node.nodeType === 1) as Element[])
        .filter((cell) => cell.namespaceURI === namespace && cell.localName === "tc")
        .map((cell) => clean(Array.from(cell.getElementsByTagNameNS(namespace, "t")).map((part) => part.textContent ?? "").join("")))
    )) : pdfTables;
  let product = "";
  let database = "";
  for (const rows of tables) {
    const header = rows[0] ?? [];
    const row = rows.slice(1).find((cells) => cells[0]?.toUpperCase() === sid || new RegExp(`^${sid}(?:\\d+)?~`).test(cells[0]?.toUpperCase() ?? ""));
    if (!row) continue;
    if (header.includes("SAP Product") && header.includes("Product Version"))
      product ||= clean(`${row[header.indexOf("SAP Product")] ?? ""} ${row[header.indexOf("Product Version")] ?? ""}`);
    if (header.includes("Database System") && header.includes("Database Version"))
      database ||= clean(`${row[header.indexOf("Database System")] ?? ""} ${row[header.indexOf("Database Version")] ?? ""}`);
    if (product && database) break;
  }
  return { product, database };
}

async function alertIconCounts(document: Document | null, lines: string[]) {
  const classifications = new Map<string, "red" | "yellow" | "green" | "unknown">();
  const empty = { red: null, yellow: null, total: null, items: [] as EwaReport["alerts"]["items"], decisive: [] as string[], classifications, summaryRating: "unknown" as "red" | "yellow" | "green" | "unknown" };
  if (!document) return empty;
  const binData = new Map<string, string>();
  for (const item of Array.from(document.getElementsByTagNameNS(WORDML, "binData"))) {
    const name = item.getAttributeNS(WORDML, "name");
    if (name && item.textContent) binData.set(name, item.textContent.replace(/\s/g, ""));
  }
  const paragraphs = Array.from(document.getElementsByTagNameNS(WORDML, "p"));
  const tableAfter = (label: string) => {
    const heading = paragraphs.find((paragraph) => clean(paragraph.textContent ?? "") === label);
    const siblings = heading?.parentNode ? Array.from(heading.parentNode.childNodes).filter((child) => child.nodeType === 1) as Element[] : [];
    return heading ? siblings.slice(siblings.indexOf(heading) + 1).find((sibling) => sibling.namespaceURI === WORDML && sibling.localName === "tbl") : undefined;
  };
  const alertRows: { src: string; title: string }[] = [];
  const decisive: string[] = [];
  for (const label of ["Alerts Decisive For Red Report", "Alert Overview"]) {
    const table = tableAfter(label);
    for (const row of table ? Array.from(table.getElementsByTagNameNS(WORDML, "tr")) : []) {
      const rowText = wordRowText(row);
      const src = row.getElementsByTagNameNS(VML, "imagedata")[0]?.getAttribute("src") ?? "";
      if (label.startsWith("Alerts Decisive")) { if (rowText && !decisive.includes(rowText)) decisive.push(rowText); }
      else if (rowText && !alertRows.some((item) => item.title === rowText)) alertRows.push({ src, title: rowText });
    }
  }
  const overviewCheck = Array.from(document.getElementsByTagNameNS(WORDML, "p")).find((paragraph) => clean(paragraph.textContent ?? "") === "Check Overview");
  const checkSiblings = overviewCheck?.parentNode ? Array.from(overviewCheck.parentNode.childNodes).filter((child) => child.nodeType === 1) as Element[] : [];
  const checkTable = overviewCheck ? checkSiblings.slice(checkSiblings.indexOf(overviewCheck) + 1).find((sibling) => sibling.namespaceURI === WORDML && sibling.localName === "tbl") : undefined;
  const checkIcons = checkTable ? Array.from(checkTable.getElementsByTagNameNS(VML, "imagedata")).map((item) => item.getAttribute("src") ?? "") : [];
  const summary = Array.from(document.getElementsByTagNameNS(WORDML, "p")).find((paragraph) => clean(paragraph.textContent ?? "") === "Service Summary");
  const summarySiblings = summary?.parentNode ? Array.from(summary.parentNode.childNodes).filter((child) => child.nodeType === 1) as Element[] : [];
  const summaryTable = summary ? summarySiblings.slice(summarySiblings.indexOf(summary) + 1).find((sibling) => sibling.namespaceURI === WORDML && sibling.localName === "tbl") : undefined;
  const summarySrc = summaryTable?.getElementsByTagNameNS(VML, "imagedata")[0]?.getAttribute("src") ?? "";
  const reportIcons = new Set([...alertRows.map((row) => row.src), ...checkIcons, summarySrc].filter(Boolean));
  const sectionIcons = Array.from(document.getElementsByTagNameNS(VML, "imagedata")).map((node) => node.getAttribute("src") ?? "");
  for (const src of new Set([...reportIcons, ...sectionIcons].filter(Boolean))) {
    const base64 = binData.get(src);
    if (!base64 || base64.length > 120_000) { classifications.set(src, "unknown"); continue; }
    try {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes]));
      const canvas = window.document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas yok");
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      if (bitmap.width > 100 || bitmap.height > 220 || !reportIcons.has(src) && (bitmap.width > 32 || bitmap.height > 20)) { bitmap.close(); classifications.set(src, "unknown"); continue; }
      let red = 0; let yellow = 0; let green = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
        if (a < 100) continue;
        if (r > 135 && r > g * 1.45 && r > b * 1.45) red++;
        if (r > 135 && g > 95 && b < 100 && r > b * 1.7) yellow++;
        if (g > 95 && g > r * 1.3 && g > b * 1.2) green++;
      }
      const largest = Math.max(red, yellow, green);
      classifications.set(src, largest < 8 ? "unknown" : red === largest ? "red" : yellow === largest ? "yellow" : "green");
      bitmap.close();
    } catch { classifications.set(src, "unknown"); }
  }
  const items = alertRows.map((row) => ({ title: row.title, severity: (classifications.get(row.src) === "green" ? "unknown" : classifications.get(row.src) ?? "unknown") as "red" | "yellow" | "unknown" }));
  const red = items.filter((item) => item.severity === "red").length;
  const yellow = items.filter((item) => item.severity === "yellow").length;
  const complete = items.length > 0 && items.every((item) => item.severity !== "unknown");
  return { red: complete ? red : null, yellow: complete ? yellow : null, total: items.length || null, items, decisive, classifications, summaryRating: classifications.get(summarySrc) ?? "unknown" };
}

async function extractFile(file: File) {
  if (file.size > 25 * 1024 * 1024) throw new Error("Bu sürümde en fazla 25 MB rapor yüklenebilir.");
  const lower = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (lower.endsWith(".docx")) {
    const JSZip = (await import("jszip")).default;
    if (new TextDecoder().decode(buffer.slice(0, 2)) !== "PK") throw new Error("DOCX dosyasının ZIP yapısı geçersiz.");
    const zip = await JSZip.loadAsync(buffer);
    const word = zip.file("word/document.xml");
    if (word && (word as typeof word & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize! > 45 * 1024 * 1024) throw new Error("DOCX içindeki XML güvenli boyut sınırını aşıyor.");
    const xml = await word?.async("string");
    if (!xml) throw new Error("DOCX içinde Word belgesi bulunamadı.");
    if (xml.length > 45 * 1024 * 1024) throw new Error("DOCX içindeki XML güvenli boyut sınırını aşıyor.");
    return { ...xmlLines(xml, DOCX), format: "DOCX", pdfLayout: null, htmlLayout: null, limitations: ["DOCX grafiklerinin pikselleri bu sürümde otomatik ölçülmez."] };
  }
  if (lower.endsWith(".doc")) {
    const bytes = new Uint8Array(buffer);
    const utf8 = new TextDecoder("utf-8").decode(bytes);
    const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe ? new TextDecoder("utf-16le").decode(bytes) : "";
    const xml = utf8.includes("<w:wordDocument") ? utf8 : utf16.includes("<w:wordDocument") ? utf16 : "";
    if (!xml) throw new Error("Bu .doc dosyası eski ikili Word biçiminde. Word üzerinden DOCX veya PDF olarak kaydedip yeniden yükleyin.");
    return { ...xmlLines(xml, WORDML), format: "Word XML (.doc)", pdfLayout: null, htmlLayout: null, limitations: [] };
  }
  if (lower.endsWith(".htm") || lower.endsWith(".html")) {
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    if (!/<html\b/i.test(raw) || !/EarlyWatch Alert/i.test(raw.slice(0, 2000))) throw new Error("Bu HTML dosyası SAP EWA raporu gibi görünmüyor.");
    const htmlLayout = parseHtmlEwa(raw);
    return { document: null, lines: htmlLayout.lines, format: "HTML", pdfLayout: null, htmlLayout,
      limitations: ["HTML raporundaki grafiklerin görsel eğrileri otomatik ölçülmez; sayısal tablolar ayrıca incelenir."] };
  }
  if (lower.endsWith(".pdf")) {
    if (new TextDecoder().decode(buffer.slice(0, 5)) !== "%PDF-") throw new Error("PDF dosyasının başlığı geçersiz.");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = typeof window === "undefined"
      ? new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).href
      : "/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), enableXfa: false }).promise;
    if (pdf.numPages > 450) throw new Error("PDF sayfa sayısı güvenli işleme sınırını aşıyor.");
    const pages: { page: number; items: { str: string; x: number; y: number; width: number; height: number }[] }[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const text = await page.getTextContent();
      const items = text.items as { str?: string; transform?: number[]; width?: number; height?: number }[];
      pages.push({ page: pageNumber, items: items.filter((item) => item.str?.trim() && item.transform).map((item) => ({ str: item.str!, x: item.transform![4], y: item.transform![5], width: item.width ?? 0, height: item.height ?? 0 })) });
    }
    const pageTexts = pages.map((page) => page.items.map((item) => item.str).join(" "));
    const summaries = pageTexts.filter((text) => /\b1\s+Service\s+Summary\b/i.test(text)).length;
    const covers = pageTexts.filter((text) => /\bService\s+Report\b/i.test(text) && /\bSAP\s+System\s+ID\b/i.test(text)).length;
    if (summaries > 1 || covers > 1) {
      throw new Error("Bu PDF birden fazla EWA raporu içeriyor. Farklı SID ve dönemlerin verileri karışmaması için her raporu ayrı PDF olarak yükleyin.");
    }
    const pdfLayout = parsePdfLayout(pages);
    const pdfRatings = await pdfSectionRatings(pdf, pages, pdfLayout.sections);
    for (const section of pdfLayout.sections) if (section.number && pdfRatings.has(section.number)) section.rating = pdfRatings.get(section.number)!;
    const { lines } = pdfLayout;
    if (lines.length < 12) throw new Error("PDF metni çıkarılamadı. Taranmış rapor için OCR gereken bir sürüm gerekir.");
    return { document: null, lines, format: "PDF", pdfLayout, htmlLayout: null, limitations: ["PDF grafiklerinin piksellerindeki ölçümler sayısal tabloyla desteklenmiyorsa otomatik yorumlanmaz."] };
  }
  throw new Error("Yalnızca PDF, DOC, DOCX, HTM ve HTML raporları destekleniyor.");
}

export async function analyzeEwa(file: File): Promise<EwaReport> {
  const extracted = await extractFile(file);
  const { lines, document, format } = extracted;
  const isMaintenance = /bak[ıi]m[_\s-]*raporu/i.test(file.name) || (findLine(lines, "Aylık Bakım Raporu") >= 0 && findLine(lines, "Risk Düzeyi") >= 0);
  if (isMaintenance) return maintenanceReport(file, extracted);
  const combinedTitle = lines.slice(0, 500).join(" ");
  const sectionCount = ["Alert Overview", "Service Preparation", "SAP System ID", "Performance Overview"].filter((heading) => findLine(lines, heading) >= 0).length;
  if (!/early\s*watch\s+alert/i.test(combinedTitle) && sectionCount < 2) {
    throw new Error("Bu dosya SAP EarlyWatch Alert raporu gibi görünmüyor.");
  }
  const { classifications, summaryRating: wordSummaryRating, decisive: wordDecisive, ...wordAlerts } = await alertIconCounts(document, lines);
  const noCriticalText = /We did not detect any critical problems during the EarlyWatch Alert/i.test(lines.slice(0, 140).join(" "));
  const summaryRating = extracted.htmlLayout?.summaryRating ?? wordSummaryRating;
  const decisive = extracted.htmlLayout?.decisive ?? wordDecisive;
  const pdfItems = format === "PDF" ? pdfAlerts(lines) : [];
  const htmlItems = extracted.htmlLayout?.alerts.map((item) => ({ title: item.title, severity: (item.severity === "red" || item.severity === "yellow" ? item.severity : "unknown") as "red" | "yellow" | "unknown" }));
  const alerts = htmlItems ? { red: htmlItems.every((item) => item.severity !== "unknown") ? htmlItems.filter((item) => item.severity === "red").length : null,
    yellow: htmlItems.every((item) => item.severity !== "unknown") ? htmlItems.filter((item) => item.severity === "yellow").length : null,
    total: htmlItems.length, items: htmlItems } : format === "PDF" ? { red: noCriticalText && !pdfItems.length ? 0 : null, yellow: noCriticalText && !pdfItems.length ? 0 : null, total: noCriticalText && !pdfItems.length ? 0 : pdfItems.length || null, items: pdfItems.map((title) => ({ title, severity: "unknown" as const })) } : wordAlerts;
  const sections = extracted.htmlLayout?.sections ?? extracted.pdfLayout?.sections ?? parseReportSections(document, format, (src) => classifications.get(src) ?? "unknown");
  const idIndex = findLine(lines, "SAP System ID");
  const cover = lines.slice(0, 85).join("\n");
  const sid = cover.match(/^SAP System ID[ \t]+([A-Z][A-Z0-9]{2,3})\b/m)?.[1] || cover.match(/^EarlyWatch Alert - ([A-Z][A-Z0-9]{2,3})\b/m)?.[1] || (idIndex >= 0 ? lines.slice(idIndex + 1, idIndex + 35).find((line) => /^[A-Z][A-Z0-9]{2,3}$/.test(line)) : undefined) || "SID okunamadı";
  const sidAt = lines.slice(0, 55).findIndex((line) => line === sid);
  const extractedTables = (extracted.htmlLayout?.tables ?? extracted.pdfLayout?.tables ?? []).map((table) => [table.header, ...table.rows]);
  const identity = reportIdentity(document, format, extractedTables, sid);
  const product = identity.product || cover.match(/^Product[ \t]+([^\n]+)$/m)?.[1] || (sidAt >= 0 ? lines[sidAt + 1] ?? "" : "");
  const database = identity.database || cover.match(/^DB System[ \t]+([^\n]+)$/m)?.[1] || (sidAt >= 0 ? lines[sidAt + 3] ?? "" : "");
  const dumpSentence = lines.find((line) => /ABAP dumps have been recorded/.test(line)) ?? "";
  const exactPeriod = dumpSentence.match(/period\s+(\d{2}\.\d{2}\.\d{4})\s+to\s+(\d{2}\.\d{2}\.\d{4})/);
  const from = cover.match(/^Analysis from\s+(\d{2}\.\d{2}\.\d{4})/m)?.[1] ?? valueAfter(lines, "Analysis from").match(/\d{2}\.\d{2}\.\d{4}/)?.[0];
  const until = cover.match(/^Until\s+(\d{2}\.\d{2}\.\d{4})/m)?.[1] ?? valueAfter(lines, "Until").match(/\d{2}\.\d{2}\.\d{4}/)?.[0];
  const coverEnd = lines.findIndex((line) => line === "Service Summary");
  const coverDates = lines.slice(0, coverEnd > 0 ? coverEnd : 55).filter((line) => /^\d{2}\.\d{2}\.\d{4}$/.test(line));
  const period = from && until ? `${from} – ${until}` : coverDates.length >= 2 ? `${coverDates.at(-2)} – ${coverDates.at(-1)}` : exactPeriod ? `${exactPeriod[1]} – ${exactPeriod[2]}` : "Dönem okunamadı";
  const rating = summaryRating === "red" ? "KIRMIZI" : summaryRating === "yellow" ? "SARI" : summaryRating === "green" ? "YEŞİL" : decisive.length || lines.some((line) => line === "Alerts Decisive For Red Report") ? "KIRMIZI" : noCriticalText ? "Kritik sorun yok" : "";
  const findings: Finding[] = [];
  const kpis: EwaReport["kpis"] = [];
  const caveats = [...extracted.limitations];
  if (format === "Word XML (.doc)") caveats.push("Word raporundaki grafik eğrilerinin sayısal noktaları otomatik ölçülmez; grafiklerin yönünü kaynakta kontrol edin.");
  if (/~JAVA_|~BW_/i.test(file.name)) caveats.push("JAVA/BW raporlarında bu sürümün ABAP/HANA kural seti tüm kontrolleri kapsamaz.");
  const add = (item: Finding) => findings.push(item);
  const securityPackage = sections.find((section) => /Security Risk Due to Outdated Support Packages/i.test(section.title) && section.rating !== "green" &&
    section.observations.some((line) => /has run out of security maintenance/i.test(line)));
  if (securityPackage) add({ id: "security-support-packages", priority: securityPackage.rating === "red" ? "kritik" : securityPackage.rating === "yellow" ? "yuksek" : "orta",
    title: "Support Package güvenlik bakımı sona ermiş",
    evidence: securityPackage.observations.find((line) => /has run out of security maintenance/i.test(line))!,
    action: "Güvenlik bakımı biten Support Package seviyelerini doğrula; uyumlu güncel SP Stack ve güvenlik yamaları için test ve kurulum planı hazırla.",
    owner: "Security + Basis", source: `${securityPackage.path}${securityPackage.page ? ` · s. ${securityPackage.page}` : ""}`, confidence: "Rapor bulgusu" });
  const details = parseEwaDetails(document, lines, format, extractedTables);
  if (!details.sqlWindow && format === "PDF") {
    const heading = lines.findIndex((line) => /^(?:\d+(?:\.\d+)*\s+)?Top Statements \(Elapsed Time\)$/.test(line));
    const nearby = heading >= 0 ? lines.slice(heading, heading + 40) : [];
    const interval = (label: string) => nearby.find((line) => line.startsWith(label))?.slice(label.length).trim().match(/\d{2}\.\d{2}\.\d{4}\s*--\s*\d{2}:\d{2}:\d{2}/)?.[0];
    const from = interval("Begin of Time Interval"), to = interval("End of Time Interval");
    if (from && to) details.sqlWindow = `${from} – ${to}`;
  }
  for (const parsed of extracted.pdfLayout?.pdfSqlHotspots ?? []) {
    const current = details.sqlHotspots.find((item) => item.hash === parsed.hash);
    if (current) {
      for (const key of ["elapsedSeconds", "executions", "averageMs", "memoryPerExecutionMb", "maximumMemoryMb", "cpuPeakSamples", "threadSamples"] as const) {
        if (parsed[key] !== undefined && (current[key] === undefined || parsed[key]! > current[key]!)) current[key] = parsed[key];
      }
      current.reportSource ??= parsed.reportSource;
    } else details.sqlHotspots.push(parsed);
  }
  const lifecycle = document ? parseLifecycle(document, format, (src) => classifications.get(src) ?? "unknown") : parseLifecycleTables(extracted.htmlLayout?.tables ?? extracted.pdfLayout?.tables ?? []);
  if (format === "PDF") for (const record of parsePdfLifecycleSections(lines)) {
    if (!lifecycle.some((existing) => existing.area === record.area && existing.endDate === record.endDate)) lifecycle.push(record);
  }
  const { rows: sqlLoads, aggregate: sqlLoadImpact } = parseSqlLoad(sections);
  const sqlServerStatements = extracted.pdfLayout?.sqlServerStatements ?? [];
  if (sqlServerStatements.length) kpis.push({ label: "SQL Server sorgu nesnesi", value: String(sqlServerStatements.length), note: sqlServerStatements[0].source });
  const topSqlStatements = extracted.pdfLayout?.topSqlStatements.length ? extracted.pdfLayout.topSqlStatements : parseTopSqlTables(sections);
  if (topSqlStatements.length) {
    kpis.push({ label: "Top SQL satırı", value: String(topSqlStatements.length), note: topSqlStatements[0].source });
    if (topSqlStatements.some((item) => item.truncated)) caveats.push("Top SQL ifadelerinin bazıları kaynak raporda üç nokta ile kısaltılmış; tam SQL metni ve yürütme planı bu tablodan doğrulanamaz.");
  } else if (sections.some((section) => /\bTop SQL Statements\b/i.test(section.title))) caveats.push("Top SQL Statements başlığı var, ancak tablonun satırları güvenilir biçimde okunamadı; kaynak raporda kontrol edin.");
  const sqlAssessment = sections.find((section) => /Database server load from expensive SQL statements/i.test(section.title) && section.level === 1)
    ?.observations.find((line) => /(?:did not lead to performance problems|caused performance problems)/i.test(line)) ?? "";
  if (sqlLoadImpact) kpis.push({ label: "Pahalı SQL etkisi", value: sqlLoadImpact.impact, note: `CPU %${sqlLoadImpact.cpu} · I/O %${sqlLoadImpact.io} · geçen süre %${sqlLoadImpact.elapsed} (${sqlLoadImpact.source})` });
  if (sqlLoads.length) {
    const busiest = [...sqlLoads].sort((a, b) => b.elapsedPercent - a.elapsedPercent)[0];
    kpis.push({ label: "SQL en yüksek süre payı", value: `${busiest.object} · %${displayNumber(busiest.elapsedPercent, 2)}`, note: `Ölçüm: ${busiest.source}` });
    const noSqlProblem = /did not lead to performance problems/i.test(sqlAssessment);
    add({ id: "db-sql-load", priority: noSqlProblem ? "izle" : sqlLoadImpact?.impact.toUpperCase() === "HIGH" ? "yuksek" : "orta", title: "Veritabanı SQL yükü",
      evidence: `${busiest.object}: ölçüm grubunda süre payı %${displayNumber(busiest.elapsedPercent, 2)}, CPU %${displayNumber(busiest.cpuPercent, 2)}, I/O %${displayNumber(busiest.ioPercent, 2)}; ${busiest.executions} çalıştırma. ${busiest.source}${sqlLoadImpact ? ` · Toplu etki derecesi ${sqlLoadImpact.impact} (${sqlLoadImpact.source}).` : "."}${sqlAssessment ? ` · Rapor yorumu: ${sqlAssessment}` : ""}`,
      action: "Bu ölçüm grubundaki SQL'i yürütme planı, çağrı sıklığı ve uygulama kaynağıyla incele; farklı ölçüm pencerelerinin yüzdelerini toplama.",
      owner: "DBA + ABAP", source: busiest.source, confidence: "Rapor bulgusu" });
  }
  const reportEnd = period.match(/(\d{2}\.\d{2}\.\d{4})$/)?.[1] ?? "";
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()).replace(/\//g, ".");
  for (const source of new Set(sqlLoads.map((item) => item.source))) {
    const measured = source.match(/\b(?:On|as of)\s+(\d{2}\.\d{2}\.\d{4})/i)?.[1];
    const offset = measured ? dateDelta(measured, reportEnd) : null;
    if (offset !== null && offset > 0) caveats.push(`SQL ölçüm penceresi ${source} rapor bitişinden ${offset} gün sonra. Haftalık yükle aynı dönem olarak toplanmadı.`);
  }
  for (const record of lifecycle) {
    if (/Son paket oluşturma tarihi/i.test(record.dateLabel)) continue;
    const atReport = dateDelta(record.endDate, reportEnd);
    const atToday = dateDelta(record.endDate, today);
    if (atReport !== null && atToday !== null && atReport <= 365) caveats.push(`${record.name}: ${record.dateLabel} ${record.endDate}; rapor bitişine göre ${atReport < 0 ? `${-atReport} gün geçmiş` : `${atReport} gün kalmış`}, bugüne göre ${atToday < 0 ? `${-atToday} gün geçmiş` : `${atToday} gün kalmış`}. ${record.source}`);
    if (atReport !== null && atReport <= 365) add({
      id: `lifecycle-${record.area}-${record.name}`, priority: reportPriority(record.rating),
      title: `${record.name} bakım takvimi`,
      evidence: `${record.dateLabel} ${record.endDate}; rapor bitişinde ${atReport < 0 ? `${-atReport} gün geçmiş` : `${atReport} gün kalmış`}${record.extendedEnd ? `. Uzatılmış destek tarihi ${record.extendedEnd}; kapsam sözleşmeye bağlı` : ""}.`,
      action: "İlgili ürün veya katmanın bakım kapsamını ve güncelleme yolunu SAP ile üretici kaynaklarında doğrula; geçişi test ve bakım penceresine planla.",
      owner: record.area === "İşletim sistemi" ? "Basis + altyapı" : record.area === "Veritabanı" ? "DBA + Basis" : "Basis + uygulama", source: record.source, confidence: "Türetilmiş",
    });
    if (/Bakımda:\s*no\b/i.test(record.status)) add({
      id: `lifecycle-status-${record.name}`, priority: "yuksek", title: `${record.name} bakım durumu`,
      evidence: `${record.installed ? `${record.installed}; ` : ""}${record.status} (rapor tablosu).`,
      action: "Kurulu revizyonun bakım durumunu ve önerilen SPS/revizyonu sistem ve SAP kaynaklarında doğrula; güncelleme planı hazırla.",
      owner: "DBA + Basis", source: record.source, confidence: "Rapor bulgusu",
    });
  }

  if (details.componentCount !== null) {
    kpis.push({ label: "Yazılım komponentleri", value: `${details.componentCount} incelendi`, note: `${details.componentUpdates.length} patch/SP farkı` });
    if (details.componentUpdates.length) add({
      id: "component-patches", priority: reportPriority(sections.find((section) => /Support Package Maintenance - (?:JAVA|ABAP)/i.test(section.title))?.rating ?? "unknown"), title: "Güncelleme farkı olan komponentler",
      evidence: details.componentUpdates.slice(0, 7).map((item) => `${item.component} ${item.version}: ${item.metric} ${item.installedPatch} → ${item.latestPatch}`).join(" · ") + (details.componentUpdates.length > 7 ? ` · diğer ${details.componentUpdates.length - 7} fark aşağıdaki tabloda.` : "."),
      action: "Rapor tarihindeki patch farklarını Maintenance Planner ve ilgili notlarla doğrula; uyumluluk ve test planıyla güncelleme penceresi oluştur.",
      owner: "Basis + uygulama", source: `Software Configuration > Support Package Maintenance - ${details.componentUpdates[0].metric === "SP" ? "JAVA" : "ABAP"}`, confidence: "Rapor bulgusu",
    });
  } else if (sections.some((item) => /Support Package Maintenance - ABAP/i.test(item.title))) caveats.push("Komponent patch tablosu çıkarılamadı; sürüm karşılaştırması kaynak raporda yapılmalı.");

  const providerAlert = alerts.items.find((item) => /requests.*InfoProvider\(s\).*performance problems/i.test(item.title));
  const providerSection = sections.find((section) => /Top InfoProviders per total number of requests/i.test(section.title));
  const providerTable = providerSection?.tables.find((table) => table.header.includes("InfoProvider") && table.header.includes("Requests"));
  if (providerAlert && providerTable) {
    const nameAt = providerTable.header.indexOf("InfoProvider");
    const countAt = providerTable.header.indexOf("Requests");
    const largest = providerTable.rows.map((row) => ({ name: row[nameAt], requests: numeric(row[countAt] ?? "") }))
      .filter((row) => row.name && Number.isFinite(row.requests)).sort((a, b) => b.requests - a.requests).slice(0, 3);
    if (largest.length) add({ id: "bw-requests", priority: providerAlert.severity === "red" ? "kritik" : "yuksek", title: "BW InfoProvider istek birikimi",
      evidence: `${providerAlert.title} ${largest.map((row) => `${row.name}: ${displayNumber(row.requests)} istek`).join(" · ")}.`,
      action: "BW istek yönetimi ve data load akışını ilgili InfoProvider bazında incele; silme ve housekeeping adımlarını BW ekibiyle planla.",
      owner: "BW uygulama + Basis", source: `Alert Overview · ${providerSection!.path}`, confidence: "Rapor bulgusu" });
  }

  const gcAlert = alerts.items.find((item) => /instances? spent more than [\d.,]+%.*garbage collections?/i.test(item.title));
  const gcSection = sections.find((section) => /Java VM Memory Performance > Garbage Collection Time hourly data/i.test(section.path));
  if (gcAlert) add({
    id: "java-gc", priority: gcAlert.severity === "red" ? "kritik" : "yuksek", title: "Java garbage collection süresi",
    evidence: gcAlert.title,
    action: gcSection?.recommendations.map((item) => clean(item.replace(/^Recommendation\s*:\s*/i, ""))).find(Boolean) || "JVM GC zamanını örnek bazında incele; heap ve paging verisiyle birlikte değerlendir.",
    owner: "Basis + Java", source: gcSection?.path ?? "Alert Overview", confidence: "Rapor bulgusu",
  });

  const rtcctool = lines.find((line) => /Report RTCCTOOL was last run/.test(line));
  if (rtcctool && /RED rating/i.test(rtcctool)) add({
    id: "service-preparation", priority: "yuksek", title: "RTCCTOOL servis hazırlığı kırmızı",
    evidence: `${rtcctool.match(/\d{2}\.\d{2}\.\d{4}/)?.[0] ?? "Rapor dönemi"} kontrolü kırmızı.${details.serviceNotes.length ? ` ${details.serviceNotes.slice(0, 5).map((item) => `${item.topic} (Note ${item.note})`).join("; ")}.` : ""}`,
    action: "RTCCTOOL içindeki ST-PI, ST-A/PI ve ilgili SAP Note önerilerini sistem sürümüyle doğrula; SAINT/SPAM/SNOTE işlemlerini test ve bakım planına al.",
    owner: "Basis", source: "Service Preparation Check (RTCCTOOL)", confidence: "Rapor bulgusu",
  });

  const topElapsed = details.sqlHotspots.filter((item) => item.elapsedSeconds !== undefined).sort((a, b) => b.elapsedSeconds! - a.elapsedSeconds!);
  const topMemory = details.sqlHotspots.filter((item) => item.memoryPerExecutionMb !== undefined).sort((a, b) => b.memoryPerExecutionMb! - a.memoryPerExecutionMb!);
  const topPeak = details.sqlHotspots.filter((item) => item.cpuPeakSamples !== undefined).sort((a, b) => b.cpuPeakSamples! - a.cpuPeakSamples!);
  if (topElapsed.length) {
    const first = topElapsed[0];
    kpis.push({ label: "En yüksek SQL toplam süre", value: `${displayNumber(first.elapsedSeconds!, 1)} sn`, note: `${first.hash.slice(0, 12)}… · ${displayNumber(first.executions ?? 0)} çalıştırma` });
    add({ id: "sql-elapsed", priority: "izle", title: "Raporda öne çıkan SQL toplam süresi",
      evidence: topElapsed.slice(0, 3).map((item) => `${item.hash.slice(0, 12)}… ${displayNumber(item.elapsedSeconds!, 1)} sn / ${displayNumber(item.executions ?? 0)} çalıştırma`).join(" · ") + ".",
      action: "Hash bazında çağıran ABAP işlemini ve yürütme planını incele; çok tekrarlanan SQL ile tek çalıştırmada yavaş olan SQL'i ayrı ele al.",
      owner: "ABAP + DBA", source: "SAP HANA SQL Statements > Top Statements (Elapsed Time)", confidence: "Rapor bulgusu" });
  }
  if (topMemory.length) {
    const first = topMemory[0];
    kpis.push({ label: "SQL bellek / çalıştırma", value: `${displayNumber(first.memoryPerExecutionMb!, 1)} MB`, note: first.hash.slice(0, 12) + "…" });
    add({ id: "sql-memory", priority: "izle", title: "Raporda öne çıkan SQL bellek ölçümü",
      evidence: topMemory.slice(0, 3).map((item) => `${item.hash.slice(0, 12)}… ${displayNumber(item.memoryPerExecutionMb!, 1)} MB/çalıştırma`).join(" · ") + ".",
      action: "Statement hash, kaynak tablo/view ve yürütme planını incele; sonuç kümesi ve eşzamanlı bellek baskısını doğrulamadan parametre değiştirme.",
      owner: "DBA + ABAP", source: "SAP HANA SQL Statements > Top Statements (Total Memory)", confidence: "Rapor bulgusu" });
  }
  if (topPeak.length) add({ id: "sql-cpu-peak", priority: "izle", title: "CPU zirvesinde görülen SQL'ler",
    evidence: topPeak.slice(0, 3).map((item) => `${item.hash.slice(0, 12)}… ${displayNumber(item.cpuPeakSamples!)} örnek`).join(" · ") + ".",
    action: "CPU zirve saatindeki thread örneklerini uygulama yükü ve SQL planıyla karşılaştır.", owner: "DBA + ABAP", source: "SAP HANA SQL Statements > Top Statements (CPU Peak Hour)", confidence: "Rapor bulgusu" });
  if (!details.sqlHotspots.length && !sqlLoads.length && sections.some((section) => section.tables.some((table) => table.header.some((cell) => /Statement Hash/i.test(cell))))) caveats.push("SQL hotspot tablosunun satırları çıkarılamadı; kaynak raporda inceleyin.");
  if (details.sqlWindow) caveats.push(`Top SQL elapsed ölçüm penceresi: ${details.sqlWindow}. Rapor haftasıyla bire bir aynı dönem olmayabilir.`);
  if (topMemory.length) caveats.push("SQL bellek/çalıştırma değeri plan cache ölçümüdür; tekil hata veya kesin kök neden olarak yorumlanmamalı.");
  if (details.componentUpdates.length) caveats.push("Komponentlerdeki 'Latest Avail.' değeri raporun üretildiği anın bilgisidir; güncellemeden önce güncel patch ve bağımlılıkları doğrulayın.");
  const parameterSections = sections.filter((section) => section.tables.some((table) =>
    table.header.includes("Location") && table.header.includes("Parameter") && table.header.includes("Recommended Value")));
  const parameterContainer = sections.filter((section) => parameterSections.length > 0 &&
    parameterSections.every((child) => child.path === section.path || child.path.startsWith(`${section.path} > `)))
    .sort((a, b) => b.level - a.level)[0];
  if (details.hanaParameters.length) add({ id: "hana-parameters", priority: "orta", title: "HANA parametre önerileri",
    evidence: `${details.hanaParameters.length} parametre kaydı. ${details.hanaParameters.slice(0, 3).map((item) => `${item.parameter}: ${item.current} → ${item.recommended}`).join(" · ")}.`,
    action: "Mevcut ve önerilen değerleri ilgili SAP Note ve parametre katmanıyla doğrula; değişiklikleri test ederek bakım penceresine al.",
    owner: "DBA", source: parameterContainer?.path ?? "SAP HANA Configuration > Parameter Settings", confidence: "Rapor bulgusu" });

  const nrStart = lastHeading(lines, "Critical Number Ranges");
  if (nrStart >= 0) {
    const section = lines.slice(nrStart, nrStart + 95);
    for (let i = 0; i < section.length; i++) {
      if (section[i] !== "ADRNR") continue;
      const used = section[i - 2] ?? "";
      const client = section[i - 3] ?? "";
      const interval = section[i + 2] ?? "";
      const remaining = section[i + 4] ?? "";
      if (numeric(used) >= 90) add({
        id: `nr-${interval}`, priority: numeric(used) >= 100 ? "kritik" : "yuksek",
        title: `ADRNR / ${interval} numara aralığı`,
        evidence: `Client ${client}; kullanım %${used}; kalan ${remaining}.`,
        action: "Aralığın kullanımını iş birimiyle doğrula; gerekiyorsa uygulamaya uygun yeni aralık veya genişletme planla.",
        owner: "Basis + uygulama", source: "Critical Number Ranges", confidence: "Rapor bulgusu",
      });
    }
  }

  const memoryStart = findLine(lines, "Avg. memory usage by SAP HANA Instances");
  if (memoryStart >= 0) {
    const memoryRow = lines.slice(memoryStart + 1, memoryStart + 28).findIndex((line) => /_[A-Z0-9]{3}_\d\d$/.test(line));
    const offset = memoryStart + 1 + memoryRow;
    if (memoryRow >= 0) {
      const [used, limit, row, column, index, indexLimit] = lines.slice(offset + 1, offset + 7).map(numeric);
      if (Number.isFinite(used) && Number.isFinite(limit) && limit > 0) {
        const percentage = used / limit * 100;
        kpis.push({ label: "HANA bellek", value: `${displayNumber(used)} / ${displayNumber(limit)} GB`, note: `%${displayNumber(percentage, 1)} limit` });
        const tableShare = (row + column) / limit * 100;
        const indexShare = Number.isFinite(index) && Number.isFinite(indexLimit) && indexLimit > 0 ? index / indexLimit * 100 : NaN;
        if (percentage >= 90 || indexShare >= 90 || tableShare >= 70) add({
          id: "hana-memory", priority: percentage >= 90 || indexShare >= 90 || decisive.some((item) => /Memory consumption of tables exceeds 70%/i.test(item)) ? "kritik" : "yuksek", title: "HANA bellek baskısı",
          evidence: `Instance ${displayNumber(used)} / ${displayNumber(limit)} GB (%${displayNumber(percentage, 1)}); tablolar ${displayNumber(row + column)} GB (limitin %${displayNumber(tableShare, 1)}'i, türetilmiş); indexserver ${displayNumber(index)} / ${displayNumber(indexLimit)} GB.`,
          action: "SAP HANA Cockpit üzerinden yüklü tabloları, heap kullanımını ve en yüksek bellek tüketimini inceleyin. Kapasite planlamasını DVM bulgularıyla birlikte değerlendirin.",
          owner: "DBA + altyapı", source: "SAP HANA Resource Consumption", confidence: "Türetilmiş",
        });
      }
    }
  }

  const largeTableSection = sections.find((section) => /Largest Non-partitioned Column Tables \(Records\)/i.test(section.title) &&
    section.tables.some((table) => table.header.includes("Records (Total)") && table.header.includes("Table Name")));
  if (largeTableSection) {
    const large = largeTableSection.tables.flatMap((table) => {
      const nameAt = table.header.indexOf("Table Name");
      const recordsAt = table.header.indexOf("Records (Total)");
      const growthAt = table.header.indexOf("Weekly Record Growth [%]");
      if (nameAt < 0 || recordsAt < 0) return [];
      return table.rows.map((row) => ({ name: row[nameAt], records: numeric(row[recordsAt] ?? ""), growth: growthAt >= 0 ? row[growthAt] : "" }))
        .filter((row) => row.name && Number.isFinite(row.records));
    }).sort((a, b) => b.records - a.records);
    const relevant = large.filter((entry) => entry.records >= 1_200_000_000).slice(0, 5);
    if (relevant.length) add({
      id: "large-tables", priority: "kritik", title: "Partisyonlanmamış büyük tablolar",
      evidence: relevant.map((entry) => `${entry.name} ${displayNumber(entry.records)} kayıt${entry.growth ? `; %${entry.growth}/hafta` : ""}`).join(" · ") + ".",
      action: "Kayıt sınırına yaklaşan tablolar için uygulamayla uyumlu tablo partisyonlama veya SAP Veri Hacmi Yönetimi (DVM) kapsamında arşivleme seçeneklerini değerlendirin. Tabloların büyüme hızını ayrıca ölçün.",
      owner: "DBA + uygulama", source: largeTableSection.path, confidence: "Rapor bulgusu",
    });
  }

  const diskStart = lastHeading(lines, "Disk Usage");
  if (diskStart >= 0) {
    const area = lines.slice(diskStart, diskStart + 80);
    const dataIndex = area.findIndex((line) => line === "DATA");
    if (dataIndex >= 4) {
      const available = numeric(area[dataIndex - 3]);
      const used = numeric(area[dataIndex - 2]);
      const free = numeric(area[dataIndex - 1]);
      if (Number.isFinite(free)) {
        kpis.push({ label: "DATA disk boşluğu", value: `%${displayNumber(free, 1)}`, note: Number.isFinite(used) ? `${displayNumber(used, 2)} / ${displayNumber(available)} GB` : undefined });
        if (free < 20) add({
          id: "disk", priority: free < 10 ? "kritik" : "yuksek", title: "DATA disk kapasitesi",
          evidence: `Boşluk %${displayNumber(free, 1)}; kullanılan ${displayNumber(used, 2)} / ${displayNumber(available)} GB.`,
          action: "Kapasiteyi ve büyüme hızını doğrula; alan artışı veya güvenli temizlik planla.",
          owner: "DBA + altyapı", source: "Size and Growth > Disk Usage", confidence: "Rapor bulgusu",
        });
      }
    }
  }

  const perfStart = findLine(lines, "Averages of Response Time Components in ms");
  if (perfStart >= 0) {
    const part = lines.slice(perfStart, perfStart + 38);
    const dialog = part.findIndex((line) => line === "DIALOG");
    if (dialog >= 0) {
      const vals = part.slice(dialog + 1, dialog + 8);
      kpis.push({ label: "Dialog yanıt", value: `${vals[1]} ms`, note: `CPU ${vals[2]} · DB ${vals[5]} · GUI ${vals[6]} ms` });
      if (numeric(vals[1]) > 2000) add({
        id: "dialog", priority: "izle", title: "Dialog yanıt süresi",
        evidence: `Ortalama ${vals[1]} ms; CPU ${vals[2]}, DB ${vals[5]}, GUI ${vals[6]} ms.`,
        action: "ST03N/STAD ile toplam yükü, ST06 ile GUI ağ gecikmesini ölç; yüksek etkili işlem ve SQL'leri ayır.",
        owner: "Basis + ABAP + ağ", source: "Performance Overview", confidence: "Rapor bulgusu",
      });
    }
  }

  const indicators = lastHeading(lines, "Performance Indicators for " + sid);
  if (indicators >= 0) {
    const dbSize = valueAfter(lines, "DB Size", 1, indicators);
    const growth = valueAfter(lines, "DB Growth Last Month", 1, indicators);
    if (Number.isFinite(numeric(dbSize))) kpis.push({ label: "DB büyüklüğü", value: `${displayNumber(numeric(dbSize), 2)} GB`, note: Number.isFinite(numeric(growth)) ? `Son ay +${displayNumber(numeric(growth), 2)} GB` : undefined });
  }

  const transactions = lastHeading(lines, "Workload by Transaction (Dialog/HTTP(S)/WS-HTTP )");
  const batchStart = findLine(lines, "Workload by Transaction (Batch)", transactions + 1);
  if (transactions >= 0) {
    const section = lines.slice(transactions, batchStart > transactions ? batchStart : transactions + 95);
    const rows: { name: string; steps: number; share: number; average: number }[] = [];
    for (let i = 0; i < section.length - 7; i++) {
      if (!["DIA", "HTTP", "HTTPS", "WS-HTTP"].includes(section[i + 1])) continue;
      const steps = numeric(section[i + 2]);
      const share = numeric(section[i + 3]);
      const average = numeric(section[i + 4]);
      if (Number.isFinite(steps) && Number.isFinite(share) && Number.isFinite(average)) rows.push({ name: section[i], steps, share, average });
    }
    if (rows.length) {
      const slow = [...rows].sort((a, b) => b.average - a.average)[0];
      const load = [...rows].sort((a, b) => b.share - a.share)[0];
      kpis.push({ label: "En yavaş ortalama", value: `${slow.name} · ${displayNumber(slow.average, 1)} ms`, note: `${displayNumber(slow.steps)} adım` });
      if (slow.average > 15_000) add({
        id: "slow-transaction", priority: "izle", title: "Yavaş işlemler ve toplam yük",
        evidence: `${slow.name}: ${displayNumber(slow.average, 1)} ms, ${displayNumber(slow.steps)} adım. En yüksek toplam pay: ${load.name} %${displayNumber(load.share, 1)}.`,
        action: "ST03N/STAD ile yüksek ortalama ve yüksek toplam yükü ayrı sırala; ST12/SQL izini ilgili ABAP ekibiyle incele.",
        owner: "ABAP + Basis", source: "Workload by Transaction", confidence: "Rapor bulgusu",
      });
    }
  }

  const dumps = Number(dumpSentence.match(/^(\d+) ABAP dumps/)?.[1] ?? 0);
  if (dumps) {
    kpis.push({ label: "ABAP dump", value: displayNumber(dumps), note: "Haftalık" });
    if (dumps > 30) add({
      id: "dumps", priority: "yuksek", title: "ABAP dump yoğunluğu",
      evidence: `${displayNumber(dumps)} dump. ${findLine(lines, "GETWA_NOT_ASSIGNED") >= 0 ? `GETWA_NOT_ASSIGNED ${valueAfter(lines, "GETWA_NOT_ASSIGNED")} adet.` : ""}`,
      action: "ST22'de tekrarlayan program, kullanıcı ve zaman kümelerini ayırıp kök nedeni ABAP ekibine aktar.",
      owner: "ABAP + Basis", source: "Program Errors (ABAP Dumps)", confidence: "Rapor bulgusu",
    });
  }

  const logStart = lastHeading(lines, "Log Backup");
  const dataBackup = findLine(lines, "Data Backup", logStart + 1);
  if (logStart >= 0 && dataBackup > logStart) {
    const section = lines.slice(logStart, dataBackup);
    let failed = 0;
    for (let i = 0; i < section.length - 3; i++) {
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(section[i])) failed += numeric(section[i + 3]) || 0;
    }
    if (failed) add({
      id: "log-backup", priority: "yuksek", title: "Başarısız log backup denemeleri",
      evidence: `Rapor haftasında ${displayNumber(failed)} başarısız log backup kaydı.`,
      action: "Backup catalog ve hata loglarında telafi durumunu ve kurtarma zincirini doğrula.",
      owner: "DBA", source: "Backup and Recovery > Log Backup", confidence: "Rapor bulgusu",
    });
  }

  const overtakers = valueAfter(lines, "Overtakers and bypassed transport requests");
  if (Number.isFinite(numeric(overtakers)) && numeric(overtakers) > 0) add({
    id: "transport", priority: "yuksek", title: "Transport sıra hatası",
    evidence: `Overtaker/bypassed metriği ${overtakers}; son hafta toplam transport ${valueAfter(lines, "Total number of transport requests")}.`,
    action: "Etkilenen request nesne sürümlerini üretimde kontrol et; doğru sürümü DEV'den taşı ve import sırasını düzelt.",
    owner: "Basis + ALM", source: "Failed Changes", confidence: "Kontrol gerekli",
  });

  if (findLine(lines, "User SYSTEM is currently active and valid") >= 0 || findLine(lines, "enable_ssl") >= 0) {
    const active = findLine(lines, "User SYSTEM is currently active and valid") >= 0;
    const tlsIndex = findLine(lines, "enable_ssl");
    const tlsOff = tlsIndex >= 0 && lines.slice(tlsIndex, tlsIndex + 5).includes("off");
    const superUsers = findLine(lines, "Super User Accounts");
    const superArea = superUsers >= 0 ? lines.slice(superUsers, superUsers + 35) : [];
    const client000 = superArea.indexOf("000");
    const client100 = superArea.indexOf("100");
    const allCount = client000 >= 0 && client100 >= 0 ? `SAP_ALL 000/100: ${superArea[client000 + 1]}/${superArea[client100 + 1]}` : "";
    const debugStart = findLine(lines, "Users Authorized to Debug / Replace");
    const debugArea = debugStart >= 0 ? lines.slice(debugStart, debugStart + 28) : [];
    const d000 = debugArea.indexOf("000");
    const d100 = debugArea.indexOf("100");
    const debugCount = d000 >= 0 && d100 >= 0 ? `DEBUG 000/100: ${debugArea[d000 + 1]}/${debugArea[d100 + 1]}` : "";
    const evidence = [active ? "SYSTEM hesabı aktif" : "", tlsOff ? "SR enable_ssl=off" : "", allCount, debugCount, findLine(lines, "No customer-defined audit policies are enabled") >= 0 ? "Müşteri audit policy etkin değil" : ""].filter(Boolean);
    if (evidence.length) add({
      id: "security", priority: "yuksek", title: "HANA güvenlik yapılandırması",
      evidence: evidence.join(" · ") + ".",
      action: "Alternatif yönetici erişimini doğrula; SR TLS ve SYSTEM hesabı değişikliklerini bakım penceresinde, yetkileri PFCG/SUIM ile ele al.",
      owner: "Security + Basis + DBA", source: "Security", confidence: "Rapor bulgusu",
    });
  }

  if (findLine(lines, "Hardware capacity checks could not be run successfully due to missing data") >= 0) caveats.push("Hardware utilization verisi eksik; DB host CPU değeri tek başına kapasite kararı için yeterli değil.");
  const consistency = findLine(lines, "Only a lightweight consistency check is scheduled");
  if (consistency >= 0) {
    const area = lines.slice(consistency, consistency + 40);
    const unverified = area.indexOf("Number of not verified Tables");
    const count = unverified >= 0 ? area.slice(unverified + 1, unverified + 7).find((item) => /^\d{4,}$/.test(item)) : undefined;
    add({ id: "hana-consistency", priority: "yuksek", title: "HANA global tutarlılık kontrolü eksik",
      evidence: `Rapora göre yalnızca hafif kontrol planlı; global kontrolün başarılı çalıştırma sayısı 0${count ? `, doğrulanmamış tablo sayısı ${displayNumber(Number(count))}` : ""}.`,
      action: "Global consistency check kapsamını ve son çalıştırmaları doğrula; düşük yük saatinde SAP Note 2116157 rehberine göre planla.",
      owner: "DBA", source: "SAP HANA > Global Consistency Check Run", confidence: "Rapor bulgusu" });
  }
  const shortTerm = lines.find((line) => line.startsWith("Short term: From calendar week"));
  if (shortTerm) caveats.push(`Trend analizi penceresi: ${shortTerm}. Bunu raporun güncel haftasıyla karıştırma.`);
  const trend = findLine(lines, "Growth Extrapolated To A Year");
  if (trend >= 0) {
    const area = lines.slice(trend, trend + 35);
    const rfc = area.indexOf("RFC");
    const annual = rfc >= 0 ? area.slice(rfc + 1, rfc + 8).filter((item) => /^\d+[.,]\d+$/.test(item))[1] ?? "" : "";
    if (Number.isFinite(numeric(annual)) && numeric(annual) > 100) add({
      id: "rfc-trend", priority: "izle", title: "RFC yanıt süresi eğilimi",
      evidence: `Rapordaki kısa dönem yıllık büyüme projeksiyonu %${annual}. ${shortTerm ?? "Dönem kaynağını doğrula."}`,
      action: "Güncel hafta ST03N/STAD verisiyle eğilimi yeniden ölç; çağıran RFC ve uygulama yükünü ayır.",
      owner: "Basis + ABAP", source: "Trend Analysis > RFC", confidence: "Kontrol gerekli" });
  }
  if (alerts.total === null) caveats.push("Alert Overview kayıtları bu dosyada doğrulanamadı; alarmları kaynak rapordan kontrol edin.");
  else if (alerts.items.some((item) => item.severity === "unknown")) caveats.push("Alarm renkleri doğrulanmadığı için kırmızı ve sarı dağılımı verilmedi; gerekirse kaynak rapordaki ikonları kontrol edin.");
  const recommendations = collectSapRecommendations(sections);
  const kernelAdvice = recommendations.find((item) => /Kernel/i.test(item.source) && /outdated SAP kernel|replace this version|fix will be provided|consider updating to the latest SP Stack Kernel/i.test(item.text));
  if (kernelAdvice && !findings.some((item) => /kernel/i.test(item.title))) {
    const kernelSection = sections.filter((section) => /Kernel/i.test(section.path) && kernelAdvice.source.startsWith(section.path))
      .sort((a, b) => b.path.length - a.path.length)[0];
    const kernelRow = sections.flatMap((section) => section.tables)
      .find((table) => table.header.some((cell) => /^SAP Kernel Release$/i.test(cell)))?.rows[0];
    const kernelVersion = kernelRow?.[1] || sections.filter((section) => /SAP Kernel Release$/i.test(section.path))
      .flatMap((section) => section.observations).join(" ").match(/\b(\d{3})\s+\d+\s+\d+\b/)?.[1] || "";
    const targetPhrase = kernelAdvice.text.match(/\bkernel\s+\d{3}(?:\.\d+)?(?:\s+(?:or|and|\/)\s+\d{3}(?:\.\d+)?)?/i)?.[0] ?? "";
    const targets = [...new Set(targetPhrase.match(/\d{3}(?:\.\d+)?/g) ?? [])];
    const observed = kernelSection?.observations.find((line) => /not up to date|outdated|obsolete|replace this version/i.test(line));
    add({ id: "kernel-recommendation", priority: reportPriority(kernelSection?.rating ?? "unknown"),
      title: `SAP Kernel${kernelVersion ? ` ${kernelVersion}` : ""} güncelleme önerisi`,
      evidence: `${kernelVersion ? `Kurulu kernel ${kernelVersion}. ` : ""}${observed ?? kernelAdvice.text}`,
      action: `${targets.length ? `Kernel ${targets.join(" veya ")} seçeneklerinin` : /latest SP Stack Kernel/i.test(kernelAdvice.text) ? "Güncel SP Stack Kernel'in" : "Raporda önerilen kernel sürümünün"} ürün ve Support Package uyumluluğunu doğrula; test ederek güncelleme planı hazırla.`,
      owner: "Basis", source: kernelAdvice.source, confidence: "Rapor bulgusu", recommendation: true });
  }
  findings.push(...deriveSectionFindings(sections, findings, alerts.items));
  if (!findings.length) caveats.push("Bu belgeden güvenilir sorun bulgusu ayrıştırılamadı. Kaynak raporu elle gözden geçirin.");

  if (!findings.length && !kpis.length) throw new Error("Dosya açıldı ancak bu EWA biçiminden güvenilir bulgu çıkarılamadı.");
  return { kind: "EWA", sid, period, rating, filename: file.name, format, product, database, example: false, alerts, decisive, kpis, findings: findings.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]), recommendations, caveats, extractedLines: lines.length, componentUpdates: details.componentUpdates, componentCount: details.componentCount, sqlHotspots: details.sqlHotspots, sqlWindow: details.sqlWindow, sqlLoads, sqlServerStatements, topSqlStatements, sqlLoadImpact, hanaParameters: details.hanaParameters, sections, lifecycle };
}

export function toMarkdown(report: EwaReport, translations: TranslationBundle = { findings: {}, recommendations: {} }) {
  const sql = [...report.sqlHotspots].sort((a, b) => (b.elapsedSeconds ?? -1) - (a.elapsedSeconds ?? -1));
  return [
    `# ${report.sid} ${report.kind === "EWA" ? "EWA analizi" : "aylık bakım analizi"} — ${report.period}`,
    ...(report.rating ? [`Genel durum: ${report.rating}${report.example ? " (ÖRNEK VERİ)" : ""}`] : []),
    ...(report.database ? [`Veritabanı: ${report.database}`] : []),
    ...(report.decisive.length ? ["Kırmızı raporu belirleyen kayıtlar:", ...report.decisive.map((item) => `- ${item}`)] : []),
    "",
    "## Öncelikli bulgular",
    ...report.findings.flatMap((item, index) => [
      `${index + 1}. [${priorityLabel[item.priority]}] ${translations.findings[index]?.title || item.title}`,
      `   Kanıt: ${translations.findings[index]?.evidence || item.evidence}`,
      ...(item.impact ? [`   Rapordaki etki: ${translations.findings[index]?.impact || item.impact}`] : []),
      ...(item.cause ? [`   Rapordaki neden: ${translations.findings[index]?.cause || item.cause}`] : []),
      `   ${item.recommendation ? "SAP önerisi" : "Aksiyon"}: ${translations.findings[index]?.action || item.action}`,
      ...(sectionReference(report, item) ? [`   EWA maddesi: Madde ${sectionReference(report, item)!.number}${sectionReference(report, item)!.page ? ` · s. ${sectionReference(report, item)!.page}` : ""}.`] : []),
      `   Sahip: ${item.owner}. Kaynak: ${item.source}. Güven: ${item.confidence}.`,
      ...(Object.keys(translations.findings[index] || {}).length ? [`   İngilizce özgün kayıt: ${[item.title, item.evidence, item.impact, item.cause, item.action].filter(Boolean).join(" | ")}`] : []),
    ]),
    ...(report.kind === "EWA" && report.recommendations.length ? ["", "## SAP'nin rapordaki önerileri", "Kritik etiketi yalnızca kırmızı kaynak ikonu doğrulanan bölümü belirtir; öneri metni tek başına arıza kanıtı değildir.", ...report.recommendations.map((item, index) => `- ${item.rating === "red" ? "[KRİTİK] " : item.rating === "yellow" ? "[SARI] " : ""}${translations.recommendations[index] || item.text} Kaynak: ${item.source}${translations.recommendations[index] ? `\n  İngilizce özgün metin: ${item.text}` : ""}`)] : []),
    ...(report.kind === "EWA" && report.alerts.items.length ? ["", "## Alert Overview", ...report.alerts.items.map((item) => `- ${item.severity === "unknown" ? "" : `[${item.severity === "red" ? "KIRMIZI" : "SARI"}] `}${item.title}`)] : []),
    "", report.kind === "EWA" ? "## KPI" : "## Kontrol özeti", ...report.kpis.map((kpi) => `- ${kpi.label}: ${kpi.value}${kpi.note ? ` (${kpi.note})` : ""}`),
    ...(report.kind === "EWA" ? [
      "", "## Komponent patch farkları",
      ...(report.componentUpdates.length ? report.componentUpdates.map((item) => `- ${item.component} ${item.version}: mevcut ${item.metric} ${item.installedPatch}, rapordaki son ${item.latestPatch} (${item.description})`) : ["- Bu tabloda seviye farkı yok veya tablo okunamadı."]),
      "", "## Sürüm ve destek tarihleri",
      ...report.lifecycle.map((item) => `- ${item.name}${item.installed ? ` (${item.installed})` : ""}: ${item.dateLabel} ${item.endDate}${item.extendedEnd ? `, uzatılmış ${item.extendedEnd}` : ""}. Kaynak: ${item.source}`),
      "", "## SQL yükü",
      ...(report.sqlLoadImpact ? [`- Toplu etki ${report.sqlLoadImpact.impact}: CPU %${report.sqlLoadImpact.cpu}, I/O %${report.sqlLoadImpact.io}, süre %${report.sqlLoadImpact.elapsed}. ${report.sqlLoadImpact.source}`] : []),
      ...[...report.sqlLoads].sort((a, b) => b.elapsedPercent - a.elapsedPercent).map((item) => `- ${item.object}: CPU %${displayNumber(item.cpuPercent, 2)}, I/O %${displayNumber(item.ioPercent, 2)}, süre %${displayNumber(item.elapsedPercent, 2)}, ${item.executions} çalıştırma, ${item.records} kayıt. ${item.source}`),
      ...(report.sqlServerStatements.length ? ["", "## SQL Server pahalı sorgu nesneleri", ...report.sqlServerStatements.map((item) => `- ${item.object}: mantıksal okuma %${displayNumber(item.logicalReadsPercent)}, fiziksel okuma %${displayNumber(item.physicalReadsPercent)}, CPU %${displayNumber(item.cpuPercent)}, süre %${displayNumber(item.elapsedPercent)}, ${displayNumber(item.calls)} çağrı. ${item.source}`)] : []),
      ...(report.topSqlStatements.length ? ["", "## Rapordaki Top SQL Statements", ...report.topSqlStatements.map((item) => `- #${item.rank} ${item.statement} | toplam ${displayNumber(item.accumulatedSeconds, 2)} sn | ${displayNumber(item.executions)} çalıştırma | ortalama ${displayNumber(item.averageMs, 2)} ms | ${item.source}${item.truncated ? " | SQL metni raporda kısaltılmış" : ""}`)] : []),
      ...(sql.length ? ["", "## HANA SQL hotspot listesi", ...(report.sqlWindow ? [`Ölçüm penceresi: ${report.sqlWindow}`] : []), ...sql.map((item) => `- ${item.hash} | toplam ${item.elapsedSeconds !== undefined ? `${displayNumber(item.elapsedSeconds, 1)} sn` : "—"} | ${item.executions !== undefined ? `${displayNumber(item.executions)} çalıştırma` : "—"} | ortalama ${item.averageMs !== undefined ? `${displayNumber(item.averageMs, 1)} ms` : "—"} | bellek ${item.memoryPerExecutionMb !== undefined ? `${displayNumber(item.memoryPerExecutionMb, 1)} MB/çalıştırma` : "—"} | CPU zirve ${item.cpuPeakSamples !== undefined ? displayNumber(item.cpuPeakSamples) : "—"} örnek${item.source ? ` | kaynak ${item.source}` : ""}${item.origin ? ` | çağıran ${item.origin}` : ""}`)] : []),
      ...(report.hanaParameters.length ? ["", "## HANA parametre önerileri", ...report.hanaParameters.map((item) => `- ${item.location} / ${item.parameter}: ${item.current} → ${item.recommended}${item.note ? ` (Note ${item.note})` : ""}`)] : []),
    ] : []),
    "", "## Veri kalitesi ve doğrulama", ...report.caveats.map((item) => `- ${item}`),
    "", `Kaynak dosya: ${report.filename}`,
  ].join("\n");
}

export function toEmail(report: EwaReport, options: { evidence: boolean; caveats: boolean }, translations: TranslationBundle = { findings: {}, recommendations: {} }) {
  const subject = `${report.sid} ${report.kind === "EWA" ? "EWA" : "aylık bakım"} değerlendirmesi | ${report.period}${report.rating ? ` | ${report.rating}` : ""}`;
  const selected = report.kind === "Bakım"
    ? report.findings.filter((item, index, all) => all.slice(0, index).filter((previous) => previous.title === item.title).length < 3).slice(0, 12)
    : report.findings.slice(0, 6);
  const topSql = [...report.sqlHotspots].filter((item) => item.elapsedSeconds !== undefined).sort((a, b) => b.elapsedSeconds! - a.elapsedSeconds!).slice(0, 2);
  const memorySql = [...report.sqlHotspots].filter((item) => item.memoryPerExecutionMb !== undefined).sort((a, b) => b.memoryPerExecutionMb! - a.memoryPerExecutionMb!).slice(0, 2);
  const additionalRecommendations = report.recommendations.map((item, index) => ({ item, index })).filter(({ item }) => !selected.some((finding) =>
    finding.recommendation && finding.source.includes(item.source) &&
    clean(finding.action).toLowerCase().startsWith(clean(item.text).toLowerCase().slice(0, 120)))).slice(0, 8);
  const body = [
    "Merhaba,",
    "",
    `${report.sid} sisteminin ${report.period} dönemine ait ${report.kind === "EWA" ? "EarlyWatch Alert" : "aylık bakım"} raporunu inceledim.${report.rating ? ` Genel durum: ${report.rating}.` : ""}`,
    "",
    ...(report.kind === "EWA" && report.alerts.items.length ? [
      `Alert Overview: ${report.alerts.total} kayıt${report.alerts.red !== null && report.alerts.yellow !== null ? `; ${report.alerts.red} kırmızı, ${report.alerts.yellow} sarı` : ""}.`,
      ...report.decisive.map((item) => `• Kırmızı raporu belirleyen: ${item}`),
      ...report.alerts.items.filter((item) => item.severity === "red").map((item) => `• [KIRMIZI] ${item.title}`), "",
    ] : []),
    report.kind === "Bakım" ? "Raporda işaretlenen kontroller:" : "Öncelikli bulgular:",
    ...selected.flatMap((item, index) => [
      `${index + 1}. [${priorityLabel[item.priority]}] ${translations.findings[report.findings.indexOf(item)]?.title || item.title}`,
      ...(options.evidence ? [`   Kanıt: ${translations.findings[report.findings.indexOf(item)]?.evidence || item.evidence}`] : []),
      ...(item.impact ? [`   Rapordaki etki: ${translations.findings[report.findings.indexOf(item)]?.impact || item.impact}`] : []),
      `   ${item.recommendation ? "SAP önerisi" : "Aksiyon"}: ${translations.findings[report.findings.indexOf(item)]?.action || item.action}`,
      `   Sorumlu: ${item.owner} · Kaynak: ${item.source}`,
    ]),
    ...(selected.length < report.findings.length ? [`Diğer ${report.findings.length - selected.length} bulguyu analiz ekranında inceleyin.`] : []),
    ...(report.kind === "EWA" && additionalRecommendations.length ? ["", "Rapordaki diğer SAP önerileri:", ...additionalRecommendations.map(({ item, index }) => `• ${item.rating === "red" ? "[KRİTİK] " : item.rating === "yellow" ? "[SARI] " : ""}${translations.recommendations[index] || item.text} (${item.source})`), ...(report.recommendations.length > additionalRecommendations.length ? [`Kalan öneriler analiz ekranında ve indirilebilir tam raporda yer alır.`] : [])] : []),
    "",
    "Temel göstergeler:",
    ...report.kpis.map((kpi) => `• ${kpi.label}: ${kpi.value}${kpi.note ? ` (${kpi.note})` : ""}`),
    ...(report.kind === "EWA" && report.componentUpdates.length ? ["", "Patch/SP farkı olan komponentler (rapor verisi):", ...report.componentUpdates.slice(0, 8).map((item) => `• ${item.component} ${item.version}: ${item.metric} ${item.installedPatch} → ${item.latestPatch}`), ...(report.componentUpdates.length > 8 ? [`• Diğer ${report.componentUpdates.length - 8} komponent analiz ekranında.`] : [])] : []),
    ...(report.kind === "EWA" && report.lifecycle.length ? ["", "Bakım bitiş tarihleri:", ...report.lifecycle.filter((item) => {
      const end = report.period.match(/(\d{2}\.\d{2}\.\d{4})$/)?.[1] ?? "";
      if (/Son paket oluşturma tarihi/i.test(item.dateLabel)) return false;
      const days = dateDelta(item.endDate, end);
      return days !== null && days <= 365;
    }).map((item) => `• ${item.name}: ${item.dateLabel} ${item.endDate}${item.extendedEnd ? ` (uzatılmış ${item.extendedEnd})` : ""}`)] : []),
    ...(report.kind === "EWA" && report.sqlLoads.length ? ["", "Veritabanında yük oluşturan SQL'ler:", ...[...report.sqlLoads].sort((a, b) => b.elapsedPercent - a.elapsedPercent).slice(0, 5).map((item) => `• ${item.object}: süre %${displayNumber(item.elapsedPercent, 2)}, CPU %${displayNumber(item.cpuPercent, 2)}, I/O %${displayNumber(item.ioPercent, 2)}, ${item.executions} çalıştırma. ${item.source}`)] : []),
    ...(report.kind === "EWA" && (topSql.length || memorySql.length) ? ["", "Yüksek kaynak kullanan SQL'ler:", ...topSql.map((item) => `• Toplam süre: ${item.hash} — ${displayNumber(item.elapsedSeconds!, 1)} sn, ${displayNumber(item.executions ?? 0)} çalıştırma${item.origin ? `, ${item.origin}` : ""}`), ...memorySql.map((item) => `• Bellek: ${item.hash} — ${displayNumber(item.memoryPerExecutionMb!, 1)} MB/çalıştırma${item.source ? `, ${item.source.slice(0, 80)}` : ""}`), ...(report.sqlWindow ? [`• SQL süre penceresi: ${report.sqlWindow}`] : [])] : []),
    ...(options.caveats && report.caveats.length ? ["", "Doğrulama notları:", ...report.caveats.map((note) => `• ${note}`)] : []),
    "",
    "İyi çalışmalar.",
  ].join("\n");
  return { subject, body };
}
