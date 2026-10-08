export type ReportTable = {
  title: string;
  header: string[];
  rows: string[][];
  totalRows: number;
};

export type ReportSection = {
  title: string;
  path: string;
  number?: string;
  level: number;
  rating: "red" | "yellow" | "green" | "unknown";
  observations: string[];
  recommendations: string[];
  tables: ReportTable[];
  page?: number;
};

const WORDML = "http://schemas.microsoft.com/office/word/2003/wordml";
const WORD_AUX = "http://schemas.microsoft.com/office/word/2003/auxHint";
const DOCX = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const VML = "urn:schemas-microsoft-com:vml";
type Rating = ReportSection["rating"];
const weight: Record<Rating, number> = { red: 3, yellow: 2, green: 1, unknown: 0 };

function clean(text: string) { return text.replace(/\s+/g, " ").trim(); }
function textOf(node: Element, ns: string) {
  return clean(Array.from(node.getElementsByTagNameNS(ns, "t")).map((part) => part.textContent ?? "").join(""));
}
function recommendationTextOf(node: Element, ns: string) {
  return clean(Array.from(node.getElementsByTagNameNS(ns, "r"))
    .map((run) => Array.from(run.getElementsByTagNameNS(ns, "t")).map((part) => part.textContent ?? "").join(""))
    .filter(Boolean).join(" "));
}
function direct(node: Element, ns: string, tag: string) {
  return (Array.from(node.childNodes).filter((child) => child.nodeType === 1) as Element[]).filter((child) => child.namespaceURI === ns && child.localName === tag);
}
function children(node: Element) { return Array.from(node.childNodes).filter((child) => child.nodeType === 1) as Element[]; }
function levelOf(paragraph: Element, ns: string) {
  const style = paragraph.getElementsByTagNameNS(ns, "pStyle")[0]?.getAttributeNS(ns, "val") ?? "";
  return Number(style.match(/^Heading\s*([1-6])$/)?.[1] ?? 0);
}
function iconOf(cell: Element) { return cell.getElementsByTagNameNS(VML, "imagedata")[0]?.getAttribute("src") ?? ""; }
function maxRating(ratings: Rating[]) { return ratings.sort((a, b) => weight[b] - weight[a])[0] ?? "unknown"; }

function parseTable(table: Element, ns: string, classify: (src: string) => Rating, title: string) {
  const rows = Array.from(table.getElementsByTagNameNS(ns, "tr")).map((row) => {
    const cells = direct(row, ns, "tc");
    return { cells: cells.map((cell) => textOf(cell, ns)), ratings: cells.map((cell) => classify(iconOf(cell))) };
  });
  const header = rows[0]?.cells ?? [];
  const body = rows.slice(1);
  const issueRows = body.filter((row) => row.ratings.includes("red") || row.ratings.includes("yellow"));
  const selected = [...issueRows, ...body.filter((row) => !issueRows.includes(row))].slice(0, 12);
  const ratings = rows.flatMap((row) => row.ratings).filter((rating) => rating !== "unknown");
  return {
    rating: maxRating(ratings),
    table: { title, header, rows: selected.map((row) => row.cells), totalRows: body.length } as ReportTable,
  };
}

function overviewRatings(document: Document, ns: string, classify: (src: string) => Rating) {
  const ratings = new Map<string, Rating>();
  const headings = Array.from(document.getElementsByTagNameNS(ns, "p"));
  const heading = headings.find((node) => textOf(node, ns) === "Check Overview");
  if (!heading) return ratings;
  const siblings = children(heading.parentNode as Element);
  const next = siblings.slice(siblings.indexOf(heading) + 1).find((node) => node.localName === "tbl");
  if (!next) return ratings;
  for (const row of Array.from(next.getElementsByTagNameNS(ns, "tr")).slice(1)) {
    const cells = direct(row, ns, "tc");
    for (const cell of cells) {
      const title = textOf(cell, ns);
      if (!title) continue;
      const cellIndex = cells.indexOf(cell);
      const rating = classify(iconOf(cells[cellIndex - 1] ?? cell));
      if (rating !== "unknown") ratings.set(title.toLowerCase(), rating);
    }
  }
  return ratings;
}

function isBoilerplate(text: string) {
  return /^(?:For more information|The following table shows|To access |Please refer to|If you have any questions|The table below|Note:)/i.test(text);
}

function parseDocxSections(document: Document, classify: (src: string) => Rating): ReportSection[] {
  const body = document.getElementsByTagNameNS(DOCX, "body")[0];
  if (!body) return [];
  const sections: ReportSection[] = [];
  const stack: { level: number; title: string }[] = [];
  let current: ReportSection | null = null;
  let tableTitle = "";
  const finish = () => { if (current) sections.push(current); current = null; };
  for (const child of children(body)) {
    if (child.namespaceURI !== DOCX) continue;
    if (child.localName === "p") {
      const value = textOf(child, DOCX);
      if (!value) continue;
      const style = child.getElementsByTagNameNS(DOCX, "pStyle")[0]?.getAttributeNS(DOCX, "val") ?? "";
      const level = Number(style.match(/^(?:Heading|heading\s*)([1-6])$/)?.[1] ?? 0);
      if (level) {
        finish();
        while (stack.length && stack.at(-1)!.level >= level) stack.pop();
        stack.push({ level, title: value });
        const number = value.match(/^(\d+(?:\.\d+)*)\s+/)?.[1];
        current = { title: value, path: stack.map((item) => item.title).join(" > "), number, level, rating: "unknown", observations: [], recommendations: [], tables: [] };
      } else if (current) {
        if (/sa-table-title/i.test(style)) tableTitle = value;
        else if ((/sa-recommendation/i.test(style) || /^Recommendation:/i.test(value)) && current.recommendations.length < 20) current.recommendations.push(recommendationTextOf(child, DOCX).slice(0, 2400));
        else if (!isBoilerplate(value) && current.observations.length < 8) current.observations.push(value.slice(0, 650));
      }
    } else if (child.localName === "tbl" && current) {
      const result = parseTable(child, DOCX, classify, tableTitle);
      tableTitle = "";
      if (result.table.totalRows > 0 && result.table.header.some(Boolean) && current.tables.length < 8) current.tables.push(result.table);
      if (weight[result.rating] > weight[current.rating]) current.rating = result.rating;
    }
  }
  finish();
  return sections;
}

export function parseReportSections(document: Document | null, format: string, classify: (src: string) => Rating): ReportSection[] {
  if (!document) return [];
  if (format === "DOCX") return parseDocxSections(document, classify);
  const ns = format === "Word XML (.doc)" ? WORDML : format === "DOCX" ? DOCX : "";
  if (!ns) return [];
  const ratings = overviewRatings(document, ns, classify);
  const sections: ReportSection[] = [];
  const candidates = Array.from(document.getElementsByTagNameNS(WORD_AUX, "sub-section"));
  const numberedCounters: number[] = [];
  for (const node of candidates) {
    const heading = direct(node, ns, "p").find((paragraph) => levelOf(paragraph, ns) > 0);
    if (!heading) continue;
    const title = textOf(heading, ns);
    if (!title) continue;
    const level = levelOf(heading, ns);
    const literalNumber = title.match(/^(\d+(?:\.\d+)*)\s+/)?.[1];
    const automaticNumber = Array.from(heading.getElementsByTagNameNS(ns, "instrText"))
      .some((field) => /\bAUTONUMLGL\b/i.test(field.textContent ?? ""));
    if (literalNumber && literalNumber.split(".").length === level) {
      numberedCounters.splice(0, numberedCounters.length, ...literalNumber.split(".").map(Number));
    } else if (automaticNumber) {
      numberedCounters[level - 1] = (numberedCounters[level - 1] ?? 0) + 1;
      numberedCounters.length = level;
    }
    // Word XML's AUTONUMLGL field records that the heading is numbered, but
    // its displayed result is often absent. Count only numbered headings.
    const number = literalNumber ??
      (automaticNumber && Array.from({ length: level }, (_, index) => numberedCounters[index]).every((part) => part > 0) ? numberedCounters.join(".") : undefined);
    // A skipped SQL heading still advances the numbering of later siblings.
    if (/^SQL Statement [a-f0-9]{32}$/i.test(title)) continue;
    const parents: string[] = [];
    let parent = node.parentNode as Element | null;
    while (parent) {
      if (parent.namespaceURI === WORD_AUX && parent.localName === "sub-section") {
        const parentHeading = direct(parent, ns, "p").find((paragraph) => levelOf(paragraph, ns) > 0);
        if (parentHeading) parents.unshift(textOf(parentHeading, ns));
      }
      parent = parent.parentNode as Element | null;
    }
    if (parents.some((name) => name.startsWith("SAP HANA SQL Statements"))) continue;
    const paragraphs = direct(node, ns, "p").filter((paragraph) => paragraph !== heading);
    const observations: string[] = [];
    const recommendations: string[] = [];
    const tables: ReportTable[] = [];
    const foundRatings: Rating[] = [classify(iconOf(heading))];
    let tableTitle = "";
    for (const child of children(node)) {
      if (child.namespaceURI !== ns) continue;
      if (child.localName === "p" && child !== heading) {
        const content = textOf(child, ns);
        if (!content) continue;
        const style = child.getElementsByTagNameNS(ns, "pStyle")[0]?.getAttributeNS(ns, "val") ?? "";
        if (/sa-table-title/.test(style)) { tableTitle = content; continue; }
        if (/sa-recommendation/.test(style) || /^Recommendation:/i.test(content)) {
          if (recommendations.length < 20) recommendations.push(recommendationTextOf(child, ns).slice(0, 2400));
        } else if (paragraphs.includes(child) && !isBoilerplate(content) && observations.length < 5) observations.push(content.slice(0, 650));
      } else if (child.localName === "tbl") {
        const result = parseTable(child, ns, classify, tableTitle);
        tableTitle = "";
        if (result.rating !== "unknown") foundRatings.push(result.rating);
        if (result.table.totalRows > 0 && result.table.header.some(Boolean) && tables.length < 5) tables.push(result.table);
      }
    }
    const overviewRating = ratings.get(title.toLowerCase()) ?? "unknown";
    const rating = maxRating([overviewRating, ...foundRatings]);
    const path = [...parents, title].join(" > ");
    sections.push({ title, path, number, level, rating, observations, recommendations, tables });
  }
  return sections;
}

export function isActionable(section: ReportSection) {
  if (section.level === 1 || section.title.startsWith("SAP HANA SQL Statements")) return false;
  if (section.rating === "red" || section.rating === "yellow") return true;
  if (section.rating === "green") return false;
  const issue = /not implemented|not set up|missing|outdated|failed|unsuccessful|unprocessed|inactive|disabled|occurred|errors|exhausted|not effective|critical conditions|No Archiving Set|not downloaded|expired|expire|not anymore|no longer|run out of|maintenance end is reached|more than \d|less than \d|significant load|backlog|bottleneck|risk|insufficient|HIGH/i;
  return section.observations.some((text) => issue.test(text)) || section.tables.some((table) => table.rows.some((row) => row.some((text) => issue.test(text))));
}

export function sectionInterpretation(section: ReportSection) {
  const conditional = /^(?:If |In case |The following |This section |For more information|Please note|Rating Legend)/i;
  const observed = section.observations.filter((item) => !conditional.test(item));
  const issue = observed.find((item) => /\b(?:your|system|database|table|statement|user|backup|parameter|version)\b/i.test(item) && /\b(?:not|no|missing|failed|expired|critical|risk|high|load|reached|outdated|insufficient|backlog)\b/i.test(item)) ?? observed.find((item) => /\d/.test(item)) ?? observed[0] ?? "";
  const impact = observed.find((item) => /\b(?:risk of|may result|may affect|can lead|might overload|performance problems|downtime|not protected|no longer ensured)\b/i.test(item)) ?? "";
  const cause = observed.find((item) => /\b(?:due to|because|caused by|root cause|as a result of)\b/i.test(item)) ?? "";
  const table = section.tables.find((item) => item.rows.length);
  const row = table?.rows.find((item) => item.some((cell) => /\d|HIGH|failed|expired/i.test(cell))) ?? table?.rows[0];
  const measure = row ? `${table?.header.filter(Boolean).join(" | ")}: ${row.filter(Boolean).join(" | ")}`.slice(0, 380) : "";
  return { issue, impact: impact !== issue ? impact : "", cause: cause !== issue ? cause : "", measure, action: section.recommendations[0]?.replace(/^Recommendation\s*:\s*/i, "") ?? "" };
}
