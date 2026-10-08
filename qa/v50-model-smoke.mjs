// Optional integration test: downloads ~540 MB of static weights; no report data.
// MODEL_CACHE_DIR may point at an existing cache. This test uses Node CPU, not browser WASM.
import {pipeline,env,MarianTokenizer} from '@huggingface/transformers';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {translateText} from '../lib/local-translation.ts';
import {OFFLINE_MODEL,OFFLINE_REVISION} from '../lib/offline-model-config.ts';
env.cacheDir=process.env.MODEL_CACHE_DIR || './.model-cache';env.allowLocalModels=false;
const tr=await pipeline('translation',OFFLINE_MODEL,{revision:OFFLINE_REVISION,device:'cpu',dtype:'q8'});
try {
 tr.tokenizer=new MarianTokenizer(JSON.parse(readFileSync(new URL('../public/models/ewa-en-tr/tokenizer.json',import.meta.url))),JSON.parse(readFileSync(new URL('../public/models/ewa-en-tr/tokenizer_config.json',import.meta.url))));
 const translate=async text=>(await tr(text,{max_new_tokens:384,num_beams:2}))[0].translation_text;
 const probe=await translate('Keep at least 3 backups.');assert.match(probe,/en az 3/i);assert.match(probe,/yedek/i);
 for(const [source,patterns] of [
  ['Keep at least 3 backups.',[/en az 3/i,/yedek/i]],
  ['Check the kernel version and analyze the dump records.',[/kernel/i,/dump/i]],
  ['Investigate the high memory consumption of the database.',[/bellek/i,/tüketim/i]],
  ['Do not change parameter rdisp/max_wprun_time without reviewing SAP Note 123456.',[/rdisp\/max_wprun_time/,/SAP Note 123456/,/değiştirmeyin/]]
 ]){const result=await translateText({translate},source);assert.notEqual(result,source);for(const pattern of patterns)assert.match(result,pattern);console.log(JSON.stringify({source,result}));}
 console.log('PASS: pinned q8 model, corrected tokenizer, startup self-check and 4 protected translations (Node CPU).');
} finally {await tr.dispose();}
