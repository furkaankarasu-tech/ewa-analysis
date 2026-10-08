# EWA Radar v51

SAP EarlyWatch Alert ve bakım raporlarını tarayıcıda inceleyen Next.js / TypeScript uygulaması.

## Kurulum

Node.js 22.13 veya üzeri kullanın.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm test:offline
pnpm lint
pnpm build:vercel
pnpm dev
```

GitHub / Vercel kurulumu için README-GITHUB-VERCEL.md dosyasını inceleyin. Bu ZIP dağıtıma hazır kaynak koddur; ZIP'in hazırlanması mevcut Vercel sitesini güncellemez.

## Dil ve kaynak doğruluğu

Özgün rapor metni varsayılan olarak gösterilir. “Türkçeyi göster” incelenmiş SAP karşılıklarını ve destekleniyorsa tarayıcının yerel çeviricisini kullanır. İlk tıklamada dil paketi indirilebilir. Eksik metinler için “Bağımsız yerel modelle çevir” seçeneği yaklaşık 540 MB modeli indirir ve cihazda çalıştırır. Rapor metni çeviri sunucusuna gönderilmez. Kullanım ve model atıfları: docs/LOCAL-MODEL.md.

Her olası İngilizce cümle için çevrimdışı çeviri garantisi yoktur. Karşılığı bulunmayan veya teknik doğrulamadan geçmeyen metin İngilizce kalır. Eksik çeviriler yeniden denenebilir. Rapor sayıları, SAP Note numaraları, parametre yolları, SQL nesneleri ve teknik terimler korunur. dump ve partitioning terimleri zorla Türkçeleştirilmez.

Excel'de seçili dildeki SAP önerisi ile özgün İngilizce ayrı sütunlardadır. SQL, parametreler ve diğer ayrıntılar raporda güvenilir veri bulunduğunda ayrı sayfalara yazılır. Rapor kaynağı olmayan değerler doldurulmaz.

## Doğrulama

133 otomatik test, ESLint (0 hata, 1 mevcut görsel optimizasyon uyarısı) ve üretim derlemesi geçti. Üç gerçek S4P Word XML raporunda kaynak seviyesi → bulgu → Excel / Markdown tutarlılığı doğrulandı. Bu sürüm canlı Vercel sitesine yayınlanmadı; v51 görsel tarayıcı testi tamamlanmadı.

EWA renkleri yalnızca doğrulanan kaynak bölümünden veya birebir eşleşen alarmdan alınır. Renk okunamıyorsa “Seviye okunamadı” gösterilir. Raporun kırmızı olma nedenleri, alarm özeti ve SAP önerileri farklı kapsamlardır; sayıları birbirine eklenmez.

Detaylar CHANGELOG-v51.md ve docs/v51-verification.md dosyalarında. Özel rapor PDF'leri pakete dahil değildir.
