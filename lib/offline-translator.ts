import type {LocalTranslator} from './local-translation';
export function prepareOfflineTranslator(signal:AbortSignal,onProgress:(value:number)=>void):Promise<LocalTranslator> {
  if(signal.aborted) return Promise.reject(new Error('Çeviri durduruldu.'));
  const worker=new Worker(new URL('../workers/translation.worker.ts',import.meta.url),{type:'module'});
  let stopped=false;let serial=0;
  const pending=new Map<number,{resolve:(value:string)=>void;reject:(reason:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  const destroy=()=>{
    if(stopped)return;stopped=true;worker.terminate();signal.removeEventListener('abort',destroy);
    for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('Yerel çeviri durduruldu.'));}
    pending.clear();
  };
  signal.addEventListener('abort',destroy,{once:true});
  worker.onmessage=event=>{
    if(stopped)return;
    const message=event.data;
    if(message.type==='progress'){onProgress(message.value);return;}
    const request=pending.get(message.id);if(!request)return;
    clearTimeout(request.timer);pending.delete(message.id);
    if(message.type==='error')request.reject(new Error(message.message));else request.resolve(message.text??'');
  };
  worker.onerror=()=>destroy();
  const send=(type:'init'|'translate',text?:string)=>new Promise<string>((resolve,reject)=>{
    if(stopped){reject(new Error('Yerel model kapatıldı.'));return;}
    const id=++serial;
    const timer=setTimeout(()=>{reject(new Error(type==='init'?'Model indirme zaman aşımına uğradı.':'Yerel çeviri zaman aşımına uğradı.'));destroy();},type==='init'?600000:90000);
    pending.set(id,{resolve,reject,timer});worker.postMessage({id,type,text});
  });
  return send('init').then(()=>({translate:(text:string)=>send('translate',text),destroy})).catch(error=>{destroy();throw error;});
}
