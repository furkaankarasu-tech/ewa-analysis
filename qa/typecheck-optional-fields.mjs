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
import { createRequire } from "node:module";
const ts = createRequire(import.meta.url)("typescript");

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
  const diagnostics = file => ts.getPreEmitDiagnostics(ts.createProgram([file], {
    noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2020,
  }));
  const valid = diagnostics(good);
  assert.equal(valid.length, 0, `Optional Finding fields must compile: ${valid.map((item) => item.messageText).join("; ")}`);
  const broken = join(dir, "card-broken.ts");
  await writeFile(broken, fixture(realHelper.replace(/original: string \| undefined/, "original: string")));
  const invalid = diagnostics(broken);
  assert.ok(invalid.length > 0, "Regression test must detect the original wrong type");
  assert.ok(invalid.some((item) => item.code === 2345), "Regression test must recreate TS2345");
  console.log("PASS: actual FindingCard helper compiles with optional impact/cause.");
  console.log("PASS: removing the optional-field fix reproduces TS2345 (negative control).");
} finally {
  await rm(dir, { recursive: true, force: true });
}
