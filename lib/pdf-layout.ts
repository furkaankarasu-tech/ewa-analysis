import type { ReportSection, ReportTable } from "./report-structure.ts";
import type { TopSqlStatement } from "./top-sql.ts";
import type { SqlHotspot } from "./ewa-detail.ts";
import type { SqlServerStatement } from "./sql-load.ts";

type PdfItem = { str: string; x: number; y: number; width: number; height: number };
type PdfLine = { text: string; page: number; y: number; items: PdfItem[]; level: number };

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const date = /\b\d{2}\.\d{2}\.\d{4}\b/;
const issue = /\b(?:not|no|without|failed|unsuccessful|outdated|critical|expired|expire|exhausted|backlog|bottleneck|risk|error|unprotected|reached|significant|increase|high|warning|insufficient|inactive|disabled|missing|exceeded|run out of|out of security maintenance)\b/i;
const boilerplate = /^(?:EarlyWatch Alert|Confidential|Authorized for SAP|To provide feedback|For more information|The following table|Rating Legend|Mainstream \/ Extended maintenance offered|This section contains|The table below|SAP Note \d+)/i;

function groupLines(items: PdfItem[], page: number): PdfLine[] {
  const rows: PdfItem[][] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((group) => Math.abs(group[0].y - item.y) < 2.3);
    if (row) row.push(item); else rows.push([item]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    const text = clean(row.map((item) => item.str).join(" "));
    const match = text.match(/^(\d{1,2}(?:\.\d{1,2}){0,5})\s+([^\d].{3,})$/);
    const height = Math.max(...row.map((item) => item.height));
    return { text, page, y: row[0].y, items: row, level: match && height >= 12 ? match[1].split(".").length : 0 };
  }).filter((line) => line.text && line.y > 50 && line.y < 790 || page === 1 && line.text);
}

function tablePieces(line: PdfLine) {
  const pieces: { text: string; x: number }[] = [];
  for (const item of line.items) {
    if (!clean(item.str)) continue;
    const previous = pieces.at(-1);
    const previousEnd = line.items.filter((candidate) => candidate.x < item.x && clean(candidate.str)).at(-1);
    if (previous && previousEnd && item.x - (previousEnd.x + previousEnd.width) < 4) previous.text = clean(`${previous.text} ${item.str}`);
    else pieces.push({ text: clean(item.str), x: item.x });
  }
  return pieces;
}

function tablesFromLines(lines: PdfLine[], sectionTitle: string): ReportTable[] {
  const output: ReportTable[] = [];
  let group: { line: PdfLine; pieces: ReturnType<typeof tablePieces> }[] = [];
  const flush = () => {
    if (group.length < 2 || !group.some(({ line }) => /\d/.test(line.text))) { group = []; return; }
    const first = group[0].pieces;
    if (first.length < 2) { group = []; return; }
    if (/^(?:"|SELECT\b|FROM\b|WHERE\b|IF\b|\d{4,}\s)|[=:]/i.test(first[0].text)) { group = []; return; }
    const anchors = first.map((piece) => piece.x);
    const rows = group.map(({ pieces }) => {
      const cells = Array(anchors.length).fill("") as string[];
      for (const piece of pieces) {
        let col = 0;
        for (let at = 1; at < anchors.length; at++) if (piece.x >= anchors[at] - 5) col = at;
        cells[col] = clean(`${cells[col]} ${piece.text}`);
      }
      return cells;
    });
    if (rows[1] && /^(?:Component|Description)$/i.test(rows[1][0]) && !/\d/.test(rows[1].join(""))) {
      rows[0] = rows[0].map((cell, index) => clean(`${cell} ${rows[1][index]}`));
      rows.splice(1, 1);
    }
    if (rows.slice(1).some((row) => row.filter(Boolean).length >= 2)) {
      output.push({ title: sectionTitle, header: rows[0], rows: rows.slice(1, 100), totalRows: rows.length - 1 });
    }
    group = [];
  };
  for (const line of lines) {
    const pieces = tablePieces(line);
    const gap = group.length ? group.at(-1)!.line.y - line.y : 0;
    const firstX = group[0]?.pieces[0].x ?? 0;
    const continuation = group.length > 0 && gap > 0 && gap <= 16 && pieces.length > 0 && pieces[0].x > firstX + 22;
    const tabular = pieces.length >= 2 && pieces.at(-1)!.x - pieces[0].x > 75 && line.level === 0 && !boilerplate.test(line.text);
    if (group.length && (line.page !== group.at(-1)!.line.page || gap > 55 || !tabular && !continuation || tabular && /^\w+\s+(?:Version|Component)\b.*End of/i.test(line.text))) flush();
    if (continuation && group.length) group.at(-1)!.pieces.push(...pieces);
    else if (tabular) group.push({ line, pieces });
  }
  flush();
  return output.slice(0, 12);
}

function selectObservations(lines: PdfLine[]) {
  const ranked = lines.map((line, index) => ({
    line, index,
    score: (issue.test(line.text) ? 3 : 0) + (date.test(line.text) ? 2 : 0) + (/\d/.test(line.text) ? 1 : 0) + (/^Recommendation:/i.test(line.text) ? -10 : 0),
  })).filter(({ line, score }) => score > 0 && !boilerplate.test(line.text) && line.text.length > 16);
  const picked = ranked.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 7).sort((a, b) => a.index - b.index);
  return picked.map(({ line }) => line.text.slice(0, 650));
}

function topSqlFromPdf(lines: PdfLine[], section: ReportSection): TopSqlStatement[] {
  const rankHeader = lines.find((line) => line.items.some((item) => clean(item.str) === "Rank") && line.items.some((item) => clean(item.str) === "Name"));
  const item = (label: string) => lines.flatMap((line) => line.items).find((part) => clean(part.str) === label);
  const rankX = rankHeader?.items.find((part) => clean(part.str) === "Rank")?.x;
  const nameX = rankHeader?.items.find((part) => clean(part.str) === "Name")?.x;
  const accumulatedX = item("Acc.")?.x, executionsX = item("Execs.")?.x, averageX = item("Ave.")?.x;
  if ([rankX, nameX, accumulatedX, executionsX, averageX].some((value) => value === undefined) ||
      !(rankX! < nameX! && nameX! < accumulatedX! && accumulatedX! < executionsX! && executionsX! < averageX!)) return [];
  const start = lines.findIndex((line) => line.text.includes("[ms]"));
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && /^Recommendation\s*:/i.test(line.text));
  const content = lines.slice(start + 1, end < 0 ? undefined : end);
  const output: TopSqlStatement[] = [];
  for (const page of [...new Set(content.map((line) => line.page))]) {
    const parts = content.filter((line) => line.page === page).flatMap((line) => line.items);
    const names = parts.filter((part) => part.x >= nameX! - 4 && part.x < accumulatedX! - 4 && clean(part.str))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const groups: PdfItem[][] = [];
    for (const part of names) {
      const last = groups.at(-1);
      if (!last || last.at(-1)!.y - part.y > 19) groups.push([part]);
      else last.push(part);
    }
    for (const group of groups) {
      const high = group[0].y + 8, low = group.at(-1)!.y - 8;
      const rank = parts.filter((part) => Math.abs(part.x - rankX!) < 5 && part.y <= high && part.y >= low && /^\d{1,3}$/.test(clean(part.str)));
      if (rank.length !== 1) continue;
      const valueAt = (x: number) => {
        const candidate = parts.filter((part) => Math.abs(part.x - x) < 5 && Math.abs(part.y - rank[0].y) < 3);
        if (candidate.length !== 1 || !/^\d+(?:[.,]\d+)?$/.test(clean(candidate[0].str))) return NaN;
        return Number(candidate[0].str.replace(",", "."));
      };
      const position = Number(rank[0].str), seconds = valueAt(accumulatedX!), count = valueAt(executionsX!), ms = valueAt(averageX!);
      const statement = clean(group.map((part) => part.str).join(" "));
      if (position < 1 || position > 100 || !statement || ![seconds, count, ms].every((value) => Number.isFinite(value) && value >= 0) || !Number.isInteger(count)) continue;
      output.push({ rank: position, statement, accumulatedSeconds: seconds, executions: count,
        averageMs: ms, source: `${section.path} · s. ${page}`, truncated: /\.{3}|…/.test(statement) });
    }
  }
  return output.sort((a, b) => a.rank - b.rank);
}

function hanaHotspotsFromPdf(lines: PdfLine[], headings: { line: PdfLine; index: number }[]): SqlHotspot[] {
  const hotspots = new Map<string, SqlHotspot>();
  const numeric = (raw: string) => {
    const value = raw.trim();
    if (!/^\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^\d+(?:,\d+)?$/.test(value)) return NaN;
    return Number(value.replace(/\./g, "").replace(",", "."));
  };
  for (let index = 0; index < lines.length; index++) {
    const header = lines[index];
    const hashHeader = header.items.find((item) => clean(item.str) === "Statement Hash");
    if (!hashHeader || header.items.length < 3) continue;
    const columns = header.items.filter((item) => item.x > hashHeader.x + 25).sort((a, b) => a.x - b.x);
    if (!columns.some((item) => /Total Elapsed|Time \/ Execution|Number of Samples|Memory \/ Execution|Maximum Memory|CPU Peak Hour/i.test(item.str))) continue;
    const context = headings.filter((entry) => entry.index < index && /\bTop Statements \(/i.test(entry.line.text)).at(-1)?.line.text.replace(/^\d+(?:\.\d+)*\s+/, "") ?? "SAP HANA SQL Statements";
    const fields = columns.map((item) => /Total Elapsed/i.test(item.str) ? "elapsedSeconds" :
      /Time \/ Execution/i.test(item.str) ? "averageMs" : /Memory \/ Execution/i.test(item.str) ? "memoryPerExecutionMb" :
      /Maximum Memory/i.test(item.str) ? "maximumMemoryMb" : /Samples in CPU Peak Hour/i.test(item.str) ? "cpuPeakSamples" :
      /Number of Samples/i.test(item.str) ? "threadSamples" : /Number of/i.test(item.str) ? "executions" : null);
    for (let at = index + 1; at < Math.min(lines.length, index + 75); at++) {
      const row = lines[at];
      if (row.page !== header.page || /^\d+(?:\.\d+)*\s+SQL Statement\b|^Recommendation\s*:/.test(row.text) || row.level > 0 || row.items.some((part) => clean(part.str) === "Statement Hash")) break;
      const first = row.items.find((part) => Math.abs(part.x - hashHeader.x) < 5 && /^[a-f0-9]{12,32}$/i.test(clean(part.str)));
      const values = row.items.filter((part) => part.x > hashHeader.x + 25 && Number.isFinite(numeric(part.str))).sort((a, b) => a.x - b.x);
      if (!first || values.length !== columns.length) continue;
      let hash = clean(first.str);
      for (let next = at + 1; next < Math.min(at + 4, lines.length) && hash.length < 32; next++) {
        const continuation = lines[next];
        if (continuation.page !== row.page || continuation.items.length !== 1 || Math.abs(continuation.items[0].x - hashHeader.x) >= 5 ||
            !/^[a-f0-9]{1,20}$/i.test(clean(continuation.items[0].str))) break;
        hash += clean(continuation.items[0].str);
      }
      if (!/^[a-f0-9]{32}$/i.test(hash)) continue;
      const hotspot = hotspots.get(hash) ?? { hash };
      for (let col = 0; col < fields.length; col++) {
        const key = fields[col];
        if (!key) continue;
        const measured = numeric(values[col].str) / (key === "averageMs" ? 1000 : 1);
        if (Number.isFinite(measured) && (hotspot[key] === undefined || measured > hotspot[key]!)) hotspot[key] = measured;
      }
      hotspot.reportSource ??= `${context} · s. ${row.page}`;
      hotspots.set(hash, hotspot);
    }
  }
  return [...hotspots.values()];
}

function sqlServerFromPdf(lines: PdfLine[], headings: { line: PdfLine; index: number }[], sections: ReportSection[]): SqlServerStatement[] {
  const output: SqlServerStatement[] = [];
  const value = (raw: string) => Number(raw.replace(/\./g, "").replace(",", "."));
  const number = "(\\d+(?:[.,]\\d+)*)";
  const rowPattern = new RegExp(`^(.+?)\\s+${Array(7).fill(number).join("\\s+")}$`);
  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index];
    if (heading.text !== "Expensive SQL Statements Overview" || !lines.slice(index + 1, index + 5).some((line) => /^Object Name\s+Elapsed time/.test(line.text))) continue;
    const parentHeading = headings.filter((entry) => entry.index < index).at(-1)?.line;
    const parentNumber = parentHeading?.text.match(/^(\d+(?:\.\d+)*)\s+/)?.[1];
    const parent = sections.find((section) => section.number === parentNumber && section.page === parentHeading?.page);
    const source = `${parent?.path ?? "Expensive SQL Statements Overview"} · s. ${heading.page}`;
    for (let at = index + 1; at < Math.min(lines.length, index + 45); at++) {
      const line = lines[at];
      if (line.page !== heading.page || /^The statements were selected|^\d+(?:\.\d+)*\s+Access on\b/.test(line.text)) break;
      const matched = line.text.match(rowPattern);
      if (matched && !/^Object Name/.test(matched[1])) {
        const values = matched.slice(2).map(value);
        if (values.every((number) => Number.isFinite(number) && number >= 0) && Number.isInteger(values[2]) && Number.isInteger(values[3]))
          output.push({ object: matched[1], elapsedPercent: values[0], callsPercent: values[1], calls: values[2], totalRows: values[3],
            logicalReadsPercent: values[4], physicalReadsPercent: values[5], cpuPercent: values[6], source });
      } else if (output.length && line.items.length === 1 && Math.abs(line.items[0].x - lines[at - 1].items[0].x) < 5 &&
          /^[a-z_][\w\].,]*$/i.test(line.text) && output.at(-1)!.source === source) {
        output.at(-1)!.object += line.text;
      }
    }
  }
  return output;
}

export function parsePdfLayout(pages: { page: number; items: PdfItem[] }[]) {
  const pdfLines = pages.flatMap(({ page, items }) => groupLines(items, page));
  const lines = pdfLines.map((line) => line.text);
  const sections: ReportSection[] = [];
  const topSqlStatements: TopSqlStatement[] = [];
  const headings = pdfLines.map((line, index) => ({ line, index })).filter(({ line }) => line.level > 0);
  const stack: { level: number; title: string }[] = [];
  for (let at = 0; at < headings.length; at++) {
    const { line, index } = headings[at];
    const number = line.text.match(/^(\d{1,2}(?:\.\d{1,2}){0,5})\s+/)?.[1];
    let title = line.text.replace(/^\d{1,2}(?:\.\d{1,2}){0,5}\s+/, "");
    const following = pdfLines[index + 1];
    if (/\bof$/i.test(title) && following?.page === line.page && line.y - following.y < 22 && /^[A-Z0-9]{3}$/.test(following.text)) title += ` ${following.text}`;
    if (/^SQL Statement [a-f0-9]{32}$/i.test(title)) continue;
    while (stack.length && stack.at(-1)!.level >= line.level) stack.pop();
    stack.push({ level: line.level, title });
    const end = headings[at + 1]?.index ?? pdfLines.length;
    const content = pdfLines.slice(index + 1, end).filter((entry) => !/^(?:EarlyWatch Alert|Confidential|\d+\/\d+)$/.test(entry.text));
    const recommendations: string[] = [];
    for (let at = 0; at < content.length && recommendations.length < 20; at++) {
      if (!/^Recommendation\s*:/i.test(content[at].text)) continue;
      const parts = [content[at].text];
      for (let next = at + 1; next < Math.min(content.length, at + 40); next++) {
        if (/[.!?]\s*$/.test(parts.at(-1)!) || /^(?:Recommendation|\d+(?:\.\d+)*\s|Rating Legend)/i.test(content[next].text)) break;
        parts.push(content[next].text);
      }
      recommendations.push(parts.join(" ").slice(0, 8000));
    }
    const tables = tablesFromLines(content, title);
    const section = { title, path: stack.map((entry) => entry.title).join(" > "), number, level: line.level, rating: "unknown" as const, observations: selectObservations(content), recommendations, tables, page: line.page };
    sections.push(section);
    if (/\bTop SQL Statements\b/i.test(title)) topSqlStatements.push(...topSqlFromPdf(content, section));
  }
  return { lines, sections, tables: sections.flatMap((section) => section.tables), topSqlStatements, pdfSqlHotspots: hanaHotspotsFromPdf(pdfLines, headings), sqlServerStatements: sqlServerFromPdf(pdfLines, headings, sections) };
}
