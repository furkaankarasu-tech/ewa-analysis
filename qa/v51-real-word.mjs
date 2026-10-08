import './word-test-host.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {analyzeEwa,toMarkdown} from '../lib/ewa.ts';
import {createActionWorkbook} from '../lib/excel-export.ts';
import {findingSeverityLabel} from '../lib/source-severity.ts';
import {sectionBySource} from '../lib/section-reference.ts';
for(const path of process.argv.slice(2)){
 const report=await analyzeEwa(new File([readFileSync(path)],path.split('/').at(-1)));
 const rtc=report.findings.find(x=>x.id==='service-preparation');
 const advice=report.recommendations.find(x=>/RTCCTOOL/.test(x.source));
 assert.ok(rtc && advice);assert.equal(rtc.sourceRating,advice.rating);assert.equal(rtc.priority,'kritik');
 for(const finding of report.findings){
  const source=sectionBySource(report,finding.source);
  if(source?.rating && source.rating!=='unknown')assert.equal(finding.sourceRating,source.rating);
  if(finding.sourceRating==='unknown')assert.equal(finding.priority,'izle');
 }
 assert.ok(report.findings.some(x=>x.id==='hana-system-user'));
 assert.ok(report.findings.some(x=>x.id==='hana-replication-security'));
 assert.ok(!report.findings.some(x=>x.id==='security'));
 const archive=await JSZip.loadAsync(await(await createActionWorkbook(report)).arrayBuffer());
 const actions=await archive.file('xl/worksheets/sheet1.xml').async('string');
 const actionRows=[...actions.matchAll(/<row r="(\d+)"[^>]*>(.*?)<\/row>/gs)].filter(x=>Number(x[1])>=6);
 assert.equal(actionRows.length,report.findings.length);
 const row=actionRows.find(x=>x[2].includes('RTCCTOOL'));assert.ok(row);assert.ok(row[2].includes(findingSeverityLabel(rtc)));
 const recommendations=await archive.file('xl/worksheets/sheet2.xml').async('string');
 assert.match(recommendations,/RTCCTOOL/);assert.match(recommendations,/Kritik · Kırmızı/);
 assert.ok(toMarkdown(report).includes(`[${findingSeverityLabel(rtc)}] ${rtc.title}`));
 console.log(JSON.stringify({file:path.split('/').at(-1),period:report.period,findings:report.findings.length,critical:report.findings.filter(x=>x.sourceRating==='red').length,yellow:report.findings.filter(x=>x.sourceRating==='yellow').length,unknown:report.findings.filter(x=>x.sourceRating==='unknown').length,alarms:report.alerts.items.length,decisive:report.decisive.length,recommendations:report.recommendations.length,rtcctool:rtc.sourceRating,excelActionRows:actionRows.length,result:'PASS'}));
}
