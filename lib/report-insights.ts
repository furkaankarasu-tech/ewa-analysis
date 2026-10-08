import type { Finding, Priority } from "./ewa.ts";
import type { ReportSection, ReportTable } from "./report-structure.ts";

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
export type SapRecommendation = {
  source: string;
  text: string;
  rating: ReportSection["rating"];
  number?: string;
  page?: number;
  context?: ReportTable;
};

// A styled advisory paragraph can be a legend or explanatory note. Keep the
// actual Recommendation lines and independent instructions, without treating
// their mere presence as proof that the system has an error.
const actionStart = /^(?:For full SAP support, we recommend|As a general recommendation|We recommend|It is recommended|Please (?:check|review|update|implement|install|use|ensure|contact|schedule|plan|configure)|(?:Deactivate|Activate|Check|Review|Update|Implement|Install|Use|Ensure|Create|Plan|Configure|Apply|Investigate|Analyze|Analyse|Correct|Delete|Reorganize|Schedule|Set|Verify|Run|Perform|Avoid|Reduce|Increase|Maintain|Secure|Enable|Disable)\b)/i;
const advisoryOnly = /^(?:Please Note:|Note:|See also\b|For more information\b|For additional general information\b|Example:|This means\b|The following\b|The above table\b|S:|LTS:|V:|Rating Legend)/i;
const incompleteInstruction = /^(?:Depending on the (?:figure|value) in (?:the )?column (?:Remark|Remarks),? we recommend\s*:?)$/i;
const genericInitialSetting = /^We generally recommend setting the minimum value for initial setup\b/i;
const tableReference = /\b(?:in the (?:following )?table|column Remarks?)\b/i;

function relevantTable(section: ReportSection, sections: ReportSection[], text: string): ReportTable | undefined {
  // Word EWA reports sometimes put the explanatory paragraph in the parent
  // heading and the actual values in a direct subsection.
  const related = [section, ...sections.filter((child) => child.path.startsWith(`${section.path} > `))];
  const tables = related.flatMap((item) => item.tables).filter((table) => table.rows.some((row) => row.some((cell) => clean(cell))));
  const preferred = /\bHANA parameters?\b/i.test(text)
    ? tables.find((table) => table.header.some((cell) => /^Parameter$/i.test(clean(cell))) &&
        table.header.some((cell) => /Recommended Value/i.test(cell)))
    : /\bcolumn Remarks?\b/i.test(text)
      ? tables.find((table) => table.header.some((cell) => /^Remarks?$/i.test(clean(cell))))
      : undefined;
  const table = preferred ?? tables[0];
  return table && { ...table, rows: table.rows.slice(0, 5) };
}

export function collectSapRecommendations(sections: ReportSection[]): SapRecommendation[] {
  const found: SapRecommendation[] = [];
  for (const section of sections) {
    if (section.level < 2 || /^(?:Rating Legend|Check Overview|SAP HANA SQL Statements)/i.test(section.title)) continue;

    // EWA can store multiple recommendation paragraphs under the same section.
    // They belong to one recommendation card; rendering each paragraph as a
    // separate card makes the UI look duplicated and can separate context from
    // the actual action. Keep the original English paragraphs, but group them
    // by section and remove exact repeats.
    const sectionTexts: string[] = [];
    const seenText = new Set<string>();
    for (const raw of section.recommendations) {
      const value = clean(raw);
      const explicit = /^Recommendation\s*:/i.test(value);
      const text = clean(value.replace(/^Recommendation\s*:\s*/i, "")).replace(/([.!?])([A-Z])/g, "$1 $2");
      if (text.length < 20 || advisoryOnly.test(text) || incompleteInstruction.test(text) || genericInitialSetting.test(text) || !explicit && !actionStart.test(text)) continue;
      // "Set the parameters to the value in the table" is not an actionable
      // recommendation when the values could not be extracted.
      if (/^Set (?:the )?SAP HANA parameters? to the recommended value in the table\.?$/i.test(text) &&
          !relevantTable(section, sections, text)) continue;
      const key = text.toLocaleLowerCase("en-US").replace(/[.;:\s]+$/g, "").replace(/\s+/g, " ");
      if (seenText.has(key)) continue;
      seenText.add(key);
      sectionTexts.push(text);
    }

    if (!sectionTexts.length) continue;
    const text = sectionTexts.join("\n\n");
    found.push({
      source: `${section.path}${section.page ? ` · s. ${section.page}` : ""}`,
      text,
      rating: section.rating,
      number: section.number,
      page: section.page,
      context: tableReference.test(text) ? relevantTable(section, sections, text) : undefined,
    });
  }
  const order = { red: 0, yellow: 1, unknown: 2, green: 3 };
  return found.sort((a, b) => order[a.rating] - order[b.rating]);
}
const directIssue = /\b(?:could not be run|could not be found|could not be collected|has already expired|is about to expire|runs out of maintenance|has run out of security maintenance|not anymore in maintenance|not in maintenance|not set up|not scheduled|not implemented|not downloaded|is missing|are missing|were missing|data is missing|no performance data is returned|no archiving set up|has been disabled|is disabled|are disabled|is inactive|failed|unsuccessful|unprocessed|exceeds?\s+\d|bottleneck (?:has been found|was detected|was observed)|a memory bottleneck|critical conditions? (?:is|are) true|no longer protected|has reached|have reached|is near(?:ing)? the limit|was very close to its effective allocation limit|was critical|errors? have been recorded|dumps have been recorded|used 90% or more|recommended.*(?:missing|not set up)|does not follow the SAP backup recommendations|there was no successful backup|do not exist on the database|we found some problems that may impair|shows a critical trend|collection of DVM-relevant data has not been activated)\b/i;
const explicitTitle = /\b(?:missing|not set up|unsuccessful|failed|bottleneck|outdated|exhausted|critical number ranges|delta merge errors|error logs)\b/i;
const harmless = /\b(?:no (?:critical problems|memory bottlenecks|significant errors|failed backups|ABAP dumps)|not critical|not significantly high|is up to date|are up to date|in more than 6 months|no further action is required|no action required|only a small number of update errors should occur|the following|for example|for some use cases|this (?:section|table|chart|check)|SAP releases|a higher than usual|indicates if|recommended value|is caused by customer transactions)\b/i;
const genericStart = /^(?:For this service|For more information|The table|The following|We recommend|Please|Refer to|Recommendation:|Be aware|In this check|The chart|The data|This analysis|SAP provides|SAP HANA collects|MemoryIf|DATAWhen|If |In case )/i;

function issueLine(section: ReportSection) {
  return section.observations.map(clean).find((line) => {
    const observed = line.split(/\bIf (?:this|that|the|your|a|an)\b/i)[0];
    return directIssue.test(observed) && !harmless.test(line) && !genericStart.test(line)
      && !/^(?:Date\s+Weekday|Rating\s+|Successful\s+|Unsuccessful\s+)/i.test(line);
  }) ?? "";
}

function tableEvidence(section: ReportSection) {
  if (/Missing Indexes/i.test(section.title)) {
    const table = section.tables.find((item) => /Name of Missing Database Index/i.test(item.header[0] ?? ""));
    if (table) return table.rows.slice(0, 5).map((row) => row[0]).filter(Boolean).join(" · ");
  }
  if (/Message Server Access Control List/i.test(section.title)) {
    for (const table of section.tables) {
      const risk = table.rows.find((row) => row.some((cell) => /\bHOST\s*=\s*\*/i.test(cell)));
      if (risk) return formatRow(table, risk);
    }
  }
  for (const table of section.tables) {
    if (table.header.some((cell) => /^Check Performed$/i.test(cell))) continue;
    const rows = table.rows.filter((row) => row.some((cell) => clean(cell)));
    if (!rows.length) continue;
    if (/Critical Number Ranges/i.test(section.title)) {
      const used = table.header.findIndex((cell) => /^% Used$/i.test(clean(cell)));
      const critical = used >= 0 ? [...rows].sort((a, b) => Number((b[used] ?? "0").replace(",", ".")) - Number((a[used] ?? "0").replace(",", ".")))[0] : undefined;
      return critical && Number((critical[used] ?? "0").replace(",", ".")) >= 90 ? formatRow(table, critical) : "";
    }
    if (/(?:Log|Data) Backup/i.test(section.title)) {
      const failed = table.header.findIndex((cell) => /^Unsuccessful (?:Log|Data) Backups$/i.test(clean(cell)));
      const actual = failed >= 0 ? rows.find((row) => Number((row[failed] ?? "0").replace(",", ".")) > 0) : undefined;
      return actual ? formatRow(table, actual) : "";
    }
    const rated = rows.find((row) => row.some((cell) => directIssue.test(cell) && !harmless.test(cell)))
      ?? rows.find((row) => row.some((cell) => /^(?:--|missing|failed|error|not set up|no|red)$/i.test(clean(cell))))
      ?? (rows.length === 1 ? rows[0] : undefined);
    if (rated) return formatRow(table, rated);
  }
  return "";
}

function formatRow(table: ReportTable, row: string[]) {
  const parts = row.map((cell, index) => {
    const value = clean(cell);
    const label = clean(table.header[index] ?? "");
    return value ? label && label !== value && label.length < 55 ? `${label}: ${value}` : value : "";
  }).filter(Boolean);
  return parts.join(" · ").slice(0, 400);
}

function relevantRecommendation(section: ReportSection) {
  return section.recommendations.map((item) => clean(item.replace(/^Recommendation\s*:\s*/i, ""))).find(Boolean)?.slice(0, 600) ?? "";
}

function ownerFor(path: string) {
  if (/security|password|authorization|audit|gateway access/i.test(path)) return "Security + Basis";
  if (/database|HANA|Oracle|backup|SQL|table|index|memory/i.test(path)) return "DBA + Basis";
  if (/EWM|warehouse|business process|controlling|financial/i.test(path)) return "Uygulama + Basis";
  if (/transport|software change/i.test(path)) return "Basis + ALM";
  if (/ABAP|dump|program error|transaction/i.test(path)) return "ABAP + Basis";
  if (/hardware|capacity|CPU|paging/i.test(path)) return "Basis + altyapı";
  return "Basis";
}

function priorityFor(section: ReportSection, statement: string): Priority {
  if (section.rating === "red") return "kritik";
  if (section.rating === "yellow") return "yuksek";
  if (/failed (?:log|data) backup|already expired|not anymore in maintenance|technical limit|system is suspended/i.test(statement)) return "yuksek";
  if (/data (?:of high importance )?is missing|could not be run|could not be collected|no performance data is returned/i.test(statement)) return "orta";
  return "orta";
}

function coveredByExisting(section: ReportSection, findings: Finding[]) {
  return findings.some((finding) => {
    const leaf = finding.source.split(" > ").at(-1)?.toLowerCase() ?? "";
    return leaf.length >= 12 && (section.title.toLowerCase().includes(leaf) || leaf.includes(section.title.toLowerCase()));
  });
}

export function deriveSectionFindings(sections: ReportSection[], existing: Finding[], alerts: { title: string; severity: "red" | "yellow" | "unknown" }[] = []): Finding[] {
  const candidates: { section: ReportSection; finding: Finding; score: number }[] = [];
  for (const section of sections) {
    if (section.level < 2 && !/^(?:Trend Analysis for |Data Volume Management \(DVM\))/i.test(section.title) || section.rating === "green" || /^(?:SAP HANA SQL Statements|Check Overview|Rating Legend)/i.test(section.title)) continue;
    if (coveredByExisting(section, existing)) continue;
    const statement = issueLine(section);
    const table = tableEvidence(section);
    const isRated = section.rating === "red" || section.rating === "yellow";
    const titleSignalsIssue = explicitTitle.test(section.title);
    const linkedAlert = alerts.find((alert) => section.title.length > 14 && alert.title.toLowerCase().includes(section.title.toLowerCase()));
    const measuredRated = isRated && /authorized|number ranges|password|backup|security/i.test(section.title) && /\d/.test(table);
    // An unknown PDF icon, a date, or a generic advisory is not evidence of an alarm.
    if (!statement && !(titleSignalsIssue && table) && !measuredRated && !(linkedAlert && table)) continue;
    if (!statement && !table) continue;
    const evidence = [statement || linkedAlert?.title || "", table && table !== statement ? table : ""].filter(Boolean).join(" · ").slice(0, 720);
    const recommendation = relevantRecommendation(section);
    const extrapolatedDvm = /jobs creating ST14 datasets is not set up.*extrapolation/i.test(statement);
    const impact = section.observations.map(clean).find((line) => line !== statement && /\b(?:may result in|may affect|can lead to|risk of|no longer ensured|performance problems|system is suspended)\b/i.test(line) && !/^If /i.test(line)) ?? "";
    const cause = section.observations.map(clean).find((line) => line !== statement && /\b(?:due to|because|caused by|root cause)\b/i.test(line) && !/\b(?:may|might|could)\b/i.test(line)) ?? "";
    const priority = linkedAlert?.severity === "red" ? "kritik" : linkedAlert?.severity === "yellow" ? "yuksek" : priorityFor(section, statement);
    const finding: Finding = {
      id: `section-${section.path.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(-100)}`,
      priority,
      title: extrapolatedDvm ? "DVM ölçümünde ekstrapolasyon" : section.title,
      evidence,
      impact: impact.slice(0, 420),
      cause: cause.slice(0, 420),
      action: extrapolatedDvm ? "ST14 veri kümesini oluşturan işin aylık çalışmasını ve verinin kapsamını doğrula; DVM büyüme tahminini gerçek veriyle yeniden değerlendir." : recommendation || "Bu bulgunun kapsamını ilgili sistemde doğrula; raporda uygulanabilir bir işlem önerisi çıkarılamadı.",
      owner: extrapolatedDvm ? "Basis + DBA" : ownerFor(section.path),
      source: `${linkedAlert ? "Alert Overview · " : ""}${section.path}${section.page ? ` · s. ${section.page}` : ""}`,
      confidence: statement || linkedAlert ? "Rapor bulgusu" : "Kontrol gerekli",
      recommendation: Boolean(recommendation) && !extrapolatedDvm,
    };
    const score = (isRated ? section.rating === "red" ? 8 : 5 : 0) + (statement ? 4 : 0) + (linkedAlert ? 3 : 0) + (recommendation ? 2 : 0) + (table ? 1 : 0);
    candidates.push({ section, finding, score });
  }
  // The same measurement can appear in a summary and a detailed subsection.
  const seen = new Set<string>();
  return candidates.sort((a, b) => b.score - a.score || b.section.level - a.section.level || a.section.path.localeCompare(b.section.path))
    .filter(({ finding }) => {
      const key = clean(finding.evidence.split(" · ")[0]).toLowerCase().slice(0, 130);
      if (key.length < 35 || !seen.has(key)) { if (key.length >= 35) seen.add(key); return true; }
      return false;
    }).map(({ finding }) => finding);
}

/** Only verified Alert Overview colors determine the priority here. The two
 * client scopes are independent alerts, even when their wording is similar. */
export function authorizationAlertFindings(
  alerts: { title: string; severity: "red" | "yellow" | "unknown" }[],
  existing: Finding[],
): Finding[] {
  const found: Finding[] = [];
  for (const alert of alerts) {
    if (alert.severity === "unknown") continue;
    const scope = /^Users with critical authorizations, which allow to do anything in (client 000|other client\(s\) than 000)\.?$/i.exec(clean(alert.title))?.[1];
    if (!scope) continue;
    const otherClients = /other/i.test(scope);
    const id = otherClients ? "authorization-other-clients" : "authorization-client-000";
    if ([...existing, ...found].some((item) => item.id === id || clean(item.evidence).toLowerCase() === clean(alert.title).toLowerCase())) continue;
    found.push({
      id,
      priority: alert.severity === "red" ? "kritik" : "yuksek",
      title: otherClients ? "000 dışındaki istemcilerde kritik yetkiler" : "000 istemcisinde kritik yetkiler",
      evidence: alert.title,
      action: "Raporun işaretlediği istemcilerde bu yetkilere sahip kullanıcı ve rolleri SUIM/PFCG üzerinden doğrulayın; gerekli erişimi iş birimiyle değerlendirin.",
      owner: "Security + Basis", source: "Alert Overview", confidence: "Rapor bulgusu",
    });
  }
  return found;
}
