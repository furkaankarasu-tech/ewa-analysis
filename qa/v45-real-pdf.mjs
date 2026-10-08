// Run against the independently inspected Oracle/Java PP7 report; fixture is not redistributed.
// node --experimental-strip-types qa/v45-real-pdf.mjs /path/to/ewa-portal_production.pdf
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { analyzeEwa } from '../lib/ewa.ts';
import { knownSapTranslation, emptyTranslations } from '../lib/local-translation.ts';
import { createActionWorkbook } from '../lib/excel-export.ts';
const path=process.argv[2];
if(!path) throw new Error('Provide the PP7 source PDF path.');
const report=await analyzeEwa(new File([readFileSync(path)],'portal.pdf'));
assert.equal(report.sid,'PP7');
assert.equal(report.period,'30.12.2019 – 05.01.2020');
assert.equal(report.topSqlStatements.length,10);
assert.equal(report.topSqlStatements[0].executions,1678);
assert.equal(report.findings.length,4);
const kernel=report.findings.find(x=>x.id==='kernel-recommendation');
assert.match(kernel.evidence,/749 or 753/);
assert.ok(kernel.evidence.endsWith('system.'));
assert.match(knownSapTranslation(kernel.evidence),/749 veya 753/);
const workbook=await JSZip.loadAsync(await (await createActionWorkbook(report,emptyTranslations())).arrayBuffer());
const actions=await workbook.file('xl/worksheets/sheet1.xml').async('string');
assert.equal((actions.match(/<row /g)||[]).length,9);
assert.match(actions,/749 or 753/);
const sql=await workbook.file('xl/worksheets/sheet3.xml').async('string');
assert.match(sql,/1678/);
assert.match(sql,/J2EE_CONFIGENTRY/);
console.log('PASS: actual PDF -> analysis -> full kernel evidence/translation -> XLSX action and SQL values.');
