# v34 · Nightfall Studio

- Seçilen koyu lacivert görsel yönüne uygun ana gezinme, hero, KPI kartları ve rapor panelleri.
- Kullanıcının seçtiği önceki mimari konsept görselinden türetilmiş yerel hero arka planı.
- Kaynak raporun bulgularında gerçek arama, öncelik filtresi, kaynak/kanıt için açılır detaylar.
- Veritabanı metrikleri ve bölüm kapsamı önceki rapora dayalı mantıkla korunur; sahte trend ve limit oluşturulmaz.
- Sorumlu alanların **mevcut rapordaki** bulgularına göre dinamik dağılım çubukları.
- `lib/finding-dashboard.ts` ve regresyon testleri; responsive ve reduced-motion stilleri.
- Önceki EWA analiz motoru, SAP kaynak metni, çeviri altyapısı, Markdown/Excel çıktıları korundu.
- Değişiklikler `app/noir-theme.css` üzerinden izole edilmiştir. Tam Vercel build kontrolü bu ortamda bağımlılık erişimi nedeniyle yapılamadı.
