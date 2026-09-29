export type ComponentUpdate = {
  component: string;
  version: string;
  installedPatch: number;
  latestPatch: number;
  packageName: string;
  description: string;
  metric: "Patch" | "SP";
};

export type SqlHotspot = {
  hash: string;
  elapsedSeconds?: number;
  executions?: number;
  averageMs?: number;
  memoryPerExecutionMb?: number;
  maximumMemoryMb?: number;
  cpuPeakSamples?: number;
  threadSamples?: number;
  source?: string;
  origin?: string;
  reportSource?: string;
};

export type HanaParameter = { location: string; parameter: string; current: string; recommended: string; note: string };

export type EwaDetails = {
  componentUpdates: ComponentUpdate[];
  componentCount: number | null;
  serviceNotes: { note: string; topic: string }[];
  sqlHotspots: SqlHotspot[];
  sqlWindow: string | null;
  hanaParameters: HanaParameter[];
};

const WORDML = "http://schemas.microsoft.com/office/word/2003/wordml";
const DOCX = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const hashPattern = /^[a-f0-9]{32}$/i;

function clean(value: string) { return value.replace(/\s+/g, " ").trim(); }
function number(value: string) {
  const text = value.replace(/[^\d.,-]/g, "");
  if (!text) return NaN;
  if (text.includes(",")) return Number(text.replace(/\./g, "").replace(",", "."));
  if ((text.match(/\./g) ?? []).length === 1 && text.split(".")[1].length !== 3) return Number(text);
  return Number(text.replace(/\./g, ""));
}

function tableRows(table: Element, namespace: string) {
  return Array.from(table.getElementsByTagNameNS(namespace, "tr")).map((row) =>
      (Array.from(row.childNodes).filter((node) => node.nodeType === 1) as Element[]).filter((node) => node.namespaceURI === namespace && node.localName === "tc")
        .map((cell) => clean(Array.from((cell as Element).getElementsByTagNameNS(namespace, "t")).map((text) => text.textContent ?? "").join("")))
    );
}

function allTables(document: Document | null, namespace: string | null) {
  if (!document || !namespace) return [] as string[][][];
  return Array.from(document.getElementsByTagNameNS(namespace, "tbl")).map((table) => tableRows(table, namespace));
}

function detailsForHash(lines: string[], hash: string) {
  const at = lines.findIndex((line) => line === `SQL Statement ${hash}`);
  if (at < 0) return {} as Pick<SqlHotspot, "source" | "origin">;
  let end = lines.findIndex((line, index) => index > at && /^SQL Statement [a-f0-9]{32}$/i.test(line));
  if (end < 0 || end > at + 230) end = Math.min(lines.length, at + 230);
  const section = lines.slice(at + 1, end);
  const from = section.findIndex((line) => /(?:^|\n)\s*from\b/i.test(line));
  const tableLine = from >= 0 ? section[from].replace(/^[\s\S]*?\bfrom\b/i, "").trim() || section[from + 1] : "";
  const source = clean(tableLine ?? "").slice(0, 150) || undefined;
  return { source };
}

export function parseEwaDetails(document: Document | null, lines: string[], format: string, extractedTables: string[][][] = []): EwaDetails {
  const namespace = format === "Word XML (.doc)" ? WORDML : format === "DOCX" ? DOCX : null;
  const tables = [...allTables(document, namespace), ...extractedTables];
  const updates: ComponentUpdate[] = [];
  const hanaParameters: HanaParameter[] = [];
  const serviceNotes: EwaDetails["serviceNotes"] = [];
  let componentCount: number | null = null;
  const hotspots = new Map<string, SqlHotspot>();
  const getHotspot = (hash: string) => {
    let item = hotspots.get(hash);
    if (!item) { item = { hash }; hotspots.set(hash, item); }
    return item;
  };

  for (const rows of tables) {
    if (!rows.length) continue;
    const header = rows[0];
    if (/^Software Component$/i.test(header[0]) && header.some((value) => /Latest Avail\. Patch Level/i.test(value))) {
      componentCount = (componentCount ?? 0) + rows.length - 1;
      for (const cells of rows.slice(1)) {
        if (cells.length < 4) continue;
        const installedPatch = Number(cells[2]);
        const latestPatch = Number(cells[3]?.match(/^\d+/)?.[0]);
        if (!Number.isInteger(installedPatch) || !Number.isInteger(latestPatch) || latestPatch <= installedPatch) continue;
        updates.push({ component: cells[0], version: cells[1], installedPatch, latestPatch, packageName: cells[4] ?? "", description: cells[5] ?? "", metric: "Patch" });
      }
    }
    if (/^Component$/i.test(header[0]) && header.some((value) => /^Latest Available SP$/i.test(value))) {
      componentCount = (componentCount ?? 0) + rows.length - 1;
      for (const cells of rows.slice(1)) {
        const installedPatch = Number(cells[2]);
        const latestPatch = Number(cells[3]);
        if (!cells[0] || !Number.isInteger(installedPatch) || !Number.isInteger(latestPatch) || latestPatch <= installedPatch) continue;
        updates.push({ component: cells[0], version: cells[1] ?? "", installedPatch, latestPatch, packageName: "", description: "Java Support Package", metric: "SP" });
      }
    }
    if (header.includes("Topic") && header.includes("SAP Note") && header.includes("Tool Status")) {
      const noteCol = header.indexOf("SAP Note");
      const topicCol = header.indexOf("Topic");
      for (const cells of rows.slice(1)) {
        const note = cells[noteCol]; const topic = cells[topicCol];
        if (note && topic && /^\d{4,}$/.test(note) && !serviceNotes.some((item) => item.topic === topic)) serviceNotes.push({ note, topic });
      }
    }
    if (header[0] === "Location" && header.includes("Parameter") && header.includes("Recommended Value")) {
      const recommendedAt = header.indexOf("Recommended Value");
      const currentAt = header.indexOf("Current Value");
      const combinedAt = header.findIndex((cell) => /Layername.*Current Value/i.test(cell));
      const noteAt = header.findIndex((cell) => /SAP Note/i.test(cell));
      for (let index = 1; index < rows.length; index++) {
        const cells = rows[index];
        if (!cells[1] || !cells[recommendedAt]) continue;
        let parameter = cells[1];
        let location = cells[0];
        for (let next = index + 1; next < Math.min(rows.length, index + 4); next++) {
          const continuation = rows[next];
          if (continuation[recommendedAt] || !continuation[1] || continuation[0] && !/^\[|^er\]/i.test(continuation[0])) break;
          parameter += continuation[1];
          location += continuation[0] ? ` ${continuation[0]}` : "";
        }
        const current = currentAt >= 0 ? cells[currentAt] : combinedAt >= 0
          ? cells[combinedAt]?.match(/(?:^|\s)(-?\d+(?:\.\d+)?|true|false|-)\s*$/i)?.[1] : "";
        hanaParameters.push({ location, parameter, current: current || "—", recommended: cells[recommendedAt],
          note: noteAt >= 0 ? cells[noteAt] || "" : "" });
      }
    }
    if (!/^Statement Hash$/i.test(header[0])) continue;
    const elapsedCol = header.findIndex((name) => name.startsWith("Total Elapsed Time"));
    const executionsCol = header.indexOf("Number of Executions");
    const averageCol = header.indexOf("Time / Execution [us]");
    const memoryCol = header.indexOf("Memory / Execution [MB]");
    const maximumCol = header.indexOf("Maximum Memory [MB]");
    const peakCol = header.findIndex((name) => /Samples in CPU Peak Hour/i.test(name));
    const sampleCol = header.indexOf("Number of Samples");
    for (const cells of rows.slice(1)) {
      const hash = cells[0];
      if (!hashPattern.test(hash ?? "")) continue;
      const item = getHotspot(hash);
      const setMax = (key: "elapsedSeconds" | "executions" | "averageMs" | "memoryPerExecutionMb" | "maximumMemoryMb" | "cpuPeakSamples" | "threadSamples", raw: string | undefined, divisor = 1) => {
        const value = number(raw ?? "") / divisor;
        if (Number.isFinite(value) && (item[key] === undefined || value > item[key]!)) item[key] = value;
      };
      if (elapsedCol >= 0) setMax("elapsedSeconds", cells[elapsedCol]);
      if (executionsCol >= 0) setMax("executions", cells[executionsCol]);
      if (averageCol >= 0) setMax("averageMs", cells[averageCol], 1000);
      if (memoryCol >= 0) setMax("memoryPerExecutionMb", cells[memoryCol]);
      if (maximumCol >= 0) setMax("maximumMemoryMb", cells[maximumCol]);
      if (peakCol >= 0) setMax("cpuPeakSamples", cells[peakCol]);
      if (sampleCol >= 0) setMax("threadSamples", cells[sampleCol]);
    }
  }

  // PDF table text sometimes merges patch number and package name into one cell.
  if (format === "PDF") {
    const start = lines.findIndex((line) => /^(?:\d+(?:\.\d+)*\s+)?Support Package Maintenance - ABAP$/.test(line));
    const end = lines.findIndex((line, index) => index > start && /^(?:\d+(?:\.\d+)*\s+)?Database - Maintenance Phases$/.test(line));
    if (start >= 0 && end > start) {
      const pdfRows = new Map<string, ComponentUpdate>();
      for (const line of lines.slice(start, end)) {
        const match = line.match(/^([A-Z][A-Z0-9_/-]{2,20})\s+([A-Z0-9_]{2,12})\s+(\d+)\s+(\d+)\s+([A-Z0-9-]{5,})\b/);
        if (!match || pdfRows.has(match[1])) continue;
        pdfRows.set(match[1], { component: match[1], version: match[2], installedPatch: Number(match[3]), latestPatch: Number(match[4]), packageName: match[5], description: line.slice(match[0].length).trim(), metric: "Patch" });
      }
      if (pdfRows.size) {
        componentCount = pdfRows.size;
        updates.length = 0;
        updates.push(...[...pdfRows.values()].filter((item) => item.latestPatch > item.installedPatch));
      }
    }
  }
  if (!hotspots.size) {
    for (let i = 0; i < lines.length - 5; i++) {
      if (lines[i] !== "Statement Hash") continue;
      const firstHash = lines.findIndex((line, index) => index > i && index <= i + 10 && hashPattern.test(line));
      if (firstHash < 0) continue;
      const header = lines.slice(i, firstHash);
      const width = header.length;
      if (width < 3 || width > 9) continue;
      for (let at = firstHash; at + width <= lines.length && hashPattern.test(lines[at]); at += width) {
        const cells = lines.slice(at, at + width);
        const item = getHotspot(cells[0]);
        const elapsed = header.findIndex((name) => name.startsWith("Total Elapsed Time"));
        const memory = header.findIndex((name) => name === "Memory / Execution [MB]");
        const executions = header.indexOf("Number of Executions");
        const average = header.indexOf("Time / Execution [us]");
        if (elapsed >= 0) item.elapsedSeconds = number(cells[elapsed]);
        if (memory >= 0) item.memoryPerExecutionMb = number(cells[memory]);
        if (executions >= 0) item.executions = number(cells[executions]);
        if (average >= 0) item.averageMs = number(cells[average]) / 1000;
      }
    }
  }

  for (const item of hotspots.values()) Object.assign(item, detailsForHash(lines, item.hash));
  if (document && namespace) {
    let currentHash = "";
    const visit = (node: Element) => {
      if (node.namespaceURI === namespace && node.localName === "p") {
        const paragraph = clean(Array.from(node.getElementsByTagNameNS(namespace, "t")).map((part) => part.textContent ?? "").join(""));
        const match = paragraph.match(/^SQL Statement ([a-f0-9]{32})$/i);
        if (match) currentHash = match[1];
        return;
      }
      if (node.namespaceURI === namespace && node.localName === "tbl") {
        if (currentHash && hotspots.has(currentHash)) {
          const rows = tableRows(node, namespace);
          const header = rows[0] ?? [];
          const item = hotspots.get(currentHash)!;
          if (header[0] === "SID" && header.includes("Transaction / Jobaname") && header.includes("Report") && rows[1]) {
            const transaction = rows[1][header.indexOf("Transaction / Jobaname")];
            const report = rows[1][header.indexOf("Report")];
            if (report && transaction && !item.origin) item.origin = `${report} · ${transaction}`;
          }
          if (header[0] === "Table Name" && rows[1]?.[0] && !item.source) item.source = rows[1][0];
        }
        return;
      }
      for (const child of Array.from(node.childNodes).filter((child) => child.nodeType === 1) as Element[]) visit(child);
    };
    visit(document.documentElement);
  }
  const start = lines.findIndex((line) => line === "Top Statements (Elapsed Time)");
  const windowArea = start >= 0 ? lines.slice(start, start + 35) : [];
  const beginAt = windowArea.indexOf("Begin of Time Interval");
  const endAt = windowArea.indexOf("End of Time Interval");
  const sqlWindow = beginAt >= 0 && endAt >= 0 ? `${windowArea[beginAt + 1]} – ${windowArea[endAt + 1]}` : null;
  return { componentUpdates: updates, componentCount, serviceNotes, sqlHotspots: [...hotspots.values()], sqlWindow, hanaParameters };
}
