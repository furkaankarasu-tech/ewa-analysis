# EWA Radar v38 · Bölüm, alarm ve SQL görünümü

Bu sürüm v37 kaynak kodunu temel alır. Üst menü, tema, dosya okuyucuları,
analiz motoru, önem dereceleri ve dışa aktarma mantığı değiştirilmedi.

- Raporun kendi önceliğini belirleyen maddeler ve Alert Overview için
  ayrı Türkçe alarm sunumu ve özgün İngilizce kaynak açılır alanı.
- Kullanıcı ekranında görülen yaygın EWA alarm cümleleri için denetlenmiş,
  anlamı korunmuş Türkçe karşılıklar.
- Bilinmeyen alarmlar, cihazdaki çeviriciye dahil edilir; çevrilemeyen metin
  doğrudan İngilizce kaynaktır. Türkçe uydurulmaz.
- Alarm dereceleri (kırmızı/sarı/okunamadı) rapordan geldiği gibi kalır.
- HANA SQL bölümünde beş sütunlu okunabilir tablolar; uzun statement hash,
  SQL metni, çağıran ve kaynak yalnızca satır açıldığında görünür.
- Mobil cihazlarda SQL tablo satırları dikey ölçüm görünümüne geçer.
- Alt bölüm başlıkları ve öneri kartları daha okunur hale getirildi.
- Yeni stiller `app/detail-panels.css` dosyasına ayrıldı; genel temaya
  müdahale edilmedi.

## Doğrulama

`npm run test:offline` ile v38 dahil 88 test; global TypeScript parser
kontrolünde 29 kaynak dosyasında sözdizimi hatası yok. Ayrı HTML örnek ekranı
masaüstü (1400px) ve mobil (390px) Chromium ile sınandı: yatay taşma yok,
SQL satır ayrıntısı açılıyor. Tam Next.js/Vercel dağıtımı bu ortamda
çalıştırılamadı. Gerçek raporun her SAP cümlesi için kusursuz Türkçe çeviri
garantisi yok; tanınmayanlar yerel çeviri + kaynak İngilizce ile ele alınır.
