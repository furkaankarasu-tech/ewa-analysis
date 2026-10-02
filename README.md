# EWA Radar v25 · İlk tasarımın geri yüklenmesi

Bu sürüm, kullanıcının verdiği **v20 RAR arşivindeki ana `app/globals.css` dosyasını bayt düzeyinde geri yükler.** Türkçe-İngilizce kartlar için küçük eklemeler, ana tasarımı değiştirmemeleri amacıyla `app/bilingual.css` içine ayrıldı.

Önceki dağıtımın ekran görüntüsünde stilini yitiren **Veri kalitesi** paneli için `app/page.tsx` içinde eski renk ve ölçülere uygun yedek stiller de tanımlandı. Amaç, bu bölümün yayınlanan global CSS ile bir eşleşme sorunu yaşasa bile kart ve kontrol ızgarası olarak görünmesidir. Uygulamanın kendi analiz ve çeviri modülleri v24 ile aynı kalır. `data-style-revision="v25"` etiketi bu paneldeki yeni kodun yayında olduğunu tarayıcı geliştirici araçlarından kontrol etmek içindir.

## Yükleme

ZIP'i açın; **içindeki klasörleri ve dosyaları**, GitHub deposunun köküne yükleyin. ZIP'i tek dosya olarak yüklemeyin. `package.json`, `app/`, `lib/`, `public/` ve `vercel.json` kökte durmalıdır.

Vercel ayarlarında framework **Next.js**, Root Directory **depo kökü**, Output Directory **varsayılan** kalmalıdır. Derleme komutu `pnpm run build:vercel` olarak ayarlanmıştır.

## Kontroller ve sınırlar

- `NODE_OPTIONS=--experimental-strip-types node --test qa/typecheck-optional-fields.mjs qa/v25-layout.test.mjs` ile odaklı testler çalıştırılabilir.
- Orijinal v20 CSS dosyasının SHA-256 özeti: `df552e88858be2ef148bda74c5650ac7fce6bccbd0593517a407b0a837628297`.
- Statik HTML örneği masaüstü ve dar ekran Chromium ile görsel olarak kontrol edildi. Bu önizleme, uygulamanın gerçek EWA dosyasıyla uçtan uca testi yerine geçmez.
- Ortamda Next.js bağımlılıkları indirilemediği için tam Vercel/Next.js build doğrulanamadı. Vercel'de `pnpm run build:vercel` sonucunu ayrıca kontrol edin.
- İngilizce SAP kaynağı korunur. Doğrulanmış Türkçe çeviri veya tarayıcıdaki yerel çeviri özelliği yoksa özgün İngilizce gösterilir; yeni bir harici API kullanılmaz.

Değişiklik ayrıntıları: `CHANGELOG-v25.md`.
