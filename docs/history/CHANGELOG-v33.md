# EWA Radar v33 — Sağ panel grafik ve veri kalitesi düzenlemesi

Bu sürüm, v32.1 Vercel kurulum düzeltmesini temel alır. Analiz motoru, rapor parser'ları, yerel çeviri ve dışa aktarma işlevleri değiştirilmemiştir.

## Görsel düzen
- Sağ sütuna sıcak bej temayla uyumlu, kompakt **Sistem metrikleri** paneli eklendi. Rapordan okunan beş metrik önce gösterilir, varsa kalanlar **Diğer metrikleri göster** bölümünde açılır.
- Yalnızca rapordaki açık yüzde veya aynı birimde karşılaştırılabilir kullanımı/sınırı olan ölçümlerde orantılı doluluk çubuğu kullanılır. SQL toplam süre ve DB büyüklüğü gibi mutlak değerlerde uydurma yüzde çizilmez.
- **Bölüm kapsamı** halka grafiği, gerçek rapordaki bölümlerden içeriği eşleşenlerle sadece başlığı eşleşenleri ayırır. Başlık bulunması, tüm içeriğin başarıyla çözümlendiği anlamına gelmez.
- Sağ sütuna **Veri kalitesi** özet kartı eklendi. Üzerindeki bağlantı, mevcut ayrıntılı kontrollerin bulunduğu panele gider. Ayrıntılı panel bulguların altına taşındı.
- Diğer analiz, SAP öneri, yazılım bileşenleri, SQL, dışa aktarma ve çoklu rapor işlevleri korunmuştur.

## Doğrulama
- `npm run test:offline` ile 54 test geçti.
- 31 TypeScript dosyasının parser kontrolü ve üç CSS dosyasının PostCSS ayrıştırması hatasızdı.
- Bu ortamda registry DNS erişimi olmadığı için tam `pnpm run build:vercel` burada çalıştırılamadı. Üretim öncesi Vercel Preview derlemesi gerekir.
