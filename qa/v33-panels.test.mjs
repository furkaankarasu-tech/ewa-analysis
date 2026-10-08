import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kpiPercent, orderedKpis, sectionCoverage } from '../lib/dashboard-metrics.ts';
const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/modern-theme.css', import.meta.url), 'utf8');
test('KPI gauges use percentages or compatible fractions only', () => {
 assert.equal(kpiPercent({label:'HANA bellek', value:'3.752 / 4.477 GB'}), 3752 / 4477 * 100);
 assert.equal(kpiPercent({label:'DATA disk boşluğu', value:'%19,9'}),19.9);
 assert.equal(kpiPercent({label:'SQL toplam süre', value:'87.085,2 sn'}),null);
 assert.equal(kpiPercent({label:'HANA bellek', value:'8 / 0 GB'}),null);
 assert.equal(kpiPercent({label:'HANA bellek', value:'4 / 5 GB'}),80);
 assert.equal(kpiPercent({label:'HANA bellek', value:'-', note:'%83,8 limit'}),83.8);
});
test('section coverage reflects evidence rather than made-up scores',()=>{
 assert.deepEqual(sectionCoverage([]),{total:0,withContent:0,headingsOnly:0,percent:null});
 assert.deepEqual(sectionCoverage([{observations:['text'], recommendations:[],tables:[]},{observations:[],recommendations:[],tables:[]}]),{total:2,withContent:1,headingsOnly:1,percent:50});
});
test('priority KPI ordering does not change original inputs',()=>{
 const input=[{label:'DB büyüklüğü',value:'5 GB'},{label:'HANA bellek',value:'2 / 4 GB'}];
 assert.equal(orderedKpis(input)[0].label,'HANA bellek'); assert.equal(input[0].label,'DB büyüklüğü');
});
test('new panels are mounted in actual report layout and reference report data',()=>{
 assert.match(page,/function KpiMetric/);
 assert.match(page,/report\.kpis/);
 assert.match(page,/sectionCoverage\(report\.sections\)/);
 assert.match(page,/quality\.issues\.length/);
 assert.match(page,/href="#quality-heading"/);
 assert.match(css,/\.metric-rail/);
 assert.match(css,/\.coverage-donut/);
 assert.match(css,/\.quality-compact/);
 assert.doesNotMatch(page,/28\s*\/\s*29/);
});
