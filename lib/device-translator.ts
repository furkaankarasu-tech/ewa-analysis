import type { LocalTranslator, TranslatorFactory } from './local-translation.ts';

/** Creates an on-device model during the user's click, including first-use download.
 * No report text is passed to create(). Cancellation disposes late arrivals too. */
export function prepareDeviceTranslator(factory: TranslatorFactory | null, options: {
  signal: AbortSignal;
  onProgress?: (fraction: number) => void;
  timeoutMs?: number;
}): Promise<LocalTranslator> {
  if (!factory) return Promise.reject(new Error('Bu tarayıcı cihazda çeviri modelini desteklemiyor. Masaüstü Chrome kullanın. Mevcut SAP sözlüğü çalışmaya devam eder.'));
  if (options.signal.aborted) return Promise.reject(new Error('Çeviri durduruldu.'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, translator?: LocalTranslator) => {
      if (settled) { translator?.destroy?.(); return; }
      settled = true;
      clearTimeout(timer);
      options.signal.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve(translator!);
    };
    const cancel = () => finish(new Error('Çeviri durduruldu.'));
    const timer = setTimeout(() => finish(new Error('Dil paketi zamanında hazırlanamadı. Bağlantınızı kontrol edip yeniden deneyin.')), options.timeoutMs ?? 180000);
    options.signal.addEventListener('abort', cancel, { once: true });
    try {
      // Do not gate create on availability: downloadable is valid, and browser
      // privacy rules may return it even for packs already on disk.
      factory.create({sourceLanguage:'en',targetLanguage:'tr',monitor(monitor) {
        monitor.addEventListener('downloadprogress', event => {
          if (!settled && typeof event.loaded === 'number' && Number.isFinite(event.loaded)) options.onProgress?.(Math.max(0,Math.min(1,event.loaded)));
        });
      }}).then(translator => finish(undefined,translator), error => finish(new Error(
        `Cihazda çeviri başlatılamadı. Dil paketi veya tarayıcı desteğini kontrol edin.${error instanceof Error && error.name === 'NotAllowedError' ? ' Düğmeye yeniden tıklayın.' : ''}`
      )));
    } catch { finish(new Error('Cihazda çeviri başlatılamadı; özgün rapor korundu.')); }
  });
}
