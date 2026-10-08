# EWA Radar v31 · Focus tema

**Kapsam: Görünüm ve sayfa yerleşimi.** `lib/` altındaki analiz, dosya okuma, SAP terminolojisi ve cihaz içi çeviri kodları v30 ile birebir aynıdır.

- Büyük koyu yan menü kaldırıldı; rapor yükleme, bulgular, KPI ve varsa SAP önerileri üst menüden erişiliyor.
- Rapor yüklenmeden önce sade giriş ekranı; rapor açıldıktan sonra küçülen dosya yükleme alanı.
- KPI kartları bölümlü tek bir yüzeyde toplandı; kritik bulgular daha okunaklı ve daha az renkli.
- Veri kalitesi alanı ayrı bir panel; tablolar, SAP önerileri ve kanıt katmanı korunuyor.
- Dar ekranlarda üst menü yatay gezinmeye geçiyor ve eksik istatistik kartı boş alan bırakmıyor.
- Rapor yokken aynı yükleme çağrısının iki kere gösterilmesi kaldırıldı.

## Testler

`node --experimental-strip-types --test qa/v25-layout.test.mjs qa/v26-terminology.test.mjs qa/v27-all-findings.test.mjs qa/v28-recommendations.test.mjs qa/v29-translation.test.mjs qa/typecheck-optional-fields.mjs qa/v31-theme.test.mjs` ile kaynağın kendi testleri, TypeScript JSX sözdizimi kontrolü ve tarayıcıda oluşturulan masaüstü/mobil temsili HTML görünümü kontrol edildi. **Tam Next.js / Vercel derlemesi bu ortamda çalıştırılamadı**; production deploy öncesinde Preview önerilir.

Ekran görüntüleri temsili verilerle hazırlanmıştır, gerçek rapor işleme testinin yerini tutmaz.
