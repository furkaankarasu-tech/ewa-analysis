# v43 · Çeviri durumu ve çıktı tutarlılığı

- Çalışan bir çeviri işlemi olmadığı halde görünen “Türkçe çeviri bekleniyor” etiketi kaldırıldı. Türkçe karşılık yoksa özgün SAP metni açıkça belirtiliyor.
- İlk açılışta kaynak metin gösteriliyor; çeviri kontrolü yapıldığı izlenimi verilmiyor. Çeviri kapsamı yalnızca Türkçe görünüm seçiliyken gösteriliyor.
- SAP yazılımının güncel olmaması / SAP Security Notes desteği ve ABAP number ranges kullanımına ait iki eksik karşılık eklendi. Belirgin kullanım, tükenme olarak yorumlanmıyor.
- Bulgu kanıtlarında da aynı doğrulanmış çeviri sözlüğü kullanılıyor.
- Markdown alarm ve özet listeleri seçilen çeviriyi kullanıyor ve özgün SAP metnini koruyor.
- Excel kaynak sütununda, bölüm eşleşmesi olmayan bulgular için de Alert Overview içindeki özgün alarm metni korunuyor.

Doğrulama: 14 çevrimdışı test dosyası geçti. Testler ekran görüntüsündeki metinleri, kaynak görünümünü, Türkçe görünümünü, Markdown çıktısını ve üretilen XLSX içeriğini kapsıyor. TypeScript kontrolü ve Next.js üretim derlemesi başarıyla tamamlandı.

Sınır: Bu sürümde gerçek kullanıcı EWA belgesiyle uçtan uca doğrulama yapılmadı; testler kontrollü rapor verilerini kullanıyor. Paket canlı Vercel sitesine otomatik yayımlanmadı. Preview ortamında gerçek raporla kontrol edilmelidir.
