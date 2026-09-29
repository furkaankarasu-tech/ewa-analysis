# EWA Radar

SAP EarlyWatch Alert raporlarını tarayıcıda incelemek için çalışma alanı. PDF, DOCX, SAP Word XML biçimindeki `.doc` ve SAP HTML `.htm/.html` raporlarını okur. Aylık bakım DOCX raporları için ayrı bir akış bulunur.

## Çalıştırma

Node.js 22.13 veya daha yeni sürüm gerekir.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

Komutun gösterdiği yerel adresi açın. `pnpm run build:vercel` Vercel için Next.js derlemesini doğrular. `public/pdf.worker.min.mjs` yerel PDF işçisi olarak pakete dahildir.

Yeni kanıt, veri kalitesi ve çoklu sistem kontrollerini çalıştırmak için `node --test --experimental-strip-types qa/features.test.mjs` komutunu kullanın.

## GitHub'a yükleme

Kaynak ZIP dosyasını açın. GitHub'da boş bir depo oluşturun; ZIP dosyasını tek dosya olarak yüklemek yerine açılmış klasörün **içeriğini** depoya gönderin. Terminalden:

```bash
git init
git add .
git commit -m "EWA Radar"
git branch -M main
git remote add origin https://github.com/KULLANICI/DEPO.git
git push -u origin main
```

GitHub adresindeki `KULLANICI/DEPO` bölümünü kendi adresinizle değiştirin. `.gitignore` dosyası bağımlılıkları ve yerel ayarları dışarıda bırakır. Gerçek müşteri EWA dosyalarını depoya eklemeyin. Verilen GitHub ZIP'i gereksiz başlangıç bileşenleri çıkarılmış sade bir pakettir; ZIP'in içinde dosyalar doğrudan köktedir.

## Vercel'e yayınlama

GitHub deposunu Vercel'e içe aktarın. **Settings → Build and Deployment → Root Directory** alanı boş (depo kökü) olmalı. GitHub'da `package.json`, `vercel.json` ve `app/` ilk seviyede yan yana görünmelidir. `package.json` içinde `next` bağımlılığı bulunur. Vercel'de framework **Next.js** seçin. Depodaki `vercel.json`, Vercel derlemesini `pnpm run build:vercel` ile çalıştırır; böylece Sites için olan Vite/Cloudflare komutu Vercel'de kullanılmaz. Output Directory ayarını ayrıca değiştirmeyin. Kurulumdan sonra rapor yükleme, PDF işçisi ve analiz akışını tarayıcıda deneyin. Eski build override veya Root Directory ayarı varsa düzeltip yeniden yayınlayın. `No Next.js version detected` hatası genellikle Vercel'in `package.json` dosyasının bulunduğu klasöre bakmadığını gösterir; ZIP'i tek dosya olarak depoya yüklediyseniz içeriğini çıkarıp köke yükleyin.

## Analiz sınırları

- Dosyalar tarayıcıda işlenir; bu uygulamanın sunucusuna rapor yüklenmez. Hazır mail metni kopyalanır, kendiliğinden gönderilmez.
- Aynı seçimde en fazla 12 rapor incelenebilir. Sistem özeti, aynı SID için tarihli en güncel EWA'yı sayar; eski dönemleri seçilebilir tutar. SID okunamadığında iki dosya aynı sistemmiş gibi birleştirilmez. Raporlar yalnızca açık sekmenin belleğinde durur.
- Her bulgunun **Bu sonuca neden vardık?** alanı, doğrulanmış EWA madde ve sayfasını, rapordaki bölüm rengini, kanıtla eşleşirse ham ifade ve tablo satırını gösterir. Ham satır eşleşmezse bu durum açıkça belirtilir; değer veya numara üretilmez. Veri kalitesi paneli belirsiz alarm renklerini, eşleşmeyen maddeleri ve okunamayan SQL tablolarını ayrı gösterir. Metni çıkarılamayan taranmış PDF'ler için OCR uyarısı verilir.
- **Excel indir** düğmesi, aksiyon listesinin yanında **yalnızca raporda verisi bulunan** ayrıntı sekmelerini oluşturur: Rapordaki Top SQL, Yoğun SQL (HANA hash ölçümleri), SQL yükü, SQL Server yükü, HANA parametreleri, Destek takvimi ve Komponent farkları. Boş SQL/parametre sekmeleri eklenmez. Java EWA PDF'lerindeki `Top SQL Statements` satırları SQL metni, sırası, yanıt süreleri, çalıştırma sayısı ve gerçek madde/sayfa referansıyla ayrı sekmede görünür; rapor SQL'i kısaltmışsa belirtilir. SQL Server raporundaki pahalı sorgu nesneleri, metni raporda bulunmayan SQL sorgusu diye sunulmadan, mantıksal okuma/CPU/süre ölçümleriyle ayrı sekmededir. Satırlara bölünmüş HANA statement hash değerleri doğrulanıp ölçümleriyle birleştirilir. Bu listelerdeki sıfır saniye veya en üst sıra tek başına arıza diye yorumlanmaz. SQL ölçüm grupları ayrı kalır; raporda olmayan değerler üretilmez. EWA maddesi rapordaki gerçek bölüm numarası ve başlığıyla (örneğin `Madde 9.4.4 · Top SQL Statements`) gösterilir; kaynak PDF sayfası bulunursa eklenir. Eşleşme doğrulanamazsa numara uydurulmaz. Aynı referans bulgu kartında ve Markdown çıktısında da yer alır. Sarı alanlarda durum, sorumlu, aksiyon notu ve tarih alanları güncellenebilir. Aylık bakım raporunda yalnızca aksiyon listesi sekmesi bulunur.
- SQL ve HANA parametreleri ekranda satır kartları halinde gösterilir; geniş bir tablo için yatay kaydırma gerekmez. Komponent ve destek tabloları dar ekranda kart düzenine geçer.
- Bu sürüm dışarıdan bir yapay zeka API'si çağırmaz ve yüklenen raporlardan kendiliğinden model eğitmez. Belgelerin bölüm ve tablo yapısı, metin kanıtı ve yerel kontroller kullanılır.
- Öncelikli bulgular ve SAP önerilerindeki İngilizce metinler, destekleyen tarayıcıda rapor seçimiyle otomatik olarak ve gerektiğinde **Türkçeye çevir** düğmesiyle cihaz üstünde çevrilir. İlk kullanım dil paketi indirebilir. Bu özellik tarayıcıda bulunmuyorsa özgün İngilizce metin gösterilir. Çeviri kalite kontrolünün yerini almaz; kartlarda özgün metin açılabilir, tam Markdown çıktısında da korunur. Harici ücretli çeviri API'si kullanılmaz.
- SAP önerileri kritik ikon, sarı ikon ve diğer kayıtlar olarak filtrelenebilir; kaynak ve öneri metninde arama yapılabilir. Filtre yalnızca ekrandaki görünümü etkiler, Markdown ve mail metni tam analizden üretilir.
- Word XML içindeki alarm ikonları, HTML raporlarındaki `alt` açıklamaları okunur. PDF'deki `Rating Check` satırının kırmızı/sarı/yeşil ikonu yalnızca ilgili satırın küçük görsel alanından doğrulanır; belirsiz renk için derece uydurulmaz. Örneğin URP madde 4.2'deki kırmızı güvenlik bakım ikonu, ilgili bulguyu kritik yapar. PDF ve DOCX görsel grafikleri sayısal tablodan ayrıysa eğrinin değeri uydurulmaz.
- Kırmızı EWA ikonu kritik kabul edilir. Rapordaki açık SAP Recommendations metinleri ayrıca kaynak bölümle listelenir; tek başına öneri görülmesi sorun bulunduğu anlamına gelmez. Mailde başlıca diğer öneriler yer alır, tam liste analiz ekranı ve Markdown çıktısındadır.
- Rapordaki tarihler raporun analiz bitişine göre yorumlanır. Güncel destek ve patch durumu uygulama öncesi üretici kaynaklarından doğrulanmalıdır.
- Yeni EWA yapıları için güvenli geliştirme döngüsü: farklı biçimden örnek, beklenen SID/dönem/rating ve 3-5 doğrulanmış bulgu, otomatik çıktı ile fark analizi, ayrıştırıcı düzeltmesi, eski örneklerle tekrar doğrulama. Örnekler kaynak depoya konmaz.

## Kod düzeni

`lib/ewa.ts` ana analiz, `lib/html-ewa.ts` güvenli HTML ayrıştırma, `lib/report-structure.ts` bölüm/tablo yapısı, `lib/section-reference.ts` bulgu ve numaralı bölüm eşleştirmesi, `lib/report-insights.ts` kanıta dayalı bulgular, `lib/ewa-detail.ts` komponent ve HANA SQL, `lib/sql-load.ts` veritabanı SQL yükü, `lib/top-sql.ts` Top SQL hücreleri, `lib/lifecycle.ts` destek tarihleri, `lib/pdf-layout.ts` PDF tablo düzeni, `lib/pdf-ratings.ts` PDF derece ikonları, `lib/excel-export.ts` Excel aksiyon listesi. Arayüz `app/page.tsx` içindedir.
