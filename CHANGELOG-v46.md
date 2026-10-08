# v46 · Ekran görüntüsündeki eksik çeviriler

- “Consider updating to the latest SP Stack Kernel” önerisi Türkçe görünümde çevrilir. SAP Note numaraları kaynak metinden alınır; boşluk ve virgül farkları desteklenir.
- DATA ADMIN önerisi SYSTEM ve _SYS_REPO istisnaları korunarak çevrilir; kaynakta geçen “und” ve “and” bağlaçları desteklenir.
- Software Configuration for [SID], SAP HANA Database [SID], Newer SP Stack Kernel Available ve DATA ADMIN bölüm başlıklarının Türkçe karşılıkları eklendi.
- İngilizce kaynak ilk görünümde korunur. Türkçeyi göster seçildiğinde bu karşılıklar kullanılır.

Doğrulama: 91 otomatik test ve Next.js/TypeScript üretim derlemesi geçti. Yeni testler ekran görüntüsündeki iki metni, farklı Note numaralarını, hesap istisnalarını, başlık yollarını ve kaynak/Türkçe görünüm seçimini kapsar.

Sınır: Bu değişiklikler genel amaçlı bir çeviri motoru değildir. Tanınmayan diğer SAP ifadeleri özgün dilinde kalabilir. Ekran görüntüsünün ait olduğu CAP rapor dosyası bu turda yoktu; bu örnekler metin düzeyinde ve gerçek sunum yardımcılarıyla test edildi. Canlı Vercel sitesine yayın yapılmadı.
