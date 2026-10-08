import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {translateText, sameCriticalLiterals, knownSapTranslation, translationDeadline, reportLabel} from '../lib/local-translation.ts';
import {pdfAlerts} from '../lib/pdf-ewa.ts';
import {parsePdfLayout} from '../lib/pdf-layout.ts';
import {createActionWorkbook} from '../lib/excel-export.ts';

test('raw fallback accepts Turkish grammar while preserving exact SAP identifiers', async()=>{
 const en='Review SYSTEM and _SYS_REPO using SAP Note 12345.';
 const tr='SYSTEM ve _SYS_REPO hesaplarını SAP Note 12345 ile inceleyin.';
 assert.equal(sameCriticalLiterals(en,tr),true);
 assert.equal(await translateText({translate:async text=>text.includes('ZXQ')?'bozuk':tr},en),tr);
 for(const bad of [tr.replace('_SYS_REPO','SYS_REPO'),tr.replace('12345','12346'),tr.replace('SYSTEM','system')]) assert.equal(sameCriticalLiterals(en,bad),false);
});
test('a failed chunk preserves the entire original instead of reporting partial success',async()=>{
 const en='Review the configuration carefully. '.repeat(35); let n=0;
 assert.equal(await translateText({translate:async text=>++n===1?'Yapılandırmayı dikkatle inceleyin.':text},en),en);
});
test('reviewed sentence composition preserves note numbers and rejects unknown additions',()=>{
 const en='SAP strongly recommends applying important security fixes as soon as possible. For details see SAP Note 12345.';
 assert.match(knownSapTranslation(en),/güvenlik düzeltmelerinin.*SAP Note 12345/);
 assert.equal(knownSapTranslation(en+' Invented technical advice.'),null);
});
test('local translator timeout settles and permits a later retry',async()=>{
 await assert.rejects(translationDeadline(new Promise(()=>{}),5),/zaman aşımı/);
 assert.equal(await translationDeadline(Promise.resolve('hazır'),5),'hazır');
});
test('presentation labels honor source mode and preserve technical values',()=>{
 assert.equal(reportLabel('HIGH',false),'HIGH'); assert.equal(reportLabel('HIGH',true),'Yüksek');
 assert.equal(reportLabel('global_allocation_limit',true),'global_allocation_limit');
 assert.equal(reportLabel('Current Value',true),'Mevcut değer');
});
test('PDF alert list stops before report navigation notes',()=>{
 assert.deepEqual(pdfAlerts(['Alert Overview','Gateway Access Control List reg_info is not effective.','Note: If you send SAP EarlyWatch Alert data to SAP,','Link to the analytical dashboard for this system: SAP EarlyWatch Alert Dashboard']),['Gateway Access Control List reg_info is not effective.']);
});
test('PDF recommendation is not cut after four wrapped lines',()=>{
 const strings=['1 Security','Recommendation: Review the settings','and check the first parameter','and check the second parameter','and check the third parameter','and check the last parameter.','2 Other section'];
 const items=strings.map((str,i)=>({str,x:50,y:740-i*15,width:400,height:i===0||i===6?14:10}));
 const result=parsePdfLayout([{page:1,items}]);
 assert.match(result.sections[0].recommendations[0],/last parameter\.$/);
});
test('Excel recommendation sheet includes selected Turkish and unchanged source',async()=>{
 const text='SAP strongly recommends applying important security fixes as soon as possible.';
 const data={kind:'EWA',sid:'TST',filename:'synthetic.pdf',period:'test',findings:[],sections:[],sqlHotspots:[],sqlLoads:[],hanaParameters:[],topSqlStatements:[],sqlServerStatements:[],componentUpdates:[],lifecycle:[],recommendations:[{text,number:'3.1',rating:'unknown',source:'Security'}]};
 const tr=knownSapTranslation(text);
 const zip=await JSZip.loadAsync(await(await createActionWorkbook(data,{findings:{},recommendations:{0:tr}})).arrayBuffer());
 const xml=await zip.file('xl/worksheets/sheet2.xml').async('string');
 assert.ok(xml.includes(tr)); assert.ok(xml.includes(text)); assert.ok(xml.includes('Madde 3.1'));
});
