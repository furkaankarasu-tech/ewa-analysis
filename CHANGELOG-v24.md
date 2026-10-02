# EWA Radar v24 · Görünüm düzeltmesi

- v20 ana CSS ve ekran ızgarası birebir korundu (ilk 29379 bayt, hash testi).
- Radar'ın kendi Türkçe bulgularındaki başlık, ölçüm ve aksiyon metni tekrarlanmaz.
- Bu bulguların İngilizce açıklamaları isteğe bağlı **İngilizce analiz özeti** altında, SAP alıntısı olduğu iddia edilmeden sunulur.
- İngilizce SAP rapor bulgularında doğrulanmış Türkçe üstte, özgün İngilizce altta kalır.
- SAP önerileri bölümünde Türkçe ve İngilizce özgün metin ayrılır; etiketle metin bitişmez.
- Her bulguda yalnız bir çeviri eksikliği uyarısı gösterilir.
- v23.1 isteğe bağlı `impact`/`cause` TypeScript düzeltmesi korundu.
- ÖNEMLİ: Tarayıcının yerel Translator API desteği yoksa genel SAP cümlelerinin tamamı Türkçeleştirilemez; doğrulanmış çeviriler uygulanır ve diğer metinler kaynak İngilizce kalır. Hiçbir dosya dış servise gönderilmez.
- Tam Next.js/Vercel derlemesi için proje bağımlılıklarının kurulu olması gerekir; mevcut çalışma ortamı npm kayıt sistemine erişemediğinden bu aşama doğrulanamadı.

Yerel test: `node --experimental-strip-types --test qa/v24-layout.test.mjs qa/typecheck-optional-fields.mjs`
Üretim derlemesi: `pnpm run build:vercel`
