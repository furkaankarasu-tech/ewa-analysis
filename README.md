# EWA Radar v27

SAP EWA, HANA ve aylık bakım raporlarını tarayıcı içinde okuyan analiz uygulaması.

## Kurulum

1. ZIP içindeki proje dosyalarını (yalnızca ZIP'in kendisini değil) GitHub deposunun kök dizinine yükleyin.
2. Vercel ile yeniden dağıtın. Kurulum komutu projeye göre `pnpm install`, derleme komutu `pnpm run build:vercel`.
3. Örnek raporlarınızdaki HANA, SAP önerileri, Java, ABAP ve Oracle bulgularını inceleyin.

## v27'de değişenler

v20'nin eski görsel teması korundu. Ortak teknik terim listesi ve katı kaynak koruma yaklaşımı yalnızca partisyonlama için değil, rapordaki birçok EWA başlığı ve ilgili öneri için geçerlidir. Gözden geçirilmiş Türkçe metin üstte; gerçekten SAP raporundan gelen İngilizce özgün metin altta, küçük biçimde bulunur. Türkçe üretilen Radar bulguları için sonradan uydurma İngilizce üretilmez. Kaynaklar ayrıntı bölümünde incelenebilir. İndirilen çıktılar o an hazır olan çevirileri kullanır.

**Sınır:** Her olası SAP veya müşteri cümlesinin tamamen çevrilmesini çevrimdışı küçük bir sözlük garanti edemez. Tarayıcının yerel çeviri özelliği yoksa, sözlükte olmayan İngilizce ifadeler değiştirilmeden gösterilir. Raporlar sunucuya veya dışarıdaki bir çeviri servisine gönderilmez.

## Test

`pnpm run test:offline` veya `npm run test:offline`. Jest/DOM veya gerçek browser gerektirmeyen görünüm, dil, terminoloji, isteğe bağlı alan ve dosya ayrıştırma kontrollerini çalıştırır. Tam üretim derlemesi için `pnpm run build:vercel`.

Değişikliklerin özeti için `CHANGELOG-v27.md`.
