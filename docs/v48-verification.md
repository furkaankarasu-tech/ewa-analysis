# v48 doğrulama — 7 Ekim 2026

## Otomatik doğrulama

- `pnpm install --frozen-lockfile`: başarılı; bağımlılık sürümleri değiştirilmedi.
- `pnpm test:offline`: 99/99 geçti.
- `pnpm lint`: geçti.
- `pnpm build`: TypeScript kontrolü ve Next.js üretim derlemesi geçti.
- `qa/v48-real-pdf.mjs <CEP PDF>`: geçti. Kullanıcı PDF'si dağıtılmaz.

Yeni testler: teknik tanımlayıcıların korunması; geçerli ham çevirinin kabulü; yarım çevirinin reddi; cümle birleştirme; zaman aşımı; dil seçimine uyan etiketler; PDF alarm bitişi; dört satırdan uzun öneri; Excel'de Türkçe ve özgün metnin birlikte korunması.

## Gerçek PDF doğrulaması

CEP: dönem 18.07.2022–24.07.2022, 25 ABAP dump; bağımsız pdftotext çıktısıyla karşılaştırıldı. Uygulama 8 bulgu, 10 SQL Server satırı ve 10 öneri üretti. Düzeltilen alarm listesi 10 kayıt içeriyor; rapor bağlantısı açıklamaları çıkarıldı, renkler belirsiz olarak kaldı.

Uzun Support Package ve Message Server önerilerinin son cümlelerinin artık eksiksiz alındığı doğrulandı. 10 önerinin tamamı incelenmiş karşılıklarla çevrildi. Bu, diğer tüm bulgu/kanıt alanları veya bilinmeyen raporlar için tam çeviri garantisi değildir.

Yeni Excel ZIP/XML içeriğinde 8 aksiyon, SQL nesneleri, EWA referansı ve seçilen Türkçe öneri / İngilizce kaynak kontrol edildi. Markdown seçili öneri çevirisini içeriyor.

## Canlı site (dağıtım öncesi mevcut sürüm)

https://ewa-analysis.vercel.app/ adresinde CEP PDF yükleme, analiz, Türkçe düğmesi ve Excel indirme çalıştırıldı. Mevcut sürüm 6/32 Türkçe metin gösterdi; tarayıcıda hazır İngilizce–Türkçe çeviri olmadığı mesajı görüldü. Canlı Excel dosyası açıldı: Aksiyon listesi, SAP önerileri, SQL Server yükü, Destek takvimi ve Komponent farkları sayfaları mevcut; 8 aksiyon ve 10 SQL kaydı boş değildi.

## Sınırlar

v48 canlıya dağıtılmadı. Yerel sunucu başlatıldı, ancak uzaktaki tarayıcı localhost:3000 için ERR_CONNECTION_REFUSED verdi; yeni arayüzün görsel/uçtan uca tarayıcı testi tamamlanamadı. Yerel Translator API gerçek motorla doğrulanamadı; başarı, bozulmuş metin ve zaman aşımı durumları kontrollü testlerle doğrulandı. Node PDF okuyucusu standart font yolu uyarısı verdi; analiz ve karşılaştırmalar tamamlandı. Tüm EWA sürümlerinin ve dosya düzenlerinin doğrulandığı iddia edilmez.
