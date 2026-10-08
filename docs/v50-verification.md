# v50 doğrulama — 7 Ekim 2026

## Geçen kontroller

- `pnpm install --frozen-lockfile`: başarılı. Transformers.js 3.8.1 sabitlenmiştir. Tarayıcı WASM kullandığı için isteğe bağlı onnxruntime-node GPU indirme scripti açıkça kapalıdır; bağımlılık güvenlik politikası korunur.
- `pnpm test:offline`: 126 test, 126 başarılı. Model hazırlama/iptal/zaman aşımı, geç sonuç temizliği, worker mesaj akışı, tokenizer kimlikleri, kritik literal/terim/istisna kontrolleri dahildir.
- `pnpm lint`: 0 hata, mevcut logo img öğesi için 1 Next.js optimizasyon uyarısı.
- `pnpm build`: Next.js Webpack üretim derlemesi ve TypeScript başarılı; model worker derlemeye dahildir.
- Gerçek CEP PDF: SID, dönem, 25 ABAP dump, 10 uyarı, 8 bulgu, 10 SQL satırı doğrulandı. 10 SAP önerisinin 10'u incelenmiş karşılıkla çevrildi. XLSX aksiyon sayfası dolu (başlık/açıklamalarla 13 satır); SAP önerisi ve SQL sayfaları içerik taşıyor. Markdown seçili çeviriyi koruyor.
- `qa/v50-model-smoke.mjs`: gerçek, sabitlenmiş q8 model Node CPU ile çalıştırıldı. Modelin ilk ham denemesi bozuk tokenizer nedeniyle başarısızdı; tokenizer özgün vocab kimliklerine düzeltildi ve tekrar test edildi. Worker'ın başlangıç test cümlesi ve dört korumalı çeviri geçti.

## Gerçek modelden örnek

Kaynak: `Check the kernel version and analyze the dump records.`

Uygulamanın koruma katmanından geçen çıktı: `kernel sürümünü kontrol edin ve dump kayıtlarını analiz edin.`

Kaynak: `Do not change parameter rdisp/max_wprun_time without reviewing SAP Note 123456.`

Çıktı: `rdisp/max_wprun_time parametresini SAP Note 123456'yi incelemeden değiştirmeyin.`

## Tamamlanmamış canlı doğrulama

- Bu ZIP mevcut https://ewa-analysis.vercel.app/ dağıtımını güncellemez; Vercel'e yayın yapılmadı.
- Tarayıcının yerleşik çevirici demosu bu ortamda İngilizce→Türkçe için NotSupportedError verdi. Uygulamadaki bağımsız model bu özelliği kullanmaz.
- Yeni sürümün yerel tema önizlemesi bulut tarayıcısının dosya URL politikasınca engellendi. Yeni temanın görsel tarayıcı doğrulaması ve bağımsız worker'ın gerçek tarayıcı WASM çalışması bu oturumda tamamlanamadı. CPU model testi bunların yerine tam uçtan uca tarayıcı testi olarak sunulmaz.
- Model çıktısı hatalı veya kulağa doğal gelmeyen cümleler üretebilir. Kontroller sayıları/teknik kimlikleri/terimleri ve bazı anlam işaretlerini korur; bütün anlam hatalarını yakalamaz. Özgün kaynak korunur.
- Düşük bellek, model indirme engeli veya tarayıcı önbelleğinin silinmesi bağımsız çeviriyi etkileyebilir. Hata durumunda özgün İngilizce ve incelenmiş SAP karşılıkları kullanılabilir.

Özel raporlar, indirilmiş model ağırlıkları, test çıktısı Excel'leri ve rapor ekran görüntüleri dağıtım paketine dahil değildir.
