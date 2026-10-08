import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { authorizationAlertFindings, collectSapRecommendations } from '../lib/report-insights.ts';
import { alertPresentation } from '../lib/alert-presentation.ts';
import { createActionWorkbook } from '../lib/excel-export.ts';

const section = (title, recommendations, tables = [], path = `SAP HANA Database S4P > ${title}`) => ({
  title, path, number: '4.3', level: 3, rating: 'yellow',
  observations: [], recommendations, tables, page: 18,
});

test('incomplete advice is not presented as an actionable EWA recommendation', () => {
  const sections = [
    section('Number Range Trace', ['Recommendation: Depending on the figure in the column Remark, we recommend:']),
    section('SAP HANA Workload Management', ['We generally recommend setting the minimum value for initial setup. However, depending on the overall load situation, customer-specific settings may lead to better results and need to be evaluated.']),
    section('Parameter Recommendation', ['Set the SAP HANA parameters to the recommended value in the table.']),
  ];
  assert.deepEqual(collectSapRecommendations(sections), []);
});

test('parameter recommendation carries actual values, section number and source page', () => {
  const parent = section('Parameter Recommendation', ['Set the SAP HANA parameters to the recommended value in the table.']);
  const child = section('Parameter Values', [], [{ title: 'Parameter Recommendation',
    header: ['Parameter', 'Current Value', 'Recommended Value'], rows: [['global.ini/statement_memory_limit', '0', '100 GB']], totalRows: 1,
  }], `${parent.path} > Parameter Values`);
  const items = collectSapRecommendations([parent, child]);
  assert.equal(items.length, 1);
  assert.equal(items[0].number, '4.3');
  assert.equal(items[0].page, 18);
  assert.deepEqual(items[0].context?.rows, [['global.ini/statement_memory_limit', '0', '100 GB']]);
});

test('client 000 and other clients remain separate red alarm scopes', () => {
  const in000 = 'Users with critical authorizations, which allow to do anything in client 000';
  const other = 'Users with critical authorizations, which allow to do anything in other client(s) than 000';
  assert.equal(alertPresentation(in000, undefined, false).primary, in000);
  assert.equal(alertPresentation(other, undefined, false).primary, other);
  assert.match(alertPresentation(in000).primary, /000 istemcisinde tüm işlemlere izin veren kritik yetki/);
  assert.match(alertPresentation(other).primary, /000 dışındaki istemcilerde tüm işlemlere izin veren kritik yetki/);
  const findings = authorizationAlertFindings([{title: in000, severity: 'red'}, {title: other, severity: 'red'}], []);
  assert.deepEqual(findings.map((item) => item.priority), ['kritik', 'kritik']);
  assert.notEqual(findings[0].id, findings[1].id);
  assert.equal(authorizationAlertFindings([{title: in000, severity: 'unknown'}], []).length, 0);
});

test('Excel includes real recommendation table values even when no independent finding exists', async () => {
  const parent = section('Parameter Recommendation', ['Set the SAP HANA parameters to the recommended value in the table.']);
  parent.tables = [{ title: 'Parameter Recommendation', header: ['Parameter', 'Current Value', 'Recommended Value'],
    rows: [['global.ini/statement_memory_limit', '0', '100 GB']], totalRows: 1 }];
  const report = {
    kind: 'EWA', sid: 'QAA', period: '01.10.2026 – 05.10.2026', rating: 'SARI', filename: 'sample.doc',
    findings: [], recommendations: collectSapRecommendations([parent]), sections: [parent],
    sqlHotspots: [], sqlLoads: [], sqlServerStatements: [], topSqlStatements: [], hanaParameters: [],
    lifecycle: [], componentUpdates: [], sqlWindow: null, sqlLoadImpact: null,
  };
  const blob = await createActionWorkbook(report);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const workbook = await zip.file('xl/workbook.xml').async('string');
  const main = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const advice = await zip.file('xl/worksheets/sheet2.xml').async('string');
  assert.match(workbook, /sheet name="SAP önerileri"/);
  assert.match(main, /güvenilir aksiyon maddesi çıkarılamadı/);
  assert.match(advice, /Madde 4\.3/);
  assert.match(advice, /global\.ini\/statement_memory_limit/);
  assert.match(advice, /100 GB/);
});
