import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDeviceTranslator} from '../lib/device-translator.ts';
test('first use creates downloadable model and sends language options only',async()=>{
 const progress=[];const translator={translate:async x=>x};let input;
 const factory={availability:async()=> 'downloadable',create:async options=>{input=options;options.monitor({addEventListener:(name,fn)=>{assert.equal(name,'downloadprogress');fn({loaded:.5});fn({loaded:1});}});return translator;}};
 assert.equal(await prepareDeviceTranslator(factory,{signal:new AbortController().signal,onProgress:x=>progress.push(x)}),translator);
 assert.deepEqual(Object.keys(input).sort(),['monitor','sourceLanguage','targetLanguage']);assert.deepEqual(progress,[.5,1]);
});
test('unsupported browser reports explicit fallback instead of waiting',async()=>{
 await assert.rejects(prepareDeviceTranslator(null,{signal:new AbortController().signal}),/Masaüstü Chrome/);
});
test('cancel disposes late model and ignores later progress',async()=>{
 const controller=new AbortController();let complete;let destroyed=0;let progress;let calls=0;
 const promise=prepareDeviceTranslator({create:options=>{options.monitor({addEventListener:(_,fn)=>progress=fn});return new Promise(resolve=>complete=resolve);}},{signal:controller.signal,onProgress:()=>calls++});
 controller.abort(); await assert.rejects(promise,/durduruldu/);
 progress({loaded:1});complete({translate:async x=>x,destroy:()=>destroyed++});await Promise.resolve();
 assert.equal(calls,0);assert.equal(destroyed,1);
});
test('failed initialization can retry successfully',async()=>{
 await assert.rejects(prepareDeviceTranslator({create:async()=>{throw Error('network')}},{signal:new AbortController().signal}),/başlatılamadı/);
 const model={translate:async()=> 'Türkçe'};
 assert.equal(await prepareDeviceTranslator({create:async()=>model},{signal:new AbortController().signal}),model);
});
test('timeout rejects and releases a later model',async()=>{
 let complete;let destroyed=0;
 const promise=prepareDeviceTranslator({create:()=>new Promise(resolve=>complete=resolve)},{signal:new AbortController().signal,timeoutMs:5});
 await assert.rejects(promise,/zamanında/);complete({translate:async x=>x,destroy:()=>destroyed++});await Promise.resolve();assert.equal(destroyed,1);
});

test('model output cannot silently lose exclusions or minimum/maximum qualifiers',async()=>{
 const {passesTechnicalReview}=await import('../lib/local-translation.ts');
 assert.equal(passesTechnicalReview('Remove access except SYSTEM.','SYSTEM erişimini kaldırın.'),false);
 assert.equal(passesTechnicalReview('Remove access except SYSTEM.','SYSTEM dışındaki erişimleri kaldırın.'),true);
 assert.equal(passesTechnicalReview('Keep at least 3 backups.','3 yedek tutun.'),false);
 assert.equal(passesTechnicalReview('Keep at least 3 backups.','En az 3 yedek tutun.'),true);
 assert.equal(passesTechnicalReview('Use at most 4 workers.','En az 4 çalışan kullanın.'),false);
});
