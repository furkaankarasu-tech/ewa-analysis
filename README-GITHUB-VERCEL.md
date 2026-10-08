# EWA Radar v47 · GitHub / Vercel

1. ZIP içindeki **dosyaları** GitHub deponuzun kök dizinine yükleyin. `app`, `lib`, `public`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` ve `vercel.json` kökte kalmalıdır.
2. Vercel projesi GitHub deposunu izlemelidir. Framework **Next.js**, Node.js **22**.
3. Kurulum: `pnpm install --frozen-lockfile`. Derleme: `pnpm run build:vercel`.
4. Önce Preview yayını oluşturup kendi PDF, SAP Word XML ve DOCX EWA raporlarınızda kaynak maddeleri ve tablo değerleriyle karşılaştırın; ardından Production'a alın.

## v47 davranışı

- Lacivert/beyaz tema, vektör radar deseni, daha büyük metinler, ayrı bulgu kartları ve ferah tablolar.

- SP Stack Kernel ve DATA ADMIN önerilerinin Türkçe karşılıkları ve ilgili bölüm başlıkları eklendi. SAP Note numaraları, hesap adları ve kaynak metin korunur.

- SAP logosu font bağımlılığı olmayan vektör çizimle yenilendi.
- Kernel kanıtı tam öneri paragrafından alınır; sürüm numaraları Türkçe açıklamada korunur.
- Gerçek PDF test sonuçları: `docs/TEST-v45.md`.


- Sistem metrikleri daha büyük değerler ve açıklamalarla gösterilir. Boş oran çubukları yoktur; tüm metrikler görünür.
- ABAP dump teknik adı korunur.
- Parametreler dosya/bölüm, mevcut değer, önerilen değer, SAP Note ve doğrulanabilen EWA maddesiyle tabloda gösterilir. Mobilde satırlar alt alta gelir.
- Ekran ve Excel aynı parametre tekilleştirme ve madde eşleştirmesini kullanır.


- Çeviri çalışmıyorken “çeviri bekleniyor” gösterilmez. Karşılığı olmayan içerik özgün İngilizce olarak işaretlenir.
- SAP Security Notes desteği ve ABAP number ranges uyarılarının Türkçe karşılıkları eklendi.
- Markdown ve Excel çıktılarında seçilen çeviri ile özgün SAP kaynak metni birlikte korunur.

- Rapor ilk açıldığında özgün SAP metni görünür. Türkçe için **Türkçeyi göster** düğmesine basılır. Tanımlı güvenilir teknik karşılıklar gösterilir; desteklenen tarayıcıda ilk tıklamada dil paketi indirilebilir. Eksik metinler için ayrı düğmeyle bağımsız yerel model (yaklaşık 540 MB) kullanılabilir. Rapor metni cihazdan çıkmaz. docs/LOCAL-MODEL.md dosyasını inceleyin.
- Sadece başka bir tabloya atıf yapan boş öneriler aksiyon olarak sunulmaz. Öneri tablosu okunursa ilgili değerler kartta ve Excel'in `SAP önerileri` sekmesinde görünür.
- İstemci 000 ve diğer istemcilerdeki kritik yetki uyarıları ayrı kapsamdır. Doğrulanmış kırmızı/sarı Alert Overview ikonları aksiyon önceliğini belirler.
- Mail özeti ve tarayıcı yapay zekâsına analiz aktaran araç kaldırıldı. Rapor işleme tarayıcı içinde yapılır; site kodu rapor dosyasını bir API'ye göndermez.

Doğrulama: `pnpm test:offline`, `pnpm exec tsc --noEmit`, `pnpm run build:vercel`.
