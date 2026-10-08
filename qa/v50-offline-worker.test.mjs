import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareOfflineTranslator} from '../lib/offline-translator.ts';
import {translateText} from '../lib/local-translation.ts';

test('offline adapter initializes without report text, translates locally, cancels pending work',async()=>{
 const previous=globalThis.Worker;let worker;
 globalThis.Worker=class {
  messages=[];terminated=false;
  constructor(){worker=this;}
  postMessage(message){this.messages.push(message);}
  terminate(){this.terminated=true;}
  emit(data){this.onmessage?.({data});}
 };
 try{
  const controller=new AbortController();let progress=0;
  const ready=prepareOfflineTranslator(controller.signal,value=>progress=value);
  assert.equal(worker.messages[0].type,'init');assert.equal(worker.messages[0].text,undefined);
  worker.emit({type:'progress',value:.4});assert.equal(progress,.4);
  worker.emit({id:1,type:'ready'});const model=await ready;
  const result=model.translate('A synthetic statement.');
  assert.equal(worker.messages[1].text,'A synthetic statement.');
  worker.emit({id:2,type:'result',text:'Örnek ifade.'});assert.equal(await result,'Örnek ifade.');
  const pending=model.translate('Another test.');controller.abort();
  await assert.rejects(pending,/durduruldu/);assert.equal(worker.terminated,true);
  worker.emit({type:'progress',value:1});assert.equal(progress,.4);
 }finally{globalThis.Worker=previous;}
});
test('corrected tokenizer agrees with source model special token IDs',()=>{
 const t=JSON.parse(readFileSync(new URL('../public/models/ewa-en-tr/tokenizer.json',import.meta.url)));
 assert.equal(t.model.vocab.length,57060);
 assert.equal(t.model.vocab[21][0],'!');
 assert.equal(t.model.vocab[158][0],'0');
 assert.equal(t.model.vocab[43741][0],'</s>');
 assert.equal(t.model.vocab[52508][0],'<unk>');
 assert.equal(t.model.unk_id,52508);
 assert.equal(t.model.vocab[57059][0],'<pad>');
 assert.equal(new Set(t.model.vocab.map(x=>x[0])).size,57060);
});
test('semantic failure in masked output retries raw text with all literals checked',async()=>{
 let calls=0;
 const result=await translateText({translate:async()=>++calls===1?'ZXQEWATERM0QXZ yedek tutun.':'En az 3 yedek tutun.'},'Keep at least 3 backups.');
 assert.equal(result,'En az 3 yedek tutun.');assert.equal(calls,2);
});
