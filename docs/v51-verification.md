# v51 kontrol kaydı — 8 Ekim 2026

## Canlı v50 üzerinde gözlenenler

https://ewa-analysis.vercel.app/ açıldı, gerçek S4P Word XML raporu yüklendi ve analiz tamamlandı. Bulgu araması, SAP önerileri, alarm kayıtları, SQL ve parametre tabloları incelendi.

RTCCTOOL kaynağı ve SAP önerisi kırmızı iken bulgu kartının YÜKSEK olduğu doğrulandı. Aynı kartta kontrolün kırmızı olduğu yazıyordu. Kaynak kodunda seviye sabit `yuksek` atanmıştı.

Canlı sitedeki Excel indir düğmesiyle dosya indirildi ve arşiv içindeki XML sayfaları okundu. Boş değildi. Başlıklar dahil satır sayıları: aksiyon 25, SAP önerileri 29, yoğun SQL 26, HANA parametreleri 18, destek takvimi 14, komponent farkları 31.

Türkçe görünümde 57 metnin 21'i hazırdı. Tarayıcının yerleşik çeviricisi başlatılamadı; hata ve bağımsız yerel model seçeneği görünür kaldı. Daha sonraki canlı çeviri kontrolü tarayıcı araç oturumunda zaman aşımına uğradı. Bu durum uygulamanın tüm kullanıcılar için donduğunu kanıtlamaz; bu kontrol başarılı sayılmadı.

## v51 kaynak kodunda geçen kontroller

- `pnpm test:offline`: 133 test başarılı, 0 başarısız.
- `pnpm lint`: 0 hata; logo img öğesinde mevcut 1 Next.js optimizasyon uyarısı.
- `pnpm build`: TypeScript ve Webpack üretim derlemesi başarılı.
- Üç gerçek S4P Word XML raporunda XML ve gömülü ikonlar yerel test adaptörüyle çözüldü. Aksiyonların kaynak renkleri, RTCCTOOL önerisi/bulgusu uyumu, XLSX satır sayıları ve Markdown etiketleri karşılaştırıldı.

| Rapor dönemi | Bulgu | Kırmızı | Sarı | Seviye okunamadı | Alarm | Kırmızı rapor nedeni | SAP önerisi | Excel aksiyon satırı |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 02.06.2025–08.06.2025 | 21 | 8 | 4 | 9 | 20 | 1 | 25 | 21 |
| 08.12.2025–14.12.2025 | 23 | 9 | 6 | 8 | 19 | 1 | 24 | 23 |
| 31.08.2026–06.09.2026 | 29 | 10 | 6 | 11 | 15 | 2 | 22 | 29 |

Son raporda ayrıca 2 yeşil kaynaklı kayıt vardır. Kırmızı/sarı bilinmeyenlerin toplamından genel rapor rengi hesaplanmaz; raporun kendi sonucu korunur. Alarm ve öneri sayıları bulgu sayısına eklenmez. Bunlar farklı kayıt türleridir.

## Sınırlar

v51 mevcut Vercel dağıtımına yayınlanmadı. Bu sürümün görsel tarayıcı testi ve bağımsız modelin tarayıcı WASM testi tamamlanmadı. Kaynak/Excel entegrasyon testleri tam canlı tarayıcı testi gibi sunulmaz. Önceki model kontrolleri docs/v50-verification.md içindedir; bu sürümde ağırlıklar veya tokenizer değiştirilmedi.

Bu kontroller her EWA formatının eksiksiz okunacağını veya her makine çevirisinin doğru olacağını kanıtlamaz. Görsellerde kullanılan rapor dosyasının tam sürümü bilinmediğinden, görseldeki 14 alarm/23 önerinin birebir aynı rapor dosyası olduğu iddia edilmez. Üç ayrı raporla ortak seviye hatası yeniden üretildi ve düzeltildi.

Tekrar çalıştırma:

```sh
pnpm install --frozen-lockfile
pnpm test:offline
pnpm lint
pnpm build
node --experimental-strip-types qa/v51-real-word.mjs /path/to/S4P-report.doc
```

Son komut özel rapor dosyasını yerel olarak okur, dışarı göndermez. Gerçek raporlar, analiz JSON'ları ve indirilen Excel dosyaları ZIP'e dahil değildir.
