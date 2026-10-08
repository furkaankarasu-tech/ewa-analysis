import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { kpiPercent } from '../lib/dashboard-metrics.ts';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const source = page.slice(page.indexOf('function KpiMetric('), page.indexOf('function SqlPanel('));
const js = ts.transpileModule(source, {compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
const Metric = new Function('React','kpiPercent',js+'; return KpiMetric;')(React,kpiPercent);
test('actual metric markup has no empty gauge for dump counts, GB or text ratings', () => {
 for (const metric of [{label:'ABAP dump',value:'41',note:'Haftalık'},{label:'DB büyüklüğü',value:'3.646,14 GB'},{label:'Pahalı SQL etkisi',value:'HIGH',note:'CPU %8,25 · I/O %40,17'}]) {
  const html=renderToStaticMarkup(React.createElement(Metric,{metric}));
  assert.ok(html.includes(metric.value));
  assert.ok(!html.includes('progressbar'));
  assert.ok(!html.includes('metric-unscaled'));
 }
});
test('actual ratio gauge preserves the measured percentage', () => {
 const html=renderToStaticMarkup(React.createElement(Metric,{metric:{label:'HANA bellek',value:'4 / 5 GB'}}));
 assert.match(html,/role="progressbar"/);
 assert.match(html,/aria-valuenow="80"/);
 assert.match(html,/%80/);
});
