import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { reviewedAlertTranslation, alertPresentation } from '../lib/alert-presentation.ts';
import { toMarkdown } from '../lib/ewa.ts';
import { createActionWorkbook } from '../lib/excel-export.ts';

const software = 'SAP Software on this system is outdated. Support with SAP Security Notes is no longer ensured.';
const ranges = 'ABAP number ranges are used significantly.';

function report() {
  return {
    kind: 'EWA', sid: 'QAA', period: '01.10.2026 – 05.10.2026', rating: 'KIRMIZI',
    filename: 'synthetic.doc', format: 'Word XML (.doc)', database: '', product: '', example: false,
    alerts: { red: 1, yellow: 1, total: 2, items: [{ title: software, severity: 'red' }, { title: ranges, severity: 'yellow' }] },
    decisive: [software], kpis: [], sections: [], findings: [{ id: 'security-software', priority: 'kritik',
      title: 'SAP yazılımı güncel değil', evidence: software, action: 'SAP Security Note kapsamını doğrulayın.',
      owner: 'Basis', source: 'Alert Overview', confidence: 'Rapor bulgusu' }],
    recommendations: [], caveats: [], componentUpdates: [], lifecycle: [], sqlHotspots: [], sqlLoads: [],
    sqlServerStatements: [], topSqlStatements: [], hanaParameters: [], sqlWindow: null, sqlLoadImpact: null,
  };
}

test('the two screenshot alarms have reviewed translations, retaining their different meaning', () => {
  assert.match(reviewedAlertTranslation(software), /SAP Security Note düzeltmeleriyle destek/);
  assert.match(reviewedAlertTranslation(ranges), /belirgin düzeyde kullanılıyor/);
  assert.equal(alertPresentation(software, undefined, false).primary, software);
  assert.equal(alertPresentation(ranges, undefined, false).primary, ranges);
});

test('Markdown and Excel use the selected language and keep actual SAP source', async () => {
  const data = report();
  const translation = { findings: { 0: { evidence: reviewedAlertTranslation(software) } },
    alerts: { 0: reviewedAlertTranslation(software), 1: reviewedAlertTranslation(ranges) },
    decisive: { 0: reviewedAlertTranslation(software) }, recommendations: {} };
  const original = toMarkdown(data);
  assert.match(original, /SAP Software on this system is outdated/);
  assert.doesNotMatch(original, /SAP Security Note düzeltmeleriyle destek/);
  const turkish = toMarkdown(data, translation);
  assert.match(turkish, /SAP Security Note düzeltmeleriyle destek/);
  assert.match(turkish, /ABAP numara aralıkları belirgin düzeyde kullanılıyor/);
  assert.match(turkish, /SAP özgün metni: ABAP number ranges are used significantly/);
  const workbook = await JSZip.loadAsync(await (await createActionWorkbook(data, translation)).arrayBuffer());
  const actionXml = await workbook.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(actionXml, /SAP Security Note düzeltmeleriyle destek/);
  assert.match(actionXml, /SAP Software on this system is outdated/);
});
