import test from 'node:test';
import assert from 'node:assert/strict';
import {knownSapTranslation, passesTechnicalReview, translateText} from '../lib/local-translation.ts';
import {reportTranslationPlan} from '../lib/translation-plan.ts';
import {alertPresentation} from '../lib/alert-presentation.ts';
import {sapSourceLabel} from '../lib/sap-terminology.ts';
import {toMarkdown} from '../lib/ewa.ts';
const cases=[
 ['31 ABAP dumps have been recorded in your system in the period 01.09.2026 to 07.09.2026.',['31','dump','01.09.2026','07.09.2026']],
 ['We found more than 47 ABAP dumps in your system.',['47','dump','fazla']],
 ['Profile parameter gw/acl_mode is not set to 1.',['gw/acl_mode','1','ayarlanmamış']],
 ['Profile parameter gw/acl_mode should be set to 1.',['gw/acl_mode','1','ayarlanmalıdır']],
 ['Assign a minimum value of 12 to the profile parameter login/min_password_lng.',['login/min_password_lng','en az 12']],
 ['Set parameter global_allocation_limit to 0.',['global_allocation_limit','0']],
 ['The current value of parameter log_mode is normal.',['log_mode','normal']],
 ['SAP HANA database: Memory consumption of tables exceeds 82.5% of usable memory.',['82.5','aşıyor']],
 ['There were 8 failed log backups.',['8','başarısız','log']],
 ['The table SAPABAP1.BSEG contains 2500000 records.',['SAPABAP1.BSEG','2500000']],
 ['91% of the number range RV_BELEG is used.',['RV_BELEG','91']],
 ['Remove the DATA ADMIN privilege from all user accounts except the SYSTEM and _SYS_REPO users.',['DATA ADMIN','SYSTEM','_SYS_REPO','dışındaki']],
];
for(const [source,literals] of cases) test(`offline SAP: ${source}`,()=>{
 const result=knownSapTranslation(source); assert.ok(result); for(const token of literals) assert.ok(result.includes(token),result);
 assert.doesNotMatch(result,/kısa döküm|partisyon/);
});
test('unknown conditions and inverted permissions are not silently dropped',()=>{
 assert.equal(knownSapTranslation('Set parameter global_allocation_limit to 0 only if the database vendor approves.'),null);
 assert.equal(knownSapTranslation('Do not remove the DATA ADMIN privilege from SYSTEM.'),null);
});
test('technical review rejects literal but misleading dump/kernel translations',()=>{
 assert.equal(passesTechnicalReview('Review ABAP dumps.','ABAP kısa dökümlerini inceleyin.'),false);
 assert.equal(passesTechnicalReview('Update the kernel.','Çekirdeği güncelleyin.'),false);
 assert.equal(passesTechnicalReview('Update the kernel.','kernel sürümünü güncelleyin.'),true);
});
test('masked local translation restores SAP vocabulary',async()=>{
 const source='Review dump and kernel.';
 const result=await translateText({translate:async value=>value.replace('Review ','İnceleyin: ').replace(' and ',' ve ')},source);
 assert.match(result,/dump ve kernel/);
});
test('alarm presentation uses the same offline phrases without needing a translator',()=>{
 const source='Gateway Access Control List reg_info is not effective.';
 const display=alertPresentation(source,undefined,true);
 assert.equal(display.untranslated,false);assert.ok(display.primary.includes('reg_info'));assert.equal(display.original,source);
 assert.equal(alertPresentation(source,undefined,false).primary,source);
});
test('shared plan leaves original data intact and exports selected KPI language',()=>{
 const source='Profile parameter gw/acl_mode is not set to 1.';
 const report={kind:'EWA',sid:'TST',period:'test',rating:'',database:'',findings:[{id:'x',title:'Parameter Settings',evidence:source,action:'Set parameter gw/acl_mode to 1.',source:'Security',owner:'Basis',priority:'orta'}],alerts:{items:[{title:source,severity:'unknown'}]},decisive:[],recommendations:[{text:'Set parameter gw/acl_mode to 1.',source:'Security',rating:'unknown'}],kpis:[{label:'SQL',value:'HIGH'}],sections:[],sqlHotspots:[],sqlLoads:[],sqlServerStatements:[],topSqlStatements:[],componentUpdates:[],lifecycle:[],hanaParameters:[],caveats:[]};
 const snapshot=JSON.stringify(report);const {reviewed,tasks}=reportTranslationPlan(report);
 assert.equal(tasks.length,0);assert.equal(JSON.stringify(report),snapshot);
 assert.ok(reviewed.findings[0].evidence.includes('ayarlanmamış'));
 assert.equal(reviewed.findings[0].action,reviewed.recommendations[0]);
 assert.match(toMarkdown(report,reviewed),/SQL: Yüksek/);assert.match(toMarkdown(report),/SQL: HIGH/);
});
test('source breadcrumbs keep actual SID and EWA page',()=>{
 const source='Software Configuration for XYZ > Database - Maintenance Phases · s. 12';
 const result=sapSourceLabel(source);assert.ok(result.includes('XYZ'));assert.ok(result.endsWith('· s. 12'));assert.ok(result.includes('bakım dönemleri'));
});
