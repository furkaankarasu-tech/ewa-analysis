import type { ReportSection, ReportTable } from "./report-structure.ts";

type Rating = ReportSection["rating"];
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const rating = (image: Element | null): Rating => {
  const alt = image?.getAttribute("alt") ?? "";
  return /\bred rating\b/i.test(alt) ? "red" : /\byellow rating\b/i.test(alt) ? "yellow" : /\bgreen rating\b/i.test(alt) ? "green" : "unknown";
};
const children = (node: Element) => Array.from(node.children);
const content = (node: Element) => clean(node.textContent ?? "");
const numberedTitle = (value: string) => clean(value.replace(/^\d+(?:\.\d+)*\s+/, ""));

function rowsOf(table: Element) {
  return Array.from(table.getElementsByTagName("tr")).filter((row) => {
    let parent = row.parentElement;
    while (parent && parent.tagName.toLowerCase() !== "table") parent = parent.parentElement;
    return parent === table;
  }).map((row) => children(row).filter((cell) => /^(?:td|th)$/i.test(cell.tagName)));
}

function parseTable(table: Element, title: string) {
  const rows = rowsOf(table);
  const values = rows.map((row) => row.map(content));
  if (!values.length) return null;
  const caption = values[0].filter(Boolean);
  const start = caption.length === 1 && values[1]?.filter(Boolean).length > 1 ? 1 : 0;
  const header = values[start];
  if (!header?.some(Boolean) || values.length <= start + 1) return null;
  const ratings = rows.slice(start + 1).flatMap((row) => row.map((cell) => rating(cell.getElementsByTagName("img")[0] ?? null)));
  const severity: Rating = ratings.includes("red") ? "red" : ratings.includes("yellow") ? "yellow" : ratings.includes("green") ? "green" : "unknown";
  return { severity, table: { title: start ? caption[0] : title, header, rows: values.slice(start + 1, start + 301), totalRows: values.length - start - 1 } as ReportTable };
}

function textLines(node: Element): string[] {
  const lines: string[] = [];
  const walk = (element: Element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === "table") {
      for (const row of rowsOf(element)) for (const cell of row) {
        if (cell.getElementsByTagName("table").length) { for (const nested of children(cell)) walk(nested); continue; }
        const value = content(cell);
        if (value) lines.push(value);
      }
      return;
    }
    if (/^h[1-6]$/.test(tag)) { lines.push(numberedTitle(content(element))); return; }
    if (["script", "style", "noscript", "svg"].includes(tag)) return;
    const blocks = children(element).filter((child) => /^(?:div|p|table|ul|ol|li|pre|h[1-6])$/i.test(child.tagName));
    if (element.getElementsByTagName("table").length && !blocks.length) { for (const child of children(element)) walk(child); return; }
    if (blocks.length) {
      const direct = clean(Array.from(element.childNodes).filter((part) => part.nodeType === 3).map((part) => part.textContent ?? "").join(" "));
      if (direct) lines.push(direct);
      for (const child of children(element)) walk(child);
    } else {
      const value = content(element);
      if (value) lines.push(value);
    }
  };
  walk(node);
  return lines;
}

function tableNamed(root: Element, name: string) {
  return Array.from(root.getElementsByTagName("table")).find((table) => content(rowsOf(table)[0]?.[0] ?? table) === name);
}

export function parseHtmlEwa(raw: string) {
  // Detached DOM only: the report is never inserted into the page. Remove active
  // content and resource URLs before parsing to prevent execution or fetches.
  const inert = raw.replace(/<(?:script|style|iframe|object|embed|form|svg|link)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed|form|svg|link)\s*>/gi, "")
    .replace(/<(?:script|style|iframe|object|embed|form|svg|link|meta)\b[^>]*\/?>/gi, "")
    .replace(/\s(?:src|href|srcset|action|formaction|background|style)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  const document = new DOMParser().parseFromString(inert, "text/html");
  const body = document.body;
  if (!body) throw new Error("HTML raporunun gövdesi okunamadı.");
  const reportHeadings = children(body).filter((node) => /^h[1-6]$/i.test(node.tagName));
  const alertTable = tableNamed(body, "Alert Overview");
  if (!alertTable || reportHeadings.length < 4) throw new Error("Bu HTML dosyasında SAP EWA bölümleri ve Alert Overview bulunamadı.");
  const alertItems = rowsOf(alertTable).slice(1).map((row) => ({
    title: content(row[1] ?? row[0]), severity: rating(row[0]?.getElementsByTagName("img")[0] ?? null),
  })).filter((item) => item.title);
  const decisiveTable = tableNamed(body, "Alerts Decisive For Red Report");
  const decisive = decisiveTable ? rowsOf(decisiveTable).slice(1).map((row) => content(row.at(-1)!)).filter(Boolean) : [];
  const summary = reportHeadings.find((heading) => numberedTitle(content(heading)) === "Service Summary");
  const summaryImage = summary?.nextElementSibling?.getElementsByTagName("img")[0] ?? null;
  const summaryRating = rating(summaryImage);

  const overview = tableNamed(body, "Check Overview");
  const overviewRatings = new Map<string, Rating>();
  if (overview) for (const row of rowsOf(overview).slice(2)) {
    for (let i = 1; i < row.length; i += 2) {
      const title = content(row[i]); const state = rating(row[i - 1]?.getElementsByTagName("img")[0] ?? null);
      if (title && state !== "unknown") overviewRatings.set(title.toLowerCase(), state);
    }
  }

  const sections: ReportSection[] = [];
  const stack: { level: number; title: string }[] = [];
  for (const heading of reportHeadings) {
    const level = Number(heading.tagName.slice(1));
    const rawTitle = content(heading);
    const number = rawTitle.match(/^(\d+(?:\.\d+)*)\s+/)?.[1];
    const title = numberedTitle(rawTitle);
    while (stack.length && stack.at(-1)!.level >= level) stack.pop();
    stack.push({ level, title });
    const region = heading.nextElementSibling;
    const regionTables = region && !/^h[1-6]$/i.test(region.tagName) ? Array.from(region.getElementsByTagName("table")) : [];
    const results = regionTables.map((table) => parseTable(table, title)).filter((item) => item !== null && (item.table.header.length > 1 || /Name of Missing Database Index/i.test(item.table.header[0] ?? "")) &&
      !/Rating Legend/i.test(item.table.title) && !(item.table.header[0] === "Rating" && item.table.header[1] === "Description") &&
      !item.table.header.some((cell) => /Rating Legend/i.test(cell)));
    const candidates = region && !/^h[1-6]$/i.test(region.tagName) ? textLines(region) : [];
    const observations = candidates.filter((line) => line.length >= 24 && !/^(?:Recommendation\s*:|\d+\.\s+Please|For more information|The following table)/i.test(line)).slice(0, 7).map((line) => line.slice(0, 650));
    const recommendations = region ? Array.from(region.getElementsByTagName("div")).concat(Array.from(region.getElementsByTagName("p")))
      .filter((node) => /sa-recommendation/i.test(node.getAttribute("class") ?? "") || /^Recommendation\s*:/i.test(content(node)) && !node.getElementsByTagName("div").length)
      .map(content).filter(Boolean).slice(0, 20) : [];
    const own = results.map((item) => item!.severity);
    const mapped = overviewRatings.get(title.toLowerCase()) ?? "unknown";
    const sectionRating: Rating = [mapped, ...own].includes("red") ? "red" : [mapped, ...own].includes("yellow") ? "yellow" : [mapped, ...own].includes("green") ? "green" : "unknown";
    sections.push({ title, path: stack.map((entry) => entry.title).join(" > "), number, level, rating: sectionRating, observations, recommendations, tables: results.map((item) => item!.table) });
  }
  const lines = textLines(body);
  return { lines, sections, tables: sections.flatMap((section) => section.tables), alerts: alertItems, decisive, summaryRating };
}
