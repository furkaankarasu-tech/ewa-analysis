# EWA Radar v21 — Türkçe / İngilizce ve teknik terim düzeltmeleri

- Rapor seçilince tarayıcı destekliyorsa cihazda Türkçe çeviri hazırlanır.
- SAP önerileri: üstte Türkçe, hemen altında rapordaki değiştirilmemiş İngilizce orijinal gösterilir. Kaynak başlığı çevrilebildiğinde özgün İngilizce kaynak yolu ayrıca görünür.
- Bulguların çevrilen alanlarının özgün halleri de gösterilir. Dil düğmesi iki dilli görünüm ile yalnızca İngilizce görünümü değiştirir.
- `partition`, `partitions`, `partitioning`, `tablespace`, `rowstore`, `columnstore` için veritabanı bağlamına uygun terim sözlüğü eklenmiştir. SAP parametreleri, SAP Note referansları ve sayılar çeviride korunur.
- Teknik tanımlayıcılar kaybolursa, rapordaki sayılar değiştirilirse veya tarayıcı metni çevirmeden aynen döndürürse o metnin İngilizce aslı gösterilir. Riskli bir metin Türkçe çevrilmiş gibi sunulmaz.
- Tarayıcının yerel Translator API'si desteklenmiyorsa rapor analizine devam edilir ve özgün İngilizce açıklamalar sunulur. İlk kullanımda tarayıcı cihaz üstü dil paketini indirebilir; proje harici çeviri API'si veya rapor yükleme sunucusu kullanmaz.
- Bu değişiklikler EWA analizindeki alarm derecesi yorumlama kurallarını veya sayısal rapor metriklerini değiştirmez.

## Testler

`node --test --experimental-strip-types qa/translation.test.mjs` bağımsız çeviri testlerini çalıştırır.

`node --test --experimental-strip-types qa/features.test.mjs` mevcut özellik testlerini çalıştırır; bunun için `pnpm install --frozen-lockfile` ile bağımlılıkların kurulu olması gerekir.

`pnpm run build:vercel` ile yerel üretim derlemesini ayrıca çalıştırın. Bu paketin hazırlanma ortamında paket kayıt servisi erişilemediği için tam Next.js derlemesi doğrulanamamıştır. Kaynak TSX/TS dosyaları TypeScript ayrıştırıcısı ile sözdizimi açısından denetlenmiştir.
