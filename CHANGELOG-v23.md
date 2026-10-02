# EWA Radar v23

- v22.1 paketinden başlandı; v20'deki görsel düzen ve renkler korundu.
- Bulgulara ve SAP önerilerine aynı ve açık etiketli Türkçe/İngilizce görünüm eklendi.
- Çevrilmeyen İngilizce metinler Türkçe etiketiyle gösterilmez.
- Indexserver dahil doğrulanmış yaygın teknik çeviriler otomatik ve tarayıcı desteğinden bağımsız görünür.
- SAP kaynak alıntıları ile Radar'ın analiz açıklamaları etiketlerde ayrıldı.
- Doğrudan kanıt olmayan uzun SAP bölüm açıklaması açılır kanıt paneline taşındı.
- DVM/arşivleme ifadesi teknik olarak açık Türkçe cümleyle değiştirildi.
- QA: `node --experimental-strip-types --test qa/v23.test.mjs` ve çekirdek iki TypeScript modülünün `tsc` denetimi.
- Kısıt: rastgele uzun SAP metinlerinin tamamını çevirme garantisi yoktur. Yerel cihaz Translator API yoksa doğrulanmış hazır çeviriler ve özgün İngilizce korunur.
- Kısıt: bağımlılıklar bu ortamda kurulu olmadığından tam `pnpm run build:vercel` test edilemedi.
