/** Small, deterministic dashboard helpers. Nothing is inferred beyond the actual findings. */
import type { Finding } from "./ewa.ts";

export type FindingFilter = "all" | "kritik" | "yuksek" | "other" | "green" | "unknown";
export type FindingGroup = { label: string; critical: number; high: number; other: number; total: number };

export function filterFindings(
  findings: Finding[],
  filter: FindingFilter,
  query: string,
  translations: Record<number, { title?: string; evidence?: string }> = {},
) {
  const q = query.trim().toLocaleLowerCase("tr-TR");
  return findings.map((finding, index) => ({ finding, index })).filter(({ finding, index }) => {
    if (filter === "kritik" && finding.priority !== "kritik") return false;
    if (filter === "yuksek" && finding.priority !== "yuksek") return false;
    if (filter === "other" && (finding.priority === "kritik" || finding.priority === "yuksek")) return false;
    if (filter === "green" && finding.sourceRating !== "green") return false;
    if (filter === "unknown" && finding.sourceRating !== "unknown") return false;
    if (!q) return true;
    return [finding.title, finding.evidence, finding.owner, finding.source, finding.action,
      translations[index]?.title, translations[index]?.evidence]
      .some((value) => value?.toLocaleLowerCase("tr-TR").includes(q));
  });
}

export function groupFindingsByOwner(findings: Finding[], limit = 8): FindingGroup[] {
  const groups = new Map<string, FindingGroup>();
  for (const finding of findings) {
    const label = finding.owner?.trim() || "Sorumlu alan belirtilmemiş";
    const group = groups.get(label) ?? { label, critical: 0, high: 0, other: 0, total: 0 };
    group.total++;
    if (finding.priority === "kritik") group.critical++;
    else if (finding.priority === "yuksek") group.high++;
    else group.other++;
    groups.set(label, group);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "tr-TR")).slice(0, limit);
}
