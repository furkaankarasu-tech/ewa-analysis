# EWA Radar v29 – Genel çeviri akışı, SAP terminolojisi ve yerel model

## Giderilen sorunlar

- v20 ana tasarımının CSS dosyası değiştirilmedi; eski bulgu, KPI ve iki sütunlu SAP öneri kartları korunuyor.
- Otomatik çeviride kaynak SAP cümlesine yanlış anlam yükleyebilen birkaç sabit kural kaldırıldı. “The Support Package level ... run out of security maintenance” ifadesi, ürünün tüm desteğinin sona erdiği şeklinde yorumlanmıyor; mevcut Support Package seviyesinin güvenlik bakım dönemiyle ilişkilendiriliyor.
- Bölümlere ayrılmamış büyük tablolar, SAP HANA/Indexserver, SQL, güvenlik, kullanıcı, Fiori, backup, Gateway ve bileşen güncellemeleri için daha kapsamlı Türkçe terminoloji ve kaynak temelli kısa değerlendirmeler eklendi.
- Kısa Türkçe metin tam SAP çevirisi değilse bu durum açıkça belirtiliyor; özgün İngilizce SAP talimatının tamamı her zaman açılabilir. Uzun talimatlar sayfayı kaplamıyor. İki kez yazılan ve boş kalan “çeviri hazır değil” etiketleri kaldırıldı.
- İsteyen kullanıcı için gerçek genel EN→TR çeviri modeli ayrı bir **cihaz içi** Web Worker'a bağlandı. Sözlük dışı metinlerde kullanıcı yaklaşık 600 MB'lık modeli ilk kullanımda açıkça onaylayarak indirebilir. İndirilen dosyalar yalnızca model ağırlıkları ve tarayıcı çalışma ortamıdır; rapor metni model sağlayıcısına gönderilmez.
- Model çalışmasa bile ölçümler, bulgular, Excel/e-posta/Markdown çıktıları ve özgün SAP kaynakları kullanılabilir. Kullanılmış fakat başarısız tarayıcı çeviri sonuçları model tekrar denemesinden önce temizlenir.
- İndirilebilir paket için Next 16 üretim derlemesi `--webpack` olarak seçildi; Node'a özel ONNX binding'leri tarayıcı paketinden dışlandı. Yeni bağımlılık eklendiği için Vercel kurulum adımı kilit dosyasının güncellenmesine izin veriyor.

## Doğrulama kapsamı

- Çeviri, önceki sürümlerin görünüm/analiz regresyonları ve worker iletişimiyle ilgili 43 yerel otomatik test başarılı.
- Çekirdek çeviri modülleri ve tarayıcı worker kodu ayrı TypeScript kontrollerinden geçti.
- Bu ortamda npm/pnpm dış indirme servisi erişilebilir olmadığı için **tam `next build --webpack` / Vercel üretim derlemesi, 600 MB modelin gerçek indirilmesi ve gerçek model çıkarımı doğrulanamadı.** İlk dağıtım önce Vercel Preview ortamında denenmeli; model de tarayıcıda ayrıca test edilmeli.

## Model ve lisans

Cihaz içi genel çeviri modelinin sahibi/dağıtıcısı: [ONNX Community – opus-mt-tc-big-en-tr](https://huggingface.co/onnx-community/opus-mt-tc-big-en-tr), **CC BY 4.0**. [Transformers.js](https://www.npmjs.com/package/@huggingface/transformers) **Apache-2.0**. Model yalnızca kullanıcı isteğiyle tarayıcıya indirilir. Kurumsal ağ politikalarında Hugging Face statik model dosyalarına erişim gerekebilir. Otomatik genel çeviriler SAP teknik işlemlerini uygulamadan önce özgün kaynakla karşılaştırılmalıdır.
