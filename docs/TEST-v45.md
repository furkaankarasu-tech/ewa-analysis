# v45 test sonuçları

## Canlı site: https://ewa-analysis.vercel.app/

Canlı sürüme dört PDF dosyası yüklendi. Canlıya kod yüklenmedi; yeni logo ve kernel düzeltmesi teslim paketindedir.

| Dosya / senaryo | Gözlenen sonuç |
|---|---|
| Oracle/Java PP7, 21 sayfa PDF | SID PP7, dönem 30.12.2019–05.01.2020, 4 bulgu ve 10 SQL satırı okundu. |
| Türkçe görünüm | Düğme çalıştı, tarayıcı çevirisi bulunmadığında durum açıkça belirtildi; özgün metin korundu. |
| Excel indirme | Dosya indirildi, ZIP/XML yapısı açıldı. 4 aksiyon satırı ve 10 SQL satırı dolu. Beş sekme mevcut. |
| ECC production PDF | Güvenilir bulgu çıkarılamadığı açıkça bildirildi; analiz başarılı sayılmadı. |
| Solution Manager PDF | Güvenilir bulgu çıkarılamadığı açıkça bildirildi; analiz başarılı sayılmadı. |
| Birleştirilmiş PP7 raporları | Birden fazla EWA içerdiği için reddedildi. |
| Geçerli + birleştirilmiş PDF birlikte | Geçerli rapor görüntülendi, diğer dosyanın hatası ayrıca gösterildi. |
| Üç başarısız dosyanın toplu yüklenmesi | Önceki raporun bulguları kaldırıldı; eski analiz yeni dosyalara atanmadı. |

## Kaynakla karşılaştırma ve yeni paket

Kaynak PDF'nin 9.4.4 bölümündeki ilk SQL: J2EE_CONFIGENTRY, 1678 çalıştırma, 0 saniye toplam, 0 ms ortalama. Çıktı aynı değerleri içeriyor; yuvarlanmış sıfır yüksek yük olarak yorumlanmıyor.

Kaynak 4.5.1 bölümündeki kernel önerisi 749 veya 753 sürümlerini içeriyor. Canlı sürümün bulgu kanıtında cümle yarıda kesiliyordu. Paket, tam öneri paragrafını kullanacak şekilde düzeltildi; Türkçe karşılıkta da aynı sürümler korunuyor. Veritabanı destek önerisine doğrulanmış Türkçe karşılık eklendi.

Yerel v45: 88 otomatik test, gerçek PDF -> analiz -> XLSX testi ve Next.js üretim/TypeScript derlemesi geçti. Gerçek dosya testi `qa/v45-real-pdf.mjs` ile tekrar çalıştırılabilir; rapor dosyaları dağıtım paketine eklenmedi.

## Sınırlar

İki PDF analiz edilemedi; bu durum çözülmüş gibi sunulmuyor. PDF ikon renkleri bu örnekte tüm bölümlerde okunamadı ve arayüz bunu veri kalitesi alanında belirtiyor. DOCX/DOC ve HANA parametreleri bu turda gerçek dosya yüklemesiyle doğrulanmadı. Yeni tasarımın yerel tarayıcı önizlemesi önceki denemede ortamın localhost erişimini engellemesi nedeniyle doğrulanamadı. Logo SVG'si büyütülerek render edildi ve görsel olarak kontrol edildi. Ekran görüntüsü canlıda test edilen eski sürüme aittir.
