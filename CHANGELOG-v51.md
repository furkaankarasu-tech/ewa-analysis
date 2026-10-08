# v51 — Kaynak seviyeleri ve tutarlılık

- EWA bulgularında sabit kritik/yüksek atamaları son çıktı seviyesini belirlemiyor. Tekil eşleşen kaynak bölümünün doğrulanmış rengi, bölüm rengi yoksa birebir eşleşen alarmın rengi kullanılıyor. Kaynak rengi okunamadığında tahmini SAP seviyesi üretilmiyor.
- RTCCTOOL kaynakta kırmızıyken bulguda yüksek görünmesi düzeltildi. Sarı kaynaklı büyük tablo/parametre bulgularında da kaynak seviyesi korunuyor.
- Numara içermeyen kaynak bölümleri artık kanıt ve renk eşleşmesinden dışlanmıyor. Madde numarası uydurulmuyor.
- HANA SYSTEM hesabı ile System Replication iletişim güvenliği ayrı bulgulara ayrıldı. Genel Security kartının farklı kontrolleri tek seviyede toplaması kaldırıldı.
- Bulgu, alarm, SAP önerisi ve dışa aktarmalarda ortak etiketler: Kritik · Kırmızı, Uyarı · Sarı, Normal · Yeşil, Seviye okunamadı.
- Bilinmeyen seviyeler gri etiket ve ayrı filtreyle gösteriliyor. Raporun kırmızı olma nedenleri, alarm sayısı ve öneri sayısının farklı kapsamları ekranda açıklanıyor.
- Excel aksiyon satırında kullanılan seviye ve kaynağı korunuyor; Markdown aynı etiketleri kullanıyor.

Doğrulama: 133 test, üretim derlemesi ve üç gerçek Word XML EWA → analiz → XLSX/Markdown kontrolü başarılı. Canlı v50 sitesi incelendi; v51 Vercel'e yayınlanmadı. Ayrıntılı kapsam ve tamamlanamayan tarayıcı kontrolleri docs/v51-verification.md dosyasında.
