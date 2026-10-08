import test from 'node:test';
import assert from 'node:assert/strict';
import { parameterRows, parameterReference } from '../lib/parameter-presentation.ts';
import { polishRadarTurkish, translatedSapHeading } from '../lib/sap-terminology.ts';

test('ABAP dump remains a technical term, with counts unchanged', () => {
 assert.equal(polishRadarTurkish('142 dump. GETWA_NOT_ASSIGNED 93 adet.', 'evidence'), '142 ABAP dump. GETWA_NOT_ASSIGNED 93 adet.');
 assert.equal(polishRadarTurkish('ABAP dump yoğunluğu', 'title'), 'ABAP dump yoğunluğu');
 assert.equal(translatedSapHeading('Program Errors (ABAP Dumps)'), 'Program hataları (ABAP dump kayıtları)');
});
test('parameter rows retain unknown, zero, negative and range values; only exact duplicates collapse', () => {
 const item = { location:'global.ini [memorymanager]', parameter:'gc_unused_memory_threshold_abs', current:'0', recommended:'<between 227840 and 1139200> [683520]', note:'2169283' };
 const report = { hanaParameters:[item, {...item}, {...item,current:'-1'}, {...item,current:'—'}], sections:[] };
 assert.deepEqual(parameterRows(report).map(x => x.current), ['0','-1','—']);
 assert.equal(parameterRows(report)[0].recommended, item.recommended);
 assert.equal(parameterReference(report,item), 'Madde doğrulanamadı');
 const section = { number:'8.3.2', page:24, tables:[{header:['Location','Parameter','Current Value','Recommended Value'],rows:[[item.location,item.parameter,item.current,item.recommended]]}] };
 report.sections=[section];
 assert.equal(parameterReference(report,item), 'Madde 8.3.2 · s. 24');
 report.sections=[section,{...section,number:'9.1'}];
 assert.equal(parameterReference(report,item), 'Madde doğrulanamadı');
});
