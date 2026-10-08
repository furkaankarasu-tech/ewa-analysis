# v27 · Bulgu geneli Türkçe ve tutarlı görünüm

- Eski v20 ana tema aynen korundu. Sayfa ızgaraları, KPI alanı, öneri kartlarının iki sütunlu düzeni ve veri kalitesi kartı değiştirilmedi.
- Sadece tek bir partisyonlama ifadesi yerine HANA, SQL, CPU, yedekleme, ABAP, güvenlik, Gateway, kernel, Java, bakım ve transport başlıklarını kapsayan ortak SAP teknik terminoloji katmanı eklendi.
- Başlıklar tam ifade/kaynak yolu üzerinden işleniyor. Bilinmeyen özel SAP veya müşteri ifadelerinin anlamı tahmin edilmiyor.
- Açıklama, etki, neden ve öneriler aynı iki dilli kart bileşeninde gösteriliyor. Gerçek SAP İngilizcesi ile uygulamanın kendi ürettiği Türkçe açıklama karıştırılmıyor.
- Kaynak bölüm yollarında bilinen adlar Türkçe gösteriliyor, özgün İngilizce yol `title` ve kanıt ayrıntısında kalıyor.
- Excel, e-posta ve Markdown indirmelerinde ekranda hazır olan çeviriler kullanılıyor; Türkçe üretilmiş metindeki SAP terimleri de tutarlı hale getiriliyor.
- Kullanılan sayılar veya korunması gereken SAP teknik terimleri değişiyorsa cihazın çeviri çıktısı reddedilip gerçek İngilizce kaynak gösteriliyor.
- Tamamen yeni bir rapor cümlesi için yerel tarayıcı çevirisi yoksa güvenilir, eksiksiz Türkçe üretildiği iddia edilmez. Genel amaçlı tüm serbest EWA metinlerinin çevrilmesi için ayrıca yerel model gereklidir.

## Kontroller

`npm run test:offline` (bağımlılıkların kurulu olması gerekir). TypeScript modüllerinde hedefli `tsc` kontrolü ayrıca yapılmıştır. Tam `next build` Vercel derlemesi bu çalışma ortamında eksik npm bağımlılıkları yüzünden doğrulanamadı.
