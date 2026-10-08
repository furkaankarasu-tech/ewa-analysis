# v48 — Çeviri akışı ve PDF okuma düzeltmeleri

- Normal İngilizce kelimelerin teknik tanımlayıcı sanılıp doğru yerel çevirinin reddedilmesi düzeltildi. SAP kodlarında büyük/küçük harf, sayılar ve parametre yolları korunur.
- Bir paragrafın yalnızca bir kısmı çevrildiyse tamamı çevrilmiş gibi işaretlenmez.
- Birbirini izleyen, tamamı incelenmiş cümleler birlikte çevrilebilir. Bilinmeyen cümleler tahmin edilmez.
- Yerel çeviri işlemlerine zaman sınırı eklendi. Hatalı sonuçlar önbelleğe yazılmaz; eksik çeviriler tekrar denenebilir.
- Gerçek EWA metinlerinden Gateway, ACL, Support Package, servis hazırlığı ve yetkilendirme karşılıkları eklendi. SQL ve teknik değerler çeviri dışında tutuldu.
- Türkçe görünümde desteklenen KPI ve tablo başlıkları da çevrilir.
- Excel SAP önerileri sayfası seçili çeviriyi ve özgün kaynağı ayrı sütunlarda içerir.
- PDF önerilerinin dört satırda kesilmesi giderildi; üst sınır artırıldı, mevcut cümle/bölüm durdurucuları korundu.
- PDF alarm listesinin sonundaki gezinme/rapor bağlantısı notları artık alarm sayılmaz.
- Eksik ESLint yapılandırması eklendi. v47 teması korundu.

Canlı siteye dağıtım yapılmadı. Yerel görsel test, uzaktaki tarayıcının localhost bağlantısını reddetmesi nedeniyle tamamlanamadı. Tanınmayan metinler için hazır yerel çeviri motoru bulunması gerekir; tam kapsam iddiası yoktur.
