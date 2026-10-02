import type { ReportSection } from "./report-structure.ts";

export type SqlLoad = {
  object: string;
  cpuPercent: number;
  ioPercent: number;
  elapsedPercent: number;
  executions: string;
  records: string;
  source: string;
};

export type SqlServerStatement = {
  object: string;
  elapsedPercent: number;
  callsPercent: number;
  calls: number;
  totalRows: number;
  logicalReadsPercent: number;
  physicalReadsPercent: number;
  cpuPercent: number;
  source: string;
};

const number = (raw: string) => Number(raw.replace(/\./g, "").replace(",", "."));

export function parseSqlLoad(sections: ReportSection[]) {
  const rows: SqlLoad[] = [];
  let aggregate: { impact: string; cpu: string; io: string; elapsed: string; source: string } | null = null;
  for (const section of sections) {
    for (const table of section.tables) {
      const h = table.header.map((value) => value.toLowerCase());
      const col = (pattern: RegExp) => h.findIndex((value) => pattern.test(value));
      const object = col(/^object name$/);
      const cpu = col(/^cpu load/); const io = col(/^i\/o load/); const elapsed = col(/^elapsed time/);
      if (object >= 0 && cpu >= 0 && io >= 0 && elapsed >= 0) {
        for (const row of table.rows) {
          if (!row[object] || !row[elapsed] || !Number.isFinite(number(row[elapsed]))) continue;
          rows.push({ object: row[object], cpuPercent: number(row[cpu]), ioPercent: number(row[io]), elapsedPercent: number(row[elapsed]), executions: row[col(/^total executions/)] ?? "", records: row[col(/^records processed/)] ?? "", source: `${section.path}${section.page ? ` · s. ${section.page}` : ""}` });
        }
      } else if (col(/^impact$/) >= 0 && cpu >= 0 && io >= 0 && elapsed >= 0) {
        const first = table.rows.find((row) => /^(?:HIGH|MEDIUM|LOW|N\/A)$/i.test(row[col(/^impact$/)] ?? ""));
        if (first) aggregate = { impact: first[col(/^impact$/)], cpu: first[cpu], io: first[io], elapsed: first[elapsed], source: `${section.path}${section.page ? ` · s. ${section.page}` : ""}` };
      }
    }
  }
  return { rows, aggregate };
}
