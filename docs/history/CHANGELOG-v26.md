# EWA Radar v26: Teknik Türkçe metin düzeltmesi

- `Partisyonlanmamış büyük tablolar` başlığı `Bölümlere ayrılmamış büyük tablolar` olarak değiştirildi. Kaynak sayı, tablo adı, önem derecesi ve bulgu mantığı değişmedi.
- DVM / partitioning önerisi akıcı Türkçe ile yazıldı. SAP terimi `partitioning` teknik karşılık olarak parantez içinde korunuyor.
- SAP EWA'dan gelen `Largest Non-partitioned Column Tables (Records)` bölümünün yerel çevirisi de düzeltildi; tarayıcı için teknik sözlük güncellendi.
- Uygulamanın kendi oluşturduğu Türkçe bulgulara yeniden İngilizce özet eklenmiyor. Yalnızca gerçekten İngilizce kaynaklı SAP bulguları ve önerileri, varsa Türkçe çevirisinin altında İngilizce aslıyla yer alıyor.
- v20'nin `app/globals.css` dosyası **değiştirilmedi**. v25'in `Veri kalitesi` kart düzeni de korundu.
- `qa/v26-terminology.test.mjs` ve güncellenmiş yerleşim testleri ile geriye dönük kontroller eklendi.

## Doğrulama

```sh
node --experimental-strip-types --test qa/v25-layout.test.mjs qa/v26-terminology.test.mjs
node qa/typecheck-optional-fields.mjs
pnpm run build:vercel
```

İlk iki komut paket oluşturulurken kontrol edildi. Son komut Vercel/Next bağımlılıkları bu ortamda bulunmadığından burada doğrulanamadı.
