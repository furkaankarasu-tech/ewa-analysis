import JSZip from "jszip";
import type { EwaReport } from "./ewa.ts";
import { emptyTranslations, type TranslationBundle } from "./local-translation.ts";
import { ewaItem, sectionBySource, sectionReference } from "./section-reference.ts";
import { findingEvidence } from "./finding-evidence.ts";
import { dateDelta } from "./lifecycle.ts";

const columns = "ABCDEFGHIJKL";
const headings = ["No", "EWA maddesi", "Analiz başlığı", "Aksiyon planı", "Öncelik", "Sorumlu", "Durum", "Hedef tarih", "Son güncelleme", "Analizde kullanılan kanıt", "Kaynak bölüm / sayfa", "Özgün bölüm ifadesi / durum"];
const priorities = { kritik: "KRİTİK", yuksek: "YÜKSEK", orta: "ORTA", izle: "TAKİP" };

function xml(value: string) {
  // Excel accepts XML 1.0 characters only. PDF text extraction can contain
  // isolated surrogates or noncharacters; exclude them before writing a cell.
  const safe = Array.from(value).slice(0, 32767).map((character) => {
    const code = character.codePointAt(0)!;
    return code === 9 || code === 10 || code === 13 || code >= 32 && code <= 0xd7ff ||
      code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff ? character : " ";
  }).join("");
  return safe
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function textCell(ref: string, value: string, style = 0) {
  // Inline strings remain text even when a report contains an Excel formula prefix.
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function numberCell(ref: string, value: number, style = 0) {
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

function blankCell(ref: string, style: number) {
  return `<c r="${ref}" s="${style}"/>`;
}

function excelDate(date: Date) {
  return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
}

function estimatedRowHeight(values: string[]) {
  const widths = [34, 38, 55, 56, 49, 56];
  const lines = Math.max(...values.map((value, index) =>
    value.split("\n").reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / Math.max(10, widths[index] - 4))), 0)));
  return Math.min(360, Math.max(67, lines * 15 + 12));
}

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00"/><numFmt numFmtId="166" formatCode="#,##0"/></numFmts>
<fonts count="4">
  <font><sz val="10"/><color rgb="FF193544"/><name val="Aptos"/></font>
  <font><b/><sz val="15"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font>
  <font><b/><sz val="10"/><color rgb="FF163A4B"/><name val="Aptos"/></font>
  <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
</fonts>
<fills count="13">
  <fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFE6EAED"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFDCE9F5"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF1F6FA"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFAD"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF9DEDC"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFFE8BD"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFDBEDF1"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFDCF1D6"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF123E52"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF24677C"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F7"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD0DDE4"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="26">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="10" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="164" fontId="2" fillId="5" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="0" fontId="3" fillId="11" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="7" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="7" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="2" fillId="8" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="164" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="165" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="0" fontId="0" fillId="12" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="12" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  <xf numFmtId="0" fontId="2" fillId="8" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  <xf numFmtId="166" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  <xf numFmtId="166" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="2"><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFDCF1D6"/><bgColor indexed="64"/></patternFill></fill></dxf><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFF9DEDC"/><bgColor indexed="64"/></patternFill></fill></dxf></dxfs>
</styleSheet>`;

type SheetValue = string | number | null | { value: string | number | null; style: number };
type DataSheet = {
  name: string;
  tabColor: string;
  title: string;
  note: string;
  headings: string[];
  widths: number[];
  entries: SheetValue[][];
  empty: string;
  status?: { column: number; options: string[]; completed: string };
  negativeColumn?: number;
};

function styled(value: string | number | null, style: number): SheetValue { return { value, style }; }

function dataSheetXml(report: EwaReport, spec: DataSheet) {
  const count = spec.headings.length;
  const last = columns[count - 1];
  const lastRow = Math.max(6, spec.entries.length + 5);
  const cells = (items: SheetValue[], row: number, alternate: boolean) => items.map((item, index) => {
    const selected = item && typeof item === "object" ? item : { value: item, style: typeof item === "number" ? alternate ? 17 : 16 : alternate ? 7 : 6 };
    const ref = `${columns[index]}${row}`;
    if (selected.value === null || selected.value === undefined) return blankCell(ref, selected.style);
    if (typeof selected.value === "number") return Number.isFinite(selected.value) ? numberCell(ref, selected.value, selected.style) : blankCell(ref, selected.style);
    return textCell(ref, selected.value, selected.style);
  }).join("");
  const rows = [
    `<row r="1" ht="33" customHeight="1">${textCell("A1", spec.title, 1)}${textCell(`${columns[count - 2]}1`, "Sistem", 2)}${textCell(`${last}1`, report.sid, 23)}</row>`,
    `<row r="2" ht="25" customHeight="1">${textCell("A2", "Dönem", 2)}${textCell("B2", report.period, 3)}${textCell("D2", "Kayıt sayısı", 2)}${numberCell("E2", spec.entries.length, 23)}</row>`,
    `<row r="3" ht="38" customHeight="1">${textCell("A3", spec.note, 18)}</row>`,
    `<row r="5" ht="39" customHeight="1">${spec.headings.map((value, index) => textCell(`${columns[index]}5`, value, 5)).join("")}</row>`,
  ];
  if (!spec.entries.length) rows.push(`<row r="6" ht="50" customHeight="1">${textCell("A6", spec.empty, 19)}</row>`);
  else spec.entries.forEach((entry, index) => {
    const height = Math.min(240, Math.max(34, ...entry.map((cell, at) => {
      const value = cell && typeof cell === "object" ? cell.value : cell;
      const width = Math.max(10, spec.widths[at] - 4);
      return String(value ?? "").split("\n").reduce((lines, part) => lines + Math.max(1, Math.ceil(part.length / width)), 0) * 15 + 12;
    })));
    rows.push(`<row r="${index + 6}" ht="${height}" customHeight="1">${cells(entry, index + 6, index % 2 === 1)}</row>`);
  });
  const merges = [`A1:${columns[count - 3]}1`, `A3:${last}3`, ...(!spec.entries.length ? [`A6:${last}6`] : [])];
  const limit = Math.max(505, lastRow + 100);
  const statusColumn = spec.status ? columns[spec.status.column] : "";
  const statusFormatting = spec.status ? `<conditionalFormatting sqref="A6:${last}${limit}"><cfRule type="expression" dxfId="0" priority="1"><formula>$${statusColumn}6="${xml(spec.status.completed)}"</formula></cfRule></conditionalFormatting>` : "";
  const negativeFormatting = spec.negativeColumn !== undefined ? `<conditionalFormatting sqref="${columns[spec.negativeColumn]}6:${columns[spec.negativeColumn]}${lastRow}"><cfRule type="cellIs" operator="lessThan" dxfId="1" priority="2"><formula>0</formula></cfRule></conditionalFormatting>` : "";
  const validation = spec.status ? `<dataValidations count="1"><dataValidation type="list" allowBlank="0" showErrorMessage="1" errorTitle="Durum seçin" error="Listedeki durumlardan birini seçin." sqref="${statusColumn}6:${statusColumn}${limit}"><formula1>"${spec.status.options.join(",")}"</formula1></dataValidation></dataValidations>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><tabColor rgb="${spec.tabColor}"/></sheetPr><dimension ref="A1:${last}${lastRow}"/>
<sheetViews><sheetView showGridLines="0" zoomScale="90" workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A6" sqref="A6"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="19"/><cols>${spec.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rows.join("")}</sheetData>${spec.entries.length ? `<autoFilter ref="A5:${last}${lastRow}"/>` : ""}
<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>
${statusFormatting}${negativeFormatting}${validation}
<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

function sourceItem(report: EwaReport, source: string) {
  const section = sectionBySource(report, source);
  const title = source.split(/\s*>\s*/).at(-1) || source;
  return section ? `Madde ${section.number} · ${section.title}` : `Numara doğrulanamadı · ${title}`;
}

function sourceWithPage(report: EwaReport, source: string) {
  const page = sectionBySource(report, source)?.page;
  return page && !/·\s*s\.\s*\d+\s*$/.test(source) ? `${source} · s. ${page}` : source;
}

function serialDate(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return Math.floor((date.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
}

function reportCount(value: string) {
  const trimmed = value.trim();
  if (/^-?\d+$/.test(trimmed)) return Number.isSafeInteger(Number(trimmed)) ? Number(trimmed) : value;
  if (/^-?\d{1,3}(?:[.,]\d{3})+$/.test(trimmed)) {
    const number = Number(trimmed.replace(/[.,]/g, ""));
    return Number.isSafeInteger(number) ? number : value;
  }
  return value;
}

function detailSheets(report: EwaReport, now: Date): DataSheet[] {
  const sql = [...report.sqlHotspots].sort((a, b) => (b.elapsedSeconds ?? -1) - (a.elapsedSeconds ?? -1) || (b.cpuPeakSamples ?? -1) - (a.cpuPeakSamples ?? -1));
  const loads = [...report.sqlLoads].sort((a, b) => a.source.localeCompare(b.source) || b.elapsedPercent - a.elapsedPercent);
  const paramFinding = report.findings.find((finding) => finding.id === "hana-parameters");
  const paramSource = paramFinding?.source ?? "SAP HANA Configuration > Parameter Settings";
  const params = report.hanaParameters.filter((item, index, all) => all.findIndex((other) =>
    [other.location, other.parameter, other.current, other.recommended, other.note].join("\0") ===
    [item.location, item.parameter, item.current, item.recommended, item.note].join("\0")) === index);
  const reportEnd = report.period.match(/(\d{2}\.\d{2}\.\d{4})$/)?.[1] ?? "";
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" }).format(now).replace(/\//g, ".");
  return [
    {
      name: "Rapordaki Top SQL", tabColor: "FF4F819A", title: "Top SQL Statements · kaynak rapor",
      note: "Sıra ve ölçümler doğrudan EWA tablosundandır. Sıfır saniye raporda yuvarlanmış olabilir; üç noktalı SQL metni kaynakta da kısaltılmıştır. Bu liste tek başına yavaş SQL kanıtı değildir.",
      headings: ["Sıra", "EWA maddesi", "SQL ifadesi", "Toplam yanıt (sn)", "Çalıştırma", "Ortalama yanıt (ms)", "Metin durumu", "Kaynak bölüm / sayfa"],
      widths: [8, 39, 90, 23, 19, 23, 25, 55],
      entries: report.topSqlStatements.map((item) => [styled(item.rank, 8), sourceItem(report, item.source), item.statement, item.accumulatedSeconds, styled(item.executions, 24), item.averageMs, item.truncated ? "Raporda kısaltılmış" : "Tam görünen metin", item.source]),
      empty: "Bu EWA raporunda Top SQL Statements satırı yok.",
    },
    {
      name: "Yoğun SQL", tabColor: "FF8C66B0", title: "Yüksek kaynak kullanan SQL'ler",
      note: `Benzersiz statement hash kayıtları. Sıralama toplam süreye göredir; farklı ölçüm gruplarının değerleri toplanmaz.${report.sqlWindow ? ` Ölçüm penceresi: ${report.sqlWindow}.` : ""}`,
      headings: ["No", "Statement hash", "Toplam süre (sn)", "Çalıştırma", "Ortalama (ms)", "Bellek / çalıştırma (MB)", "Maks. bellek (MB)", "CPU zirve örneği", "Thread örneği", "Kaynak tablo / view", "Ölçüm penceresi", "Rapor kaynağı"],
      widths: [7, 39, 19, 16, 19, 23, 19, 19, 18, 38, 33, 38],
      entries: sql.map((item, index) => [styled(index + 1, 8), item.hash, item.elapsedSeconds ?? null, styled(item.executions ?? null, index % 2 ? 25 : 24), item.averageMs ?? null, item.memoryPerExecutionMb ?? null, item.maximumMemoryMb ?? null, styled(item.cpuPeakSamples ?? null, index % 2 ? 25 : 24), styled(item.threadSamples ?? null, index % 2 ? 25 : 24), item.source ?? "", report.sqlWindow ?? "", item.reportSource ?? item.origin ?? "SAP HANA SQL Statements"]),
      empty: "Bu EWA raporunda doğrulanmış statement hash ve SQL hotspot ölçümü yok.",
    },
    {
      name: "SQL yükü", tabColor: "FF5B8EC6", title: "Veritabanı SQL yükü",
      note: `CPU, I/O ve süre yüzdeleri kaynak bölümdeki ölçüm grubuna aittir; farklı gruplar toplanmaz.${report.sqlLoadImpact ? ` Toplu etki: ${report.sqlLoadImpact.impact} · CPU %${report.sqlLoadImpact.cpu} · I/O %${report.sqlLoadImpact.io} · süre %${report.sqlLoadImpact.elapsed}.` : ""}`,
      headings: ["No", "Nesne / SQL grubu", "CPU yükü (%)", "I/O yükü (%)", "Süre payı (%)", "Çalıştırma", "İşlenen kayıt", "Kaynak bölüm / sayfa"],
      widths: [7, 48, 20, 20, 20, 22, 24, 64],
      entries: loads.map((item, index) => [styled(index + 1, 8), item.object, item.cpuPercent, item.ioPercent, item.elapsedPercent, styled(reportCount(item.executions), index % 2 ? 25 : 24), styled(reportCount(item.records), index % 2 ? 25 : 24), item.source]),
      empty: "Bu EWA raporunda doğrulanmış SQL yük tablosu yok.",
    },
    {
      name: "SQL Server yükü", tabColor: "FF438AA0", title: "SQL Server · pahalı sorgu nesneleri",
      note: "Rapor bu tabloda SQL metni yerine nesne adını verir. Sıralama rapordaki mantıksal okuma yüküne göredir. Yüzdeler rapordaki ölçüm grubuna aittir; farklı satırları toplamadan inceleyin.",
      headings: ["No", "EWA maddesi", "Nesne adı", "Mantıksal okuma %", "Fiziksel okuma %", "CPU %", "Süre %", "Çağrı %", "Çağrı", "Toplam kayıt", "Kaynak bölüm / sayfa"],
      widths: [7, 48, 45, 24, 23, 16, 16, 16, 19, 21, 58],
      entries: report.sqlServerStatements.map((item, index) => [styled(index + 1, 8), sourceItem(report, item.source), item.object, item.logicalReadsPercent, item.physicalReadsPercent, item.cpuPercent, item.elapsedPercent, item.callsPercent, styled(item.calls, 24), styled(item.totalRows, 24), item.source]),
      empty: "Bu EWA raporunda SQL Server pahalı sorgu tablosu yok.",
    },
    {
      name: "HANA parametreleri", tabColor: "FFE3AA49", title: "HANA parametre önerileri",
      note: "Mevcut ve önerilen değerler rapordan alınır. Sarı alanlarda sorumlu, durum ve aksiyon notu güncellenebilir; değişiklikten önce SAP Note doğrulanmalıdır.",
      headings: ["No", "EWA maddesi", "Konum", "Parametre", "Mevcut değer", "Önerilen değer", "SAP Note", "Sorumlu", "Durum", "Aksiyon notu", "Kaynak bölüm / sayfa"],
      widths: [7, 48, 31, 40, 19, 21, 17, 20, 19, 44, 56],
      entries: params.map((item, index) => [styled(index + 1, 8), sourceItem(report, paramSource), item.location, item.parameter, item.current, item.recommended, styled(item.note, 8), styled("DBA", 20), styled("İncelenecek", 13), styled("", 20), sourceWithPage(report, paramSource)]),
      empty: "Bu EWA raporunda doğrulanmış HANA parametre önerisi yok.",
      status: { column: 8, options: ["İncelenecek", "Planlandı", "Uygulandı", "Doğrulandı"], completed: "Doğrulandı" },
    },
    {
      name: "Destek takvimi", tabColor: "FF62A987", title: "Sürüm ve destek tarihleri",
      note: `Gün farkı rapor bitişi ve ${today} için ayrı hesaplanır. Eksi değer sürenin dolduğunu gösterir; üretici desteğini ayrıca doğrulayın.`,
      headings: ["No", "EWA maddesi", "Alan", "Bileşen", "Kurulu sürüm", "Tarih türü", "Bitiş tarihi", "Uzatılmış destek", "Rapor gün farkı", "Bugün gün farkı", "Durum", "Kaynak bölüm / sayfa"],
      widths: [7, 48, 24, 41, 33, 28, 20, 22, 20, 20, 35, 56],
      entries: report.lifecycle.map((item, index) => [styled(index + 1, 8), sourceItem(report, item.source), item.area, item.name, item.installed, item.dateLabel, styled(serialDate(item.endDate), 15), styled(serialDate(item.extendedEnd), 15), styled(dateDelta(item.endDate, reportEnd), index % 2 ? 17 : 16), styled(dateDelta(item.endDate, today), index % 2 ? 17 : 16), item.status, sourceWithPage(report, item.source)]),
      empty: "Bu EWA raporunda doğrulanmış destek bitiş kaydı yok.", negativeColumn: 9,
    },
    {
      name: "Komponent farkları", tabColor: "FF6C9BB2", title: "Komponent güncelleme farkları",
      note: "Mevcut ve raporda son görülen patch veya SP seviyeleri karşılaştırılır. Hedef seviye ve uyumluluk güncelleme öncesi doğrulanmalıdır.",
      headings: ["No", "EWA maddesi", "Komponent", "Sürüm", "Seviye türü", "Mevcut", "Rapordaki son", "Fark", "Paket", "Açıklama", "Kaynak bölüm / sayfa"],
      widths: [7, 48, 30, 18, 18, 17, 19, 14, 35, 49, 56],
      entries: report.componentUpdates.map((item, index) => {
        const title = `Support Package Maintenance - ${item.metric === "SP" ? "JAVA" : "ABAP"}`;
        const source = report.sections.find((section) => section.title === title)?.path ?? `Software Configuration > ${title}`;
        return [styled(index + 1, 8), sourceItem(report, source), item.component, item.version, item.metric, styled(item.installedPatch, index % 2 ? 25 : 24), styled(item.latestPatch, index % 2 ? 25 : 24), styled(item.latestPatch - item.installedPatch, index % 2 ? 25 : 24), item.packageName, item.description, sourceWithPage(report, source)];
      }),
      empty: "Bu EWA raporunda doğrulanmış komponent seviye farkı yok.",
    },
  ];
}

export async function createActionWorkbook(report: EwaReport, translations: TranslationBundle = emptyTranslations(), now = new Date()): Promise<Blob> {
  const lastRow = Math.max(6, report.findings.length + 5);
  const limit = Math.max(505, lastRow + 100);
  const rows: string[] = [
    `<row r="1" ht="30" customHeight="1">${textCell("A1", `${report.kind === "EWA" ? "EWA" : "Bakım"} aksiyon listesi`, 1)}${textCell("J1", "Son güncelleme", 2)}${numberCell("K1", excelDate(now), 4)}</row>`,
    `<row r="2">${textCell("A2", "Sistem", 2)}${textCell("B2", report.sid, 3)}${textCell("D2", "Rapor dönemi", 2)}${textCell("E2", report.period, 3)}</row>`,
    `<row r="3">${textCell("A3", "Dosya", 2)}${textCell("B3", report.filename, 3)}${textCell("D3", "Genel durum", 2)}${textCell("E3", report.rating || "Raporda doğrulanamadı", 3)}${textCell("J3", "Oluşturma", 2)}${numberCell("K3", excelDate(now), 15)}</row>`,
    `<row r="4" ht="23" customHeight="1">${textCell("A4", `Sarı alanlar düzenlenebilir · ${report.kind === "EWA" ? "Veri bulunan ayrıntılar ayrı sekmelerde" : "Aylık bakım aksiyonları"}`, 18)}</row>`,
    `<row r="5" ht="34" customHeight="1">${headings.map((value, index) => textCell(`${columns[index]}5`, report.kind === "EWA" ? value : value === "EWA maddesi" ? "Bakım kontrolü" : value, 5)).join("")}</row>`,
  ];
  report.findings.forEach((finding, index) => {
    const row = index + 6;
    const translation = translations.findings[index];
    const evidence = translation?.evidence || finding.evidence;
    const proof = findingEvidence(report, finding);
    const originalStatement = proof.sourceStatement || (proof.table ? proof.table.values.filter((cell) => cell.value).map((cell) => `${cell.label}: ${cell.value}`).join(" | ") : "") ||
      (report.kind === "EWA" ? "Kaynak bölümde özgün ifade eşleşmedi; raporu kontrol edin." : finding.evidence);
    const base = index % 2 === 0 ? 6 : 7;
    const section = sectionReference(report, finding);
    const source = section?.page && !/·\s*s\.\s*\d+\s*$/.test(finding.source) ? `${finding.source} · s. ${section.page}` : finding.source;
    const values = [ewaItem(report, finding), translation?.title || finding.title, translation?.action || finding.action];
    const height = estimatedRowHeight([...values, evidence, source, originalStatement]);
    rows.push(`<row r="${row}" ht="${height}" customHeight="1">${numberCell(`A${row}`, index + 1, 8)}` +
      values.map((value, offset) => textCell(`${columns[offset + 1]}${row}`, value, base)).join("") +
      textCell(`E${row}`, priorities[finding.priority], { kritik: 9, yuksek: 10, orta: 11, izle: 12 }[finding.priority]) +
      textCell(`F${row}`, finding.owner, base) + textCell(`G${row}`, "Açık", 13) +
      blankCell(`H${row}`, 14) + blankCell(`I${row}`, 14) +
      textCell(`J${row}`, evidence, base) + textCell(`K${row}`, source, base) +
      textCell(`L${row}`, originalStatement, base) + "</row>");
  });
  if (!report.findings.length) rows.push(`<row r="6" ht="48" customHeight="1">${textCell("A6", "Bu raporda güvenilir aksiyon maddesi çıkarılamadı. Varsa veri bulunan ayrıntı sekmelerini ve kaynak EWA raporunu inceleyin.", 19)}</row>`);
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><tabColor rgb="FF24677C"/></sheetPr><dimension ref="A1:L${lastRow}"/>
<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A6" sqref="A6"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18"/><cols>${[7, 34, 38, 55, 13, 24, 16, 17, 18, 56, 49, 56].map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rows.join("")}</sheetData>${report.findings.length ? `<autoFilter ref="A5:L${lastRow}"/>` : ""}
<mergeCells count="${report.findings.length ? 2 : 3}"><mergeCell ref="A1:I1"/><mergeCell ref="A4:I4"/>${report.findings.length ? "" : '<mergeCell ref="A6:L6"/>'}</mergeCells>
<conditionalFormatting sqref="A6:L${limit}"><cfRule type="expression" dxfId="0" priority="1"><formula>$G6="Tamamlandı"</formula></cfRule></conditionalFormatting>
<dataValidations count="1"><dataValidation type="list" allowBlank="0" showErrorMessage="1" errorTitle="Durum seçin" error="Listedeki durumlardan birini seçin." sqref="G6:G${limit}"><formula1>"Açık,İncelemede,Planlandı,Tamamlandı"</formula1></dataValidation></dataValidations>
<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
  const zip = new JSZip();
  const sheets = [{ name: "Aksiyon listesi", xml: sheet }, ...(report.kind === "EWA" ? detailSheets(report, now).filter((spec) => spec.entries.length > 0).map((spec) => ({ name: spec.name, xml: dataSheetXml(report, spec) })) : [])];
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(report.sid)} EWA aksiyon listesi</dc:title><dc:creator>EWA Radar</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now.toISOString()}</dcterms:created></cp:coreProperties>`);
  zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>EWA Radar</Application></Properties>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((item, index) => `<sheet name="${xml(item.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/styles.xml", styles);
  sheets.forEach((item, index) => zip.file(`xl/worksheets/sheet${index + 1}.xml`, item.xml));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 }, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
