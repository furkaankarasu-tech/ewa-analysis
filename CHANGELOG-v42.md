# v42 · Öneri bağlamı ve genel doğruluk kontrolü

- Eksik “Remark sütununa göre öneriyoruz” ve kurulum genellemesi gibi bağımsız aksiyon taşımayan metinleri öneri kartlarından çıkardık.
- “Tablodaki değere ayarlayın” talimatını yalnızca gerçek tablo satırları okunmuşsa gösteriyoruz; madde, sayfa, başlık ve en çok beş kaynak tablo satırı kartta ve Excel'de görünür.
- Kırmızı/sarı renkli ve özgün metni doğrulanan istemci 000 / 000 dışı yetki alarmları ayrı bulgu olarak aksiyon listesine giriyor. Renk doğrulanmamış alarm kritik varsayılmıyor.
- SQL çalıştırma sayısı okunamadığında sıfır uydurulmuyor.
- Kaynak metin ilk görünümde korunuyor; Türkçe isteğe bağlı. Mail özeti, otomatik model indirme ve sayfa üzerindeki analiz paylaşım aracı kaldırıldı.
- `package.json` ve `pnpm-lock.yaml` yeniden uyumlu; kilitli Vercel/GitHub kurulumu kullanılabilir.

Kontrol: 13 test dosyası geçti, TypeScript kontrolü ve Next.js üretim derlemesi tamamlandı. Gerçek kullanıcı EWA'sı bu pakete ekli olmadığından belgeye özgü sonuçlar ayrıca Preview ortamında doğrulanmalıdır.
