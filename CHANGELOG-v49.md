# v49 — API olmadan SAP dil tutarlılığı

- Bulgular, öneriler, alarmlar ve kırmızı rapor gerekçeleri için ortak çevrimdışı çeviri planı eklendi. Ekran ve dışa aktarımlar bu planı kullanır.
- Sabit örnekler yerine değişken dump sayısı/tarihi, parametre adı/değeri, bellek yüzdesi, yedekleme sayısı, tablo kayıt sayısı ve numara aralığı için tam cümle kuralları eklendi.
- Sayılar, tarihler, parametre yolları ve SYSTEM / _SYS_REPO kullanıcı istisnaları değiştirilmez. Bilinmeyen koşullar cümleden atılmaz.
- dump, kernel, partitioning, System Replication, savepoint ve checkpoint teknik terimlerinin korunması güçlendirildi. “Kısa döküm” ve “çekirdek” gibi istenmeyen makine çevirileri reddedilir.
- SQL kaynak bölümleri ve bakım tablosu kaynakları Türkçe görünümle uyumlu hale getirildi. Kaynak başlığı tooltip içinde korunur; SQL nesneleri ve sorgular değiştirilmez.
- Markdown KPI etiketleri ve HIGH gibi durumlar seçilen dile uyar.
- PDF soft-hyphen karakterleri çeviri eşleştirmesinde normalize edilir.

API anahtarı, ücretli çeviri servisi veya rapor metnini dışarı gönderen yeni bir bağlantı eklenmedi. İncelenmiş SAP karşılıkları internetten bağımsızdır. Mevcut, cihazda hazır tarayıcı çevirisi varsa bilinmeyen metinler için kullanılabilir; otomatik model indirilmez.

Bu kurallar evrensel bir dil modeli değildir. Tanınmayan ya da kaynakta yarım olan metinler uydurularak tamamlanmaz; özgün metin korunur.
