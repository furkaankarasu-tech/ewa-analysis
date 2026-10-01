import type { ReportSection } from "./report-structure.ts";

export type TopSqlStatement = {
  rank: number;
  statement: string;
  accumulatedSeconds: number;
  executions: number;
  averageMs: number;
  source: string;
  truncated: boolean;
};

// Word and HTML reports usually retain the SQL table as real cells. Read only
// columns whose meaning can be established from the report's own header.
export function parseTopSqlTables(sections: ReportSection[]): TopSqlStatement[] {
  const statements: TopSqlStatement[] = [];
  for (const section of sections.filter((item) => /\bTop SQL Statements\b/i.test(item.title))) {
    for (const table of section.tables) {
      const header = table.header.map((value) => value.replace(/\s+/g, " ").trim().toLowerCase());
      const col = (pattern: RegExp) => header.findIndex((value) => pattern.test(value));
      const rank = col(/^rank$/), name = col(/^name$|^sql (?:statement|text)$/),
        accumulated = col(/acc\.?\s*(?:resp\.?\s*)?time|accumulated.*time/),
        executions = col(/^execs?\.?$|^executions$/), average = col(/ave\.?\s*(?:resp\.?\s*)?time|average.*time/);
      if ([rank, name, accumulated, executions, average].some((index) => index < 0)) continue;
      for (const row of table.rows) {
        const numeric = (index: number) => Number((row[index] ?? "").replace(/,/g, "").trim());
        const position = numeric(rank), seconds = numeric(accumulated), count = numeric(executions), ms = numeric(average);
        const statement = (row[name] ?? "").replace(/\s+/g, " ").trim();
        if (!Number.isInteger(position) || position < 1 || position > 100 || !statement ||
          ![seconds, count, ms].every((value) => Number.isFinite(value) && value >= 0) || !Number.isInteger(count)) continue;
        statements.push({ rank: position, statement, accumulatedSeconds: seconds, executions: count,
          averageMs: ms, source: `${section.path}${section.page ? ` · s. ${section.page}` : ""}`, truncated: /\.{3}|…/.test(statement) });
      }
    }
  }
  return statements;
}
