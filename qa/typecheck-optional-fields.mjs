/**
 * Regression test for optional Finding.impact/Finding.cause in FindingCard.
 * Extracts the actual card helper from app/page.tsx, rather than a copy, so
 * a future edit cannot silently re-introduce TS2345 at the call site.
 * Requires the project's TypeScript compiler (tsc on PATH).
 */
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const start = page.indexOf("  const pair = ");
const end = page.indexOf("  const title = pair(", start);
assert.ok(start > 0 && end > start, "FindingCard pair helper not found");
const realHelper = page.slice(start, end);

function fixture(helper) {
  return `
  type TranslatedFinding = Partial<Record<"title" | "evidence" | "impact" | "cause" | "action", string>>;
  type BilingualCopy = { primary: string; english?: string; englishLabel?: string; missingTurkish?: boolean };
  type Finding = { id: string; title: string; evidence: string; action: string; impact?: string; cause?: string };
  declare const finding: Finding;
  declare const translation: TranslatedFinding | undefined;
  declare const bilingual: boolean;
  declare function findingCopy(text: string, translated: string | undefined, id: string, field: keyof TranslatedFinding): BilingualCopy;
  ${helper}
  const title: BilingualCopy = pair(finding.title, "title");
  const evidence: BilingualCopy = pair(finding.evidence, "evidence");
  const impact: BilingualCopy = pair(finding.impact, "impact");
  const cause: BilingualCopy = pair(finding.cause, "cause");
  const action: BilingualCopy = pair(finding.action, "action");
  void [title, evidence, impact, cause, action];
`;
}

const dir = await mkdtemp(join(tmpdir(), "ewa-optional-fields-"));
try {
  const good = join(dir, "card-ok.ts");
  await writeFile(good, fixture(realHelper));
  const args = ["--noEmit", "--strict", "--skipLibCheck", "--target", "ES2020"];
  const valid = spawnSync("tsc", [...args, good], { encoding: "utf8" });
  assert.equal(valid.status, 0, `Optional Finding fields must compile:\n${valid.stdout}\n${valid.stderr}`);
  const broken = join(dir, "card-broken.ts");
  await writeFile(broken, fixture(realHelper.replace(/original: string \| undefined/, "original: string")));
  const invalid = spawnSync("tsc", [...args, broken], { encoding: "utf8" });
  assert.notEqual(invalid.status, 0, "Regression test must detect the original wrong type");
  assert.match(invalid.stdout + invalid.stderr, /TS2345/, "Regression test must recreate the old type error");
  console.log("PASS: actual FindingCard helper compiles with optional impact/cause.");
  console.log("PASS: removing the optional-field fix reproduces TS2345 (negative control).");
} finally {
  await rm(dir, { recursive: true, force: true });
}
