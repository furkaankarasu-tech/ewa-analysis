# Yerel İngilizce–Türkçe çeviri

Rapor metni için harici çeviri servisi veya API anahtarı kullanılmaz. Tarayıcıya indirilen model Web Worker içinde, tek iş parçacıklı ONNX/WASM ile çalışır. Model dosyaları Hugging Face'den, çalışma zamanı statik dosyaları uygulamadan veya kütüphanenin CDN kaynağından gelebilir. Bu istekler model dosyalarını taşır; rapor metni taşımaz.

## Kullanım

1. Raporu yükleyin. İlk görünüm özgün İngilizcedir.
2. **Türkçeyi göster** ile incelenmiş SAP karşılıklarını ve destekleniyorsa tarayıcının yerel modelini kullanın. İlk kullanım dil paketi indirebilir.
3. Eksik çeviri varsa **Bağımsız yerel modelle çevir** seçeneğini kullanın. İlk indirme yaklaşık 540 MB'dir; çalışma belleği bundan fazladır. Masaüstü tarayıcı önerilir. Tarayıcı önbelleği kullanılabilir olduğunda dosyalar tekrar indirilmez; tarayıcı bunları silebilir.
4. İndirme/çeviri ilerlemesini izleyin veya **Çeviriyi durdur** ile iptal edin. Yeni rapora geçiş eski işlemi iptal eder.
5. İngilizce kaynak her zaman korunur. Çeviri teknik kontrolleri geçmezse o alan özgün kalır. Kontroller bütün anlam hatalarını yakalayamaz; model çevirisi insan incelemesi değildir.

Rapor ve çeviri metni uygulama belleğinde tutulur. **Oturumu temizle** bunları ve aktif çeviri işlemini temizler. Bu düğme indirilen genel model önbelleğini silmez. Model dosyalarını silmek için tarayıcının site verilerini temizleyebilirsiniz.

## Model ve atıf

- Özgün model: [Helsinki-NLP/opus-mt-tc-big-en-tr](https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-en-tr), OPUS-MT / Helsinki-NLP.
- ONNX dönüşümü: [onnx-community/opus-mt-tc-big-en-tr](https://huggingface.co/onnx-community/opus-mt-tc-big-en-tr).
- Sabit sürüm: `ce128ea834a090aca240e4e113e7756e06cc78e0`; q8 encoder ve merged decoder.
- Lisans: [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Model ve türetilmiş tokenizer için bu atıf korunmalıdır. Model sahiplerinin bu uygulamayı onayladığı iddia edilmez.
- İstemci: `@huggingface/transformers` 3.8.1 (Apache-2.0), ONNX Runtime (MIT).

### Tokenizer düzeltmesi

Yukarıdaki ONNX sürümünün tokenizer.json dosyasında 57.060 token alfabetik sıradaydı; modelin özgün vocab.json token numaralarıyla uyuşmuyordu (57.054 konum farklı). Bu durum modelin anlamsız çıktı üretmesine neden oluyordu. Uygulamadaki `public/models/ewa-en-tr/tokenizer.json`, aynı token ve skorları Helsinki-NLP modelinin özgün vocab.json numaralarına yeniden sıralar; unk_id 52508 olarak düzeltilir. tokenizer_config.json korunmuştur. Bu dosyalar türetilmiş model varlıklarıdır; atıfları yukarıdadır. Model ağırlıkları değiştirilmemiştir ve ZIP içinde bulunmaz.

Worker, hazır durumuna geçmeden önce sabit ve rapordan bağımsız bir test cümlesini çevirir. Test başarısızsa rapor çevirisine başlamaz.

## Doğrulama sınırları

Yerel q8 ağırlıkları gerçek çıkarımla Node CPU üzerinde test edildi. Bu, her tarayıcıda WASM performansını veya her EWA cümlesinin doğru çevrildiğini kanıtlamaz. Tarayıcı bellek, önbellek ve ağ koşulları model başlangıcını etkiler. Yerleşik Chrome çeviricisi bu test ortamında en→tr için NotSupportedError verdi; bağımsız model bu özelliğe bağımlı değildir.

Tekrar çalıştırmak için (ilk seferde yaklaşık 540 MB indirme):

```sh
node --experimental-strip-types qa/v50-model-smoke.mjs
```

Varsayılan önbellek `.model-cache` klasörüdür. İsterseniz `MODEL_CACHE_DIR` tanımlayın. Bu isteğe bağlı entegrasyon testi normal `test:offline` komutunun parçası değildir.
