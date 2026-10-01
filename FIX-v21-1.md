# EWA Radar v21.1 — Vercel TypeScript düzeltmesi

- `lib/ewa.ts` içindeki `toMarkdown` ve `toEmail` işlevlerinin varsayılan `TranslationBundle` değerleri ortak `emptyTranslations()` fonksiyonunu kullanıyor.
- `lib/excel-export.ts` içindeki `createActionWorkbook` işlevinin varsayılan değeri de aynı fonksiyonu kullanıyor.
- Böylece zorunlu `recommendationSources` alanının eksik kalması nedeniyle oluşan üç TS2741 hatası giderildi.
- Türkçe-İngilizce iki dilli sunum ve teknik SAP terimleri korundu.
- `qa/translation-bundle.test.mjs` bu hatanın tekrarlanmaması için eklendi.

## Kontrol

- Yerel Node.js testleri `node --experimental-strip-types --test qa/*.test.mjs` komutuyla çalıştırıldı.
- Çeviri modülünün TypeScript denetimi başarıyla yapıldı.
- Tam Next.js / Vercel derlemesi, bağımlılıkların çevrimdışı ortamda eksik olması nedeniyle çalıştırılamadı. Vercel'de yükleme sonrası `pnpm run build:vercel` sonucunu kontrol edin.
