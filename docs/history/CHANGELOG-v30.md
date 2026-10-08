# EWA Radar v30 · Atlas tema

Bu sürümün amacı yalnızca kullanıcı arayüzünü yenilemektir. Rapor ayrıştırma, bulgu üretme, önem derecesi, kanıt, çeviri, PDF işleme ve Excel/Markdown/mail çıktı mantığı değiştirilmedi.

## Değişiklikler

- Yeni `app/radar-theme.css`, **globals.css ve bilingual.css'den sonra** içe aktarılıyor.
- Koyu lacivert yan menü; açık yüzeyler; kontrollü turkuaz, kırmızı ve sarı vurgu; ortak kart/kenarlık/gölge ve tipografi.
- Sol menüde gerçekte bulunan bölümlere giden bağlantılar: rapor yükle, öncelikli bulgular, ölçümler, SAP önerileri. Son üçü rapor varsa görünür.
- Dosya yükleme, rapor özeti, aksiyonlar, veri kalitesi, bulgular, KPI ve uzun önerilerin temaları eşitlendi.
- v25'in veri kalitesi bölümündeki geçici `style={qualityUI...}` kuralları kaldırıldı; ilgili bölüm tek stil kaynağından yönetiliyor.
- Dar ekran düzeni, klavye odağı ve hareketi azaltma tercihleri için ek kurallar.
- `qa/v25-layout.test.mjs` veri kalitesinin yeni merkezi tema yaklaşımına uyacak şekilde güncellendi; ayrıca `qa/v30-theme.test.mjs` eklendi.

## Dağıtım

ZIP içindeki **dosyaları ve klasörleri** projenin GitHub kök dizinine yükleyin; ZIP'i klasör olarak koymayın. Çalışan canlı sürümü silmeden, önce ayrı bir Vercel Preview dağıtımında inceleyin. Tarayıcı önbelleği nedeniyle eski CSS görünüyorsa yeni dağıtımı açıp sert yenileme yapın.

## Doğrulama sınırı

Temanın statik görsel önizlemesi oluşturuldu ve 42 odaklı Node testi geçti. 28 TypeScript/TSX dosyasında sözdizimi hatası bulunmadı. Ortamda proje `node_modules` bulunmadığından **tam Next.js/Vercel derlemesi ve çalışan React uygulamasının gerçek tarayıcı görüntüsü doğrulanmış değildir**. Temanın statik önizlemesi, gerçek rapor verisi içermez.
