import {pipeline, env, MarianTokenizer} from '@huggingface/transformers';
import {OFFLINE_MODEL, OFFLINE_REVISION, OFFLINE_BYTES} from '../lib/offline-model-config';
// Static model downloads only. Inference receives text in this worker, never in a request.
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm!.numThreads = 1;
type Engine = ((text:string, options:{max_new_tokens:number;num_beams:number}) => Promise<Array<{translation_text:string}>>) & {tokenizer: MarianTokenizer};
// Upstream generic task union exceeds TypeScript complexity; narrow to this one task.
const createTranslator = pipeline as unknown as (task:'translation', model:string, options:{revision:string;device:'wasm';dtype:'q8';progress_callback:(event:{status:string;file:string;loaded:number})=>void}) => Promise<Engine>;
let engine: Engine | null = null;
const downloaded = new Map<string, number>();
self.onmessage = async (event: MessageEvent<{id:number;type:'init'|'translate';text?:string}>) => {
  const {id,type,text} = event.data;
  try {
    if(type === 'init') {
      engine = await createTranslator('translation', OFFLINE_MODEL, {
        revision: OFFLINE_REVISION, device:'wasm', dtype:'q8',
        progress_callback: event => {
          if(event.status === 'progress') {
            downloaded.set(event.file,event.loaded);
            self.postMessage({type:'progress',value:Math.min(.99,[...downloaded.values()].reduce((a,b)=>a+b,0)/OFFLINE_BYTES)});
          }
        },
      });
      const [tokenizerData, tokenizerConfig] = await Promise.all([
        fetch('/models/ewa-en-tr/tokenizer.json').then(response => { if(!response.ok) throw Error('Tokenizer unavailable'); return response.json(); }),
        fetch('/models/ewa-en-tr/tokenizer_config.json').then(response => { if(!response.ok) throw Error('Tokenizer unavailable'); return response.json(); }),
      ]);
      // Upstream export orders vocab alphabetically instead of by model token ID.
      // Bundled tokenizer restores the original Helsinki-NLP IDs and unk ID.
      engine.tokenizer = new MarianTokenizer(tokenizerData, tokenizerConfig);
      const probe = await engine('Keep at least 3 backups.',{max_new_tokens:64,num_beams:2});
      if(!/en az 3/i.test(probe[0]?.translation_text ?? '') || !/yedek/i.test(probe[0]?.translation_text ?? '')) throw Error('Model self-check failed');
      self.postMessage({id,type:'ready'});
    } else {
      if(!engine || !text) throw Error('Model hazır değil.');
      const result = await engine(text,{max_new_tokens:384,num_beams:2});
      const first=result[0];
      if(!first || !('translation_text' in first)) throw Error('Çeviri üretilemedi.');
      self.postMessage({id,type:'result',text:first.translation_text});
    }
  } catch {
    self.postMessage({id,type:'error',message:type==='init'?'Yerel model yüklenemedi. İnternet, boş bellek ve tarayıcı depolamasını kontrol edin.':'Yerel model bu metni çeviremedi.'});
  }
};
