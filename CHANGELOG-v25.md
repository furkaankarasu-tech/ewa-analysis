# v25: Görünümü geri yükleme

- İlk gönderilen v20 RAR dosyasının `app/globals.css` dosyası bayt düzeyinde geri yüklendi.
- İki dil için gereken ilave ve küçük stiller `app/bilingual.css` içine ayrıldı.
- Veri kalitesi kartı v20 görünümüne uygun, CSS gecikmesi veya yayın cache uyuşmazlığında da çalışan yedek stil tanımları aldı.
- EWA okuma, hesaplama, risk, SQL ve veri işleme kodları v24 ile aynı bırakıldı.
- Kullanıcıya yeni bir çeviri motoru veya çevrilmemiş metnin Türkçe olduğunu iddia eden düzen eklenmedi.
- Dağıtımda ekran eskiyse dağıtım ID'sini ve cache'i kontrol edin.
