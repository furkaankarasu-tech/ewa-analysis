# v44 · Sistem metrikleri, parametreler ve terminoloji

- Küçük metrik satırları okunabilir kartlara dönüştürüldü. Değerler büyütüldü; uzun metinler satıra sığdırılıyor ve tüm metrikler açılır alan olmadan gösteriliyor.
- Oranı bulunmayan ölçümlerde boş çubuk kaldırıldı. Gerçek oranlar nötr renkli çubukla gösteriliyor; renklerden risk seviyesi çıkarılmıyor.
- ABAP kısa döküm çevirisi yerine ABAP dump terimi kullanılıyor.
- HANA parametreleri karşılaştırma tablosuna alındı: parametre, dosya/bölüm, mevcut değer, raporda önerilen değer, SAP Note, EWA referansı.
- Sıfır, negatif değer, eksik değer ve aralık ifadeleri korunuyor; birbirinin aynısı olan parametre satırları ekran ve Excel'de tekilleştiriliyor.
- EWA maddesi yalnızca parametre ve konumla tek bir kaynak bölüm eşleşiyorsa gösteriliyor. Belirsiz eşleşmede madde uydurulmuyor.

Doğrulama: 87 otomatik test geçti. TypeScript ve Next.js üretim derlemesi başarılı. Testler terminoloji, çeviri davranışı, kaynak referansı, Markdown, XLSX içeriği ve gerçek metrik bileşeninin ürettiği HTML'yi kapsar.

Sınırlar: Canlı sitenin açılış ekranı kontrol edildi. Yeni yerel görünümün tarayıcı kontrolü ortamın localhost erişimini engellemesi nedeniyle tamamlanamadı. Bu turda gerçek EWA dosyası bulunmadığından gerçek raporla uçtan uca analiz doğrulanmadı. Vercel'e yayın yapılmadı.
