import { knownSapTranslation, looksEnglish, type TranslatedFinding } from "./local-translation.ts";

export type CopyField = keyof TranslatedFinding;
export type BilingualCopy = { primary: string; english?: string; missingTurkish?: boolean };

// Generated Radar analyses are not SAP quotations. Show their English versions
// only in the optional English summary, never beside every Turkish measurement.
const generatedEnglish: Record<string, { title?: string; action?: string }> = {
  "security-support-packages": { title: "Support Package security maintenance has ended", action: "Verify the affected Support Package levels. Prepare a tested upgrade plan for a compatible current SP Stack and security patches." },
  "db-sql-load": { title: "Database SQL workload", action: "Check the SQL execution plans, execution frequency and originating applications. Do not add percentages obtained from different measurement periods." },
  "component-patches": { title: "Components with outstanding updates", action: "Verify patch differences against Maintenance Planner and relevant SAP Notes for the report date. Plan updates with compatibility testing." },
  "bw-requests": { title: "Accumulated BW InfoProvider requests", action: "Examine BW request management and data loading per InfoProvider. Plan deletion and housekeeping together with the BW team." },
  "java-gc": { title: "Java garbage collection time" },
  "service-preparation": { title: "RTCCTOOL service preparation is red", action: "Validate ST-PI, ST-A/PI and related SAP Note recommendations in RTCCTOOL against the system release. Schedule SAINT/SPAM/SNOTE work with testing." },
  "sql-elapsed": { title: "SQL statements with high total elapsed time", action: "For each SQL hash, inspect the calling ABAP process and execution plan. Distinguish frequently executed SQL from SQL that is slow per execution." },
  "sql-memory": { title: "SQL statements with high memory consumption", action: "Inspect statement hash, source tables/views and execution plans. Confirm result-set and concurrent memory pressure before changing parameters." },
  "sql-cpu-peak": { title: "SQL during peak CPU usage", action: "Compare thread samples at the CPU peak with the application workload and SQL execution plans." },
  "hana-parameters": { title: "SAP HANA parameter recommendations", action: "Check current and recommended values against the SAP Note and parameter layer. Test changes before scheduling deployment." },
  "hana-memory": { title: "SAP HANA memory pressure", action: "Use SAP HANA Cockpit to inspect loaded tables, heap usage and peak memory consumption. Review capacity sizing together with DVM findings." },
  "large-tables": { title: "Large non-partitioned tables", action: "For tables approaching the record-count limit, assess application-compatible table partitioning or archiving with SAP Data Volume Management (DVM). Measure their growth rates separately." },
  "disk": { title: "DATA disk capacity", action: "Confirm current capacity and growth trends. Plan extra capacity or a safe cleanup." },
  "dialog": { title: "Dialog response time", action: "Measure total workload in ST03N/STAD and network delays in ST06. Identify the most impactful transactions and SQL statements." },
  "slow-transaction": { title: "Slow transactions and cumulative workload", action: "Separate transactions with high average response time from those with high cumulative workload in ST03N/STAD. Review ST12/SQL traces with the ABAP team." },
  "dumps": { title: "ABAP dump frequency", action: "Group recurring dumps by program, user and time in ST22, then work with the ABAP team to investigate the root cause." },
  "log-backup": { title: "Failed log backups", action: "Check the backup catalog and error logs to confirm recovery-chain integrity and any subsequent successful backups." },
  "transport": { title: "Transport import sequence issue", action: "Verify affected object versions in production. Transport the intended version from development and correct the import sequence." },
  "security": { title: "SAP HANA security configuration", action: "Verify alternative administrator access; schedule SR TLS and SYSTEM user changes in a maintenance window and review roles with PFCG/SUIM." },
  "hana-consistency": { title: "Missing SAP HANA global consistency check", action: "Verify the global consistency check scope and latest runs. Schedule it during a low-load period in line with SAP Note 2116157." },
  "rfc-trend": { title: "RFC response time trend", action: "Recheck the current week's trend with ST03N/STAD and distinguish the calling RFC from the application workload." },
};

export function generatedAnalysisEnglish(findingId: string): { title?: string; action?: string } | undefined {
  return generatedEnglish[findingId];
}

/** Never invent an English 'SAP original' for Turkish text produced by Radar. */
export function findingCopy(original: string, translated: string | undefined, _findingId: string, _field: CopyField): BilingualCopy {
  const value = original.trim();
  const verified = translated?.trim() || knownSapTranslation(value);
  if (looksEnglish(value)) {
    if (verified && verified !== value) return { primary: verified, english: value };
    return { primary: value, missingTurkish: true };
  }
  return { primary: value };
}

export function recommendationCopy(original: string, translated?: string): BilingualCopy {
  const value = original.trim();
  const verified = translated?.trim() || knownSapTranslation(value);
  return verified && verified !== value
    ? { primary: verified, english: value }
    : { primary: value, missingTurkish: looksEnglish(value) };
}
