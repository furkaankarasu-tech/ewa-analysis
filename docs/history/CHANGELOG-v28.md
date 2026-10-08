# EWA Radar v28: öneri kartları ve çeviri sunumu

Temel: v27. v20'nin `app/globals.css` dosyası değiştirilmedi. Bu sürüm evrensel
Türkçe çeviri yaptığını **iddia etmez**. Tarayıcı yerel Translator API özelliği
veya onaylanmış tam ifadeler yoksa yeni İngilizce SAP metinlerini otomatik
olarak Türkçeye çevirecek bir model henüz pakete dahil değildir.

- Uzun SAP kaynak metinleri iki sütunlu kartları kaplamak yerine `<details>`
  altında isteğe bağlı açılır. Kısa özgün İngilizce çevirinin altındadır.
- Yanıltıcı "çeviri hazır değil" etiketleri her kartta gösterilmez.
- Kaynaktan açıkça doğrulanabilen sınırlı konularda **tam çeviri değil** etiketiyle
  kısa Türkçe özet; diğerlerinde doğrulanmamış Türkçe çeviri uydurulmaz.
- Gönderilen görüntülerdeki RTCCTOOL/ST-A/PI/ST-PI, acil sürüm yükseltme,
  SYSTEM kullanıcısı ve TLS konuları için kaynak temelli metin desteği eklendi.
- Rapor SID'leri sabitlenmeden, bilinen SAP bölüm başlıklarının Türkçe
  gösterimi iyileştirildi; özgün kaynak yolu title/rapor verisinde korunuyor.
- Radar'ın ürettiği büyük tablo bulgu başlığı "Bölümlendirilmemiş büyük tablolar".
- Yerel Translator API kısmen İngilizce döndürürse yanlış Türkçe diye gösterme
  olasılığı azaltıldı. Bu dil denetimi tam doğruluk garantisi değildir.

## Gerçek sınırlar

- Herhangi bir yeni SAP önerisinin tamamını güvenilir Türkçeye çevirmek için
  gerçek cihaz-üzeri çeviri modeli ve terminoloji/ölçüm doğrulama katmanı gerekir.
  Mevcut paket bu modeli içermiyor; hiç bir rapor içeriğini dışarı göndermez.
- Raporlardan örnek giriş dosyaları pakette olmadığından bütün gerçek EWA çeşitleri
  üzerinde uçtan uca görsel/doğruluk testi yapılamadı. Önizlemeler temsilidir.
- `npm install --offline` gereken bağımlılıklar cache'te olmadığı için
  ENOTCACHED ile durdu: tam `pnpm run build:vercel` henüz doğrulanmadı.

## Kontroller

`node --no-warnings --experimental-strip-types --test qa/v28-recommendations.test.mjs qa/v27-all-findings.test.mjs qa/v26-terminology.test.mjs qa/v25-layout.test.mjs qa/typecheck-optional-fields.mjs`

Ayrıca `tsc` ile yeni sunum/çeviri/terminoloji modülleri ayrı ayrı tip kontrolünden
geçirildi. Tarayıcıda temsili HTML ile masaüstü ve mobil iki sütun / tek sütun
ve İngilizce metni açma davranışı test edildi. Önizleme tam uygulama değildir.
