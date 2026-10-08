# v50

- Lacivert/yeşil tema sadeleştirildi; metin, kart ve tablo okunabilirliği artırıldı. Rapor açıkken tanıtım alanı küçülür. SQL metni satıra yayılır ve kutu içi dikey kaydırmaya ihtiyaç duymaz.
- Chrome modelinin `downloadable` durumunda yanlışlıkla reddedilmesi giderildi. Model ilk kullanıcı tıklamasında hazırlanır; indirme ilerlemesi, iptal, zaman aşımı ve geç sonuç temizliği eklendi.
- Tarayıcının yerleşik çeviricisine bağımlı olmayan, isteğe bağlı OPUS-MT q8 yerel model eklendi. Yaklaşık 540 MB ilk indirme açıkça belirtilir. API anahtarı veya uzaktan çıkarım kullanılmaz.
- ONNX ihracındaki bozuk tokenizer numaraları özgün modelin vocab numaralarıyla düzeltildi. Hazırlık sırasında gerçek model öz testi eklendi.
- dump/kernel ve teknik kimlik koruması devam eder; hariç/en az/en fazla anlam kontrolleri eklendi. Korunan ilk deneme anlam kontrolünden geçmezse tüm literal değerler kontrol edilerek özgün cümleyle ikinci deneme yapılır.
- Oturum temizleme ve aktif çeviriyi durdurma eklendi. Yeni rapor eski çeviri sonucunu alamaz. Çeviri sürerken yarım çıktı aktarımını önlemek için dışa aktarma düğmeleri bekler.
- 126 otomatik test; gerçek CEP PDF → analiz → dolu Excel / Markdown kontrolü; gerçek q8 modelle dört korumalı çeviri testi.

Dağıtım ve tarayıcı doğrulama sınırları: docs/v50-verification.md. Model lisansı ve kullanım: docs/LOCAL-MODEL.md.
