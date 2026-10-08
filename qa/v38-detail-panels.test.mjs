import { reportTranslationPlan } from "../lib/translation-plan.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewedAlertTranslation, alertPresentation } from '../lib/alert-presentation.ts';
import { shortSqlHash, sqlSourceLabel } from '../lib/sql-display.ts';
import { emptyTranslations } from '../lib/local-translation.ts';
const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/detail-panels.css',import.meta.url),'utf8');
const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');
const sampleAlerts = [
 ['SAP Software on this system is outdated. Support with SAP Security Notes is no longer ensured.','SAP Security Note düzeltmeleriyle destek sağlanması artık güvence altında değil.'],
 ['ABAP number ranges are almost exhausted.','Bazı ABAP numara aralıkları tükenmek üzere.'],
 ['ABAP number ranges are used significantly.','ABAP numara aralıkları belirgin düzeyde kullanılıyor.'],
 ['SAP HANA network settings for System Replication is insecure.','System Replication ağ yapılandırmasında güvenlik riski'],
 ['SAP HANA database: User SYSTEM is active and valid.','SYSTEM kullanıcısı etkin'],
 ['Users with critical authorizations, which allow to do anything in client 000','000 istemcisinde tüm işlemlere izin veren kritik yetkilere sahip'],
 ['Users with critical authorizations, which allow to do anything in other client(s) than 000','000 dışındaki istemcilerde'],
 ['We found more than 30 ABAP dumps in your system.','30 adetten fazla ABAP dump'],
 ['SAP HANA database: Memory consumption of tables exceeds 70% of usable memory.','%70'],
 ['SAP HANA database: Recommended Audit configuration is not applied.','denetim (Audit) yapılandırması'],
 ['The trend analysis on response time and applications shows a critical trend.','kritik bir değişim'],
];
for(const [english,turkish] of sampleAlerts) test(`reviewed alarm retains SAP meaning: ${english.slice(0,38)}`,()=>assert.match(reviewedAlertTranslation(english),new RegExp(turkish.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))));
test('unreviewed alarms remain actual source; never generate made-up Turkish',()=>{
 const src='Vendor Z RFC provider failed specifically in this system.';
 const d=alertPresentation(src);assert.equal(d.primary,src);assert.equal(d.untranslated,true);
 assert.equal(d.original,undefined);
});
test('screenshot alarm wording stays precise and no translation remains falsely pending',()=>{
 const software='SAP Software on this system is outdated. Support with SAP Security Notes is no longer ensured.';
 const ranges='ABAP number ranges are used significantly.';
 assert.match(alertPresentation(software).primary,/SAP Security Note düzeltmeleriyle destek/);
 assert.doesNotMatch(alertPresentation(software).primary,/güvenlik bakım süresi doldu|ürün desteği sona erdi/);
 assert.match(alertPresentation(ranges).primary,/belirgin düzeyde kullanılıyor/);
 assert.doesNotMatch(alertPresentation(ranges).primary,/tükenmek|kritik sınır/);
 assert.equal(alertPresentation(ranges,undefined,false).primary,ranges);
 assert.doesNotMatch(page,/Türkçe çeviri bekleniyor|Çeviri kontrolü yapılıyor/);
 assert.match(page,/Özgün SAP metni \(EN\) · doğrulanmış Türkçe karşılık yok/);
});
test('real original kept under translated source disclosure',()=>{
 const src='ABAP number ranges are almost exhausted.';const r=alertPresentation(src);
 assert.equal(r.original,src);assert.ok(r.primary.includes('tükenmek'));
});
test('long SQL source is not leaked into table title',()=>{
 const source='SELECT VERY_LONG_FIELD FROM SOME_HANA_TABLE WHERE ANOTHER_FIELD = 123';
 assert.equal(sqlSourceLabel(source),'SQL ifadesi');assert.equal(sqlSourceLabel('EBKE'),'EBKE');
 assert.equal(shortSqlHash('117791d82281bf792f59bda95dd0e125'),'117791d8228…dd0e125');
});
test('alarm lists and decisive alarms are now included in translation pipeline',()=>{
 const src = 'ABAP number ranges are almost exhausted.';
 const { reviewed } = reportTranslationPlan({findings:[],recommendations:[],alerts:{items:[{title:src}]},decisive:[src]});
 assert.match(reviewed.alerts[0],/tükenmek/); assert.equal(reviewed.decisive[0],reviewed.alerts[0]);
 assert.match(page,/translations\.alerts\?\.\[index\]/);assert.match(page,/translations\.decisive\?\.\[index\]/);
 assert.deepEqual(emptyTranslations(),{findings:{},recommendations:{},alerts:{},decisive:{}});
});
test('alert badges preserve source severity; unknown never guesses',()=>{
 assert.match(page,/severity-\$\{item\.severity\}/);
 assert.match(page,/sourceRatingLabels\[item\.severity\]/);
 assert.match(page,/Orijinal SAP metni \(EN\)/);
});
test('SQL hash/source only expanded; metrics are top-level table fields',()=>{
 assert.match(page,/sql-overview-table/);assert.match(page,/sql-statement-detail/);
 assert.match(page,/<pre>\{item\.source\}<\/pre>/);assert.match(page,/shortSqlHash\(item\.hash\)/);
 assert.match(page,/formatMeasure\(item\.executions\)/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
});
test('deep sections keep the dedicated detail layer before the single modern theme',()=>{
 assert.ok(layout.indexOf('detail-panels.css')<layout.indexOf('modern-theme.css'));
 assert.doesNotMatch(layout,/porcelain-theme\.css|architect-theme\.css|noir-theme\.css|editorial-theme\.css|radar-theme\.css/);
 assert.match(css,/\.deep-analysis \.section-heading \.eyebrow/);
 assert.match(css,/\.alert-list\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
});
