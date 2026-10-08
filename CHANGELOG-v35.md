# v35 Nightfall · Yerleşim onarımı

Bu sürüm v34'ün mevcut analiz, SAP kaynak okuma, KPI, çeviri, Excel ve Markdown mantığını değiştirmeden ekran düzenini onarır.

- Başlık alanındaki mimari görselin yanlış katmanlamadan dolayı kaybolması düzeltildi.
- Dar ekranlarda birbirinin üzerine gelen iki menü kaldırıldı; klavye ile kullanılabilen tek açılır mobil menü eklendi.
- Bulgu ve KPI yazıları okunabilir hale getirildi; kart boşlukları ve mobil genişlikler düzeltildi.
- Gerçek geçmiş verisi olmadan trend izlenimi veren süs amaçlı çubuklar gizlendi.
- Masaüstü/telefon için statik tasarım önizlemesi yenilendi; örnek veri etiketi kartların üzerine binmez.
- Mobil menüde bir bölüme tıklandığında menü otomatik kapanır.

## Doğrulama sınırları

Çevrimdışı testler, değiştirilen TS/TSX dosyalarının sözdizimi, stil dosyası ayrıştırması ve statik önizlemenin farklı ekran boyutları kontrol edilmiştir. Tam Next.js/Vercel derlemesi bağımlılık kayıt sunucusuna erişim olmadığından **çalıştırılamadı**. Üretim verileriyle ekran testi yerine açıkça etiketli örnek önizleme kullanılmıştır.
