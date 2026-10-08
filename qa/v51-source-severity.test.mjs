import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {alignSourceSeverity,findingSeverityLabel} from '../lib/source-severity.ts';
import {ewaItem,sectionBySource} from '../lib/section-reference.ts';
import {collectSapRecommendations} from '../lib/report-insights.ts';
import {createActionWorkbook} from '../lib/excel-export.ts';
import {toMarkdown} from '../lib/ewa.ts';
const section=(path,rating,number)=>({title:path.split(' > ').at(-1),path,rating,number,level:2,observations:[],tables:[],recommendations:['Recommendation: Check the service readiness settings and apply the documented corrections.']});
const finding=(source,priority='yuksek')=>({id:source,source,priority,title:'Service readiness',evidence:'Documented service readiness issue.',action:'Review the source recommendation.',owner:'Basis',confidence:'Rapor bulgusu'});
const report=(sections,findings)=>({kind:'EWA',sid:'ABC',period:'01.01.2026 – 07.01.2026',rating:'KIRMIZI',filename:'test.doc',format:'Word XML (.doc)',product:'',database:'',example:false,sections,findings,recommendations:collectSapRecommendations(sections),alerts:{red:0,yellow:0,total:0,items:[]},decisive:[],kpis:[],caveats:[],extractedLines:10,componentUpdates:[],componentCount:null,sqlHotspots:[],sqlWindow:null,sqlLoads:[],sqlServerStatements:[],topSqlStatements:[],sqlLoadImpact:null,hanaParameters:[],lifecycle:[]});
test('red source overrides old hard-coded high priority; UI, recommendation, Markdown and Excel agree',async()=>{
 const r=alignSourceSeverity(report([section('Readiness > RTCCTOOL','red','3.1')],[finding('RTCCTOOL')]));
 assert.equal(r.findings[0].priority,'kritik');assert.equal(r.findings[0].sourceRating,r.recommendations[0].rating);
 assert.equal(findingSeverityLabel(r.findings[0]),'Kritik · Kırmızı');assert.match(toMarkdown(r),/Kritik · Kırmızı/);
 const zip=await JSZip.loadAsync(await(await createActionWorkbook(r)).arrayBuffer());
 assert.match(await zip.file('xl/worksheets/sheet1.xml').async('string'),/Kritik · Kırmızı/);
 assert.match(await zip.file('xl/worksheets/sheet2.xml').async('string'),/Kritik · Kırmızı/);
});
test('yellow and green sources cannot be promoted by numeric heuristics',()=>{
 for(const [rating,priority] of [['yellow','yuksek'],['green','izle']]){
  const r=alignSourceSeverity(report([section('Tables','red','1'),section('Tables > Records',rating,'1.1')],[finding('Tables > Records','kritik')]));
  assert.equal(r.findings[0].sourceRating,rating);assert.equal(r.findings[0].priority,priority);
 }
});
test('numberless sections retain severity without inventing section numbers',()=>{
 const r=alignSourceSeverity(report([section('Database > Log Backup','yellow')],[finding('Log Backup')]));
 assert.equal(r.findings[0].sourceRating,'yellow');assert.match(ewaItem(r,r.findings[0]),/Numara doğrulanamadı/);assert.doesNotMatch(ewaItem(r,r.findings[0]),/undefined/);
});
test('unknown child does not inherit red parent or a similar sibling',()=>{
 const r=alignSourceSeverity(report([section('Security','red','4'),section('Security > Audit','unknown','4.1'),section('Security > SYSTEM','red','4.2')],[finding('Audit','kritik')]));
 assert.equal(r.findings[0].priority,'izle');assert.equal(findingSeverityLabel(r.findings[0]),'Seviye okunamadı');
});
test('ambiguous section titles are not guessed; exact path still resolves',()=>{
 const r=report([section('DB A > Backup','red','1.1'),section('DB B > Backup','yellow','2.1')],[finding('Backup')]);
 assert.equal(sectionBySource(r,'Backup'),null);assert.equal(sectionBySource(r,'DB B > Backup').rating,'yellow');
 assert.equal(alignSourceSeverity(r).findings[0].sourceRating,'unknown');
});
test('exact Alert Overview evidence supplies known severity when section is absent',()=>{
 const r=report([], [{...finding('Alert Overview'),evidence:'User SYSTEM is active.'}]);
 r.alerts.items=[{title:'User SYSTEM is active.',severity:'red'}];
 assert.equal(alignSourceSeverity(r).findings[0].priority,'kritik');
 r.findings[0].evidence='User SYSTEM might be active.';
 assert.equal(alignSourceSeverity(r).findings[0].sourceRating,'unknown');
});
test('monthly maintenance priorities are preserved',()=>{
 const r={...report([], [finding('Maintenance','orta')]),kind:'Bakım'};
 assert.equal(alignSourceSeverity(r),r);
});
