# EWA Radar v32.1 — Vercel pnpm install düzeltmesi

Bu paket, önceki **v32 Editorial** tasarımının ve analiz motorunun tamamını korur. Değişiklik yalnızca `pnpm-workspace.yaml` içindeki iki paket izni ve bu düzeltmeyi doğrulayan testtir.

## Vercel'deki hata

`ERR_PNPM_IGNORED_BUILDS`: `onnxruntime-node` ve `protobufjs` kurulum betikleri için pnpm 11'de açık bir karar bulunmuyordu. Projede `strictDepBuilds: true` olduğu için yükleme duruyordu.

## Düzeltme

- `onnxruntime-node: false`: EWA Radar, genel çeviri modelini sunucuda değil tarayıcının Web Worker'ında `wasm` ile çalıştırır. Vercel'de native Node ONNX kurulumu gerekmez.
- `protobufjs: true`: Bu paketin gerekli kurulum betiğine izin verilir.
- `strictDepBuilds: true` korunur. `dangerouslyAllowAllBuilds` **etkinleştirilmez**.

## GitHub / Vercel

ZIP'i açıp **içindeki dosyaları** (dış klasörü değil) GitHub deponun köküne yükleyin. `pnpm-workspace.yaml` dosyasının da değiştiğinden emin olun. Vercel otomatik dağıtımı başlatmazsa **Deployments → Redeploy** kullanın. Node.js 22.x seçili kalsın.

Vercel kurulum komutu: `pnpm install --no-frozen-lockfile`

Vercel derleme komutu: `pnpm run build:vercel`

> Bu ortamda pnpm bağımlılıklarını indirip tam Vercel derlemesini çalıştıramadık. Bu değişiklik paylaşılan **kurulum hatasını** hedefler; tam dağıtım sonucu Vercel loglarıyla doğrulanmalıdır.
