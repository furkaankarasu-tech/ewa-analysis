export type LifecycleRecord = {
  area: string;
  name: string;
  installed: string;
  dateLabel: string;
  endDate: string;
  extendedEnd: string;
  status: string;
  rating: "red" | "yellow" | "green" | "unknown";
  source: string;
  note: string;
};

const WORDML = "http://schemas.microsoft.com/office/word/2003/wordml";
const DOCX = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const VML = "urn:schemas-microsoft-com:vml";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function parseLifecycle(document: Document | null, format: string, classify: (src: string) => LifecycleRecord["rating"]): LifecycleRecord[] {
  const ns = format === "Word XML (.doc)" ? WORDML : format === "DOCX" ? DOCX : "";
  if (!document || !ns) return [];
  const result: LifecycleRecord[] = [];
  const text = (cell: Element) => clean(Array.from(cell.getElementsByTagNameNS(ns, "t")).map((part) => part.textContent ?? "").join(""));
  for (const table of Array.from(document.getElementsByTagNameNS(ns, "tbl"))) {
    const rows = Array.from(table.getElementsByTagNameNS(ns, "tr")).map((row) =>
      (Array.from(row.childNodes).filter((child) => child.nodeType === 1) as Element[]).filter((cell) => cell.namespaceURI === ns && cell.localName === "tc"));
    if (rows.length < 2) continue;
    const header = rows[0].map(text);
    const mainCol = header.findIndex((cell) => /^End of (?:Mainstream )?Maintenance$/i.test(cell));
    const vendorCol = header.findIndex((cell) => /^End of Standard Vendor Support/i.test(cell));
    const dateCol = header.indexOf("End Date");
    const hanaCol = header.indexOf("In Maintenance ?");
    const assemblyCol = header.indexOf("Final assembly date");
    if (mainCol < 0 && vendorCol < 0 && dateCol < 0 && hanaCol < 0 && assemblyCol < 0) continue;
    for (const row of rows.slice(1)) {
      const cells = row.map(text);
      const ratingCell = row[header.findIndex((name) => /^(?:Status|Rating)$/i.test(name))];
      const icon = ratingCell?.getElementsByTagNameNS(VML, "imagedata")[0]?.getAttribute("src") ?? "";
      const rating = classify(icon);
      const value = (index: number) => index >= 0 ? cells[index] ?? "" : "";
      const rawName = value(0);
      if (!rawName || /^(?:Rating|Description|Database Start)$/i.test(rawName)) continue;
      let record: LifecycleRecord | null = null;
      if (mainCol >= 0) record = {
        area: header[0].startsWith("Installed Add-On") ? "Eklenti" : header[0] === "Software Product" ? "Fiori Front-End" : "SAP ürünü", name: rawName,
        installed: value(header.indexOf("SAP_UI Release")),
        dateLabel: "Ana bakım sonu", endDate: value(mainCol), extendedEnd: "", status: "", rating,
        source: header[0] === "Software Product" ? "Software Configuration > SAP Fiori Front-End Server Version" : "Software Configuration > SAP Application Release - Maintenance Phases", note: "",
      };
      else if (vendorCol >= 0) {
        const os = header.indexOf("Operating System");
        record = { area: os >= 0 ? "İşletim sistemi" : "Veritabanı", name: value(os) || rawName,
          installed: os >= 0 ? `Host: ${rawName}` : "", dateLabel: "Standart destek sonu", endDate: value(vendorCol),
          extendedEnd: value(header.findIndex((name) => /^End of Extended Vendor Support/i.test(name))),
          status: value(header.indexOf("Comment")), rating, source: `Software Configuration > ${os >= 0 ? "Operating System(s)" : "Database"} - Maintenance Phases`,
          note: value(header.indexOf("SAP Note")), };
      } else if (dateCol >= 0) record = {
        area: "SAPUI5", name: `SAPUI5 ${rawName}`, installed: value(header.indexOf("Installed")),
        dateLabel: value(dateCol).includes("EoCP") ? "Patch bakım sonu (EoCP)" : "Bakım sonu (EoM)",
        endDate: value(dateCol), extendedEnd: "", status: "", rating,
        source: "Software Configuration > SAPUI5 Version", note: "",
      };
      else if (hanaCol >= 0) {
        const revision = value(header.indexOf("SP Revision"));
        // The preceding column is often "Maintenance Revision". Its "no" value
        // does not say whether this HANA release is in maintenance.
        const maintenance = value(hanaCol);
        record = { area: "HANA revizyonu", name: `SAP HANA ${rawName}`, installed: revision,
          dateLabel: "", endDate: "", extendedEnd: "", status: maintenance ? `Bakımda: ${maintenance}` : "Bakım durumu tabloda doğrulanmalı",
          rating, source: "Software Configuration > HANA Database Version", note: value(header.indexOf("SPS Stack")), };
      } else if (assemblyCol >= 0) record = {
        area: "Support Package yaşı", name: rawName, installed: `${value(header.indexOf("Release"))} / SP ${value(header.indexOf("Support Package"))}`,
        dateLabel: "Son paket oluşturma tarihi", endDate: value(assemblyCol), extendedEnd: "",
        status: `${value(header.indexOf("Age of final assembly date in months"))} ay (rapor verisi)`, rating,
        source: "Security > Age of Support Packages", note: "Bu tarih ürünün bakım bitişi değildir.",
      };
      if (record && (record.endDate || record.status || record.installed && record.area !== "İşletim sistemi")) result.push(record);
    }
  }
  return result;
}

export function parseLifecycleTables(tables: { title: string; header: string[]; rows: string[][] }[]): LifecycleRecord[] {
  const records: LifecycleRecord[] = [];
  for (const table of tables) {
    const header = table.header.map(clean);
    const dateColumns = header.map((value, index) => /^(?:End of (?:Mainstream|Standard Vendor|Extended Vendor)|End Date)\b/i.test(value) ? index : -1).filter((index) => index >= 0);
    if (!dateColumns.length) continue;
    for (const row of table.rows) {
      const osCol = header.findIndex((value) => /^Operating System$/i.test(value));
      const name = clean(row[osCol >= 0 ? osCol : 0] ?? "");
      const primary = dateColumns.find((index) => /\b\d{2}\.\d{2}\.\d{4}\b/.test(row[index] ?? ""));
      if (!name || primary === undefined || /^Rating|^Description/i.test(name)) continue;
      const date = row[primary]?.match(/\b\d{2}\.\d{2}\.\d{4}\b/)?.[0] ?? "";
      const extended = dateColumns.filter((index) => index > primary).map((index) => row[index]?.match(/\b\d{2}\.\d{2}\.\d{4}\b/)?.[0]).find(Boolean) ?? "";
      const section = table.title;
      const database = /Database/i.test(header[0]) || /Database - Maintenance/i.test(section);
      const os = /Operating System/i.test(header.join(" ") + section);
      const fiori = /Fiori|SAP_UI/i.test(header.join(" ") + section);
      records.push({
        area: database ? "Veritabanı" : os ? "İşletim sistemi" : fiori ? "Fiori Front-End" : "SAP ürünü",
        name, installed: header.includes("SAP_UI Release") ? row[header.indexOf("SAP_UI Release")] ?? "" : osCol >= 0 ? `Host: ${row[0] ?? ""}` : "",
        dateLabel: /Standard Vendor/i.test(header[primary]) ? "Standart destek sonu" : /Mainstream/i.test(header[primary]) ? "Ana bakım sonu" : "Bakım sonu",
        endDate: date, extendedEnd: extended, status: "", rating: "unknown", source: section, note: "",
      });
    }
  }
  return records.filter((record, index, all) => all.findIndex((other) => other.name === record.name && other.endDate === record.endDate) === index);
}

// PDF text layers often interleave the cells of a multi-line maintenance table.
// Read a date pair only inside its named maintenance section, then use the
// surrounding row labels. This supplements the column parser; it never guesses
// a support date from a report-wide search.
export function parsePdfLifecycleSections(lines: string[]): LifecycleRecord[] {
  const records: LifecycleRecord[] = [];
  const heading = /^(\d+(?:\.\d+)+)\s+(.+)$/;
  const dates = /\b\d{2}\.\d{2}\.\d{4}\b/g;
  for (let start = 0; start < lines.length; start++) {
    const match = lines[start].match(heading);
    if (!match || !/^(?:Database|Operating System\(s\)) - Maintenance Phases$/i.test(match[2])) continue;
    const area = /^Database/i.test(match[2]) ? "Veritabanı" : "İşletim sistemi";
    const level = match[1].split(".").length;
    let end = start + 1;
    while (end < lines.length && end < start + 90) {
      const next = lines[end].match(heading);
      if (next && next[1].split(".").length <= level) break;
      if (/^\*\s*Maintenance phases\b|^Recommendation\s*:/i.test(lines[end])) break;
      end++;
    }
    for (let at = start + 1; at < end; at++) {
      const dateMatches = [...lines[at].matchAll(dates)];
      if (dateMatches.length < 2) continue;
      const first = dateMatches[0];
      const second = dateMatches[1];
      const before = clean(lines[at].slice(0, first.index));
      const after = clean(lines[at].slice(second.index! + second[0].length));
      const previous = lines.slice(Math.max(start + 1, at - 2), at).map(clean)
        .filter((line) => line && !/^(?:Host|System|Version|Status|Comment|Support\*|End of|Operating|Standard|Extended|Vendor|SAP)$/i.test(line));
      const following: string[] = [];
      for (let next = at + 1; next < Math.min(end, at + 4); next++) {
        const value = clean(lines[next]);
        if (!value || [...value.matchAll(dates)].length >= 2 || /^\*|^Recommendation\b|^\d+(?:\.\d+)+\s|^required additional|^the vendor or by/i.test(value)
          || /^[\w.-]+\s+(?:WINDOWS_|SUSE\b|Red Hat\b|Windows\b|Oracle Linux\b|Ubuntu\b|AIX\b)/i.test(value)) break;
        if (value.length < 65 && !/\b(?:support contracts|maintenance phases|vendor support)\b/i.test(value)) following.push(value);
      }
      let name = "";
      let installed = "";
      if (area === "Veritabanı") {
        const lead = /[A-Za-z]/.test(before) ? before : previous.at(-1) ?? "";
        const version = following.find((line) => /^(?:\d|Release\b|SP\b)/i.test(line)) ?? "";
        name = clean(`${lead} ${version}`);
      } else {
        const parts = before.match(/^([^\s]+)\s+(.+)$/);
        const isOsName = /^(?:SUSE|Red Hat|Windows|Linux|Ubuntu|Debian|Oracle Linux|IBM|AIX|Solaris|HP-UX)\b/i.test(before);
        const host = !isOsName && parts && /^[\w.-]+$/.test(parts[1]) ? parts[1]
          : !isOsName && /^[\w.-]+$/.test(before) && /[A-Za-z]/.test(before) ? before : "";
        installed = host ? `Host: ${host}` : "";
        const fragments = host && !parts ? lines.slice(Math.max(start + 1, at - 4), at).map(clean)
          .filter((line) => line && !/\b(?:Host|System|Vendor|Support|Comment|Status|Note|End of|Operating|Standard|Extended)\b/i.test(line)) : [];
        const os = host && parts ? parts[2] : host ? "" : before || previous.at(-1) || "";
        name = clean([...fragments, os, ...following].join(" ").replace(/\bLimited\b|\(ELS\)/gi, ""));
      }
      if (!name || /^\d+$/.test(name) || records.some((record) => record.area === area && record.endDate === first[0] && record.name === name)) continue;
      records.push({ area, name, installed, dateLabel: "Standart destek sonu", endDate: first[0], extendedEnd: second[0],
        status: "", rating: "unknown", source: `Software Configuration > ${match[2]}`, note: after.match(/\b\d{5,8}\b/)?.[0] ?? "" });
    }
  }
  return records;
}

export function dateDelta(raw: string, reference: string): number | null {
  const parse = (input: string) => {
    const match = input.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
    if (!match) return null;
    const value = Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    const valid = new Date(value);
    return valid.getUTCDate() === Number(match[1]) && valid.getUTCMonth() === Number(match[2]) - 1 ? value : null;
  };
  const end = parse(raw); const start = parse(reference);
  return end === null || start === null ? null : Math.round((end - start) / 86400000);
}
