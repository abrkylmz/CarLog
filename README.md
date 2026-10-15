# CarLog

CarLog, aracınızın yakıt ve bakım giderlerini tek yerde tutan Türkçe bir araç takip
uygulamasıdır. Dolumlarınızı, masraflarınızı ve yaklaşan işlerinizi kaydeder; bunlardan aracınızın
gerçek yakıt tüketimini, aylık kilometresini ve size ne kadara mal olduğunu çıkarır. Telefonda
uygulama gibi çalışır, bilgisayardan da aynı hesapla kullanılır.

## Özellikler

- **Ana sayfa:** seçilen yılın harcaması, tüketimi ve kilometresi; aylık bütçe halkası, araç kartları ve aylık grafikler.
- **Araç kataloğu:** Türkiye'de yaygın modeller hazır; depo hacmi ve fabrika tüketimi kendiliğinden gelir.
- **Gerçek tüketim:** full–full dolumlar, depo göstergesi ya da kaba tahminle L/100km hesabı; fiş fotoğrafından dolum.
- **Masraflar ve bakım defteri:** yakıt dışı giderler; servis, değişen parçalar ve fatura fotoğrafıyla bakım geçmişi; km başına maliyet.
- **Raporlar:** aracın özeti, öne çıkan yorumlar, aylık rapor, Yıl Özeti; Excel ve PDF'e aktarma.
- **Hatırlatmalar:** muayene, sigorta, bakım gibi işler için tarih ya da kilometreye göre bildirim; ay sonu özeti.
- **Paylaşım:** bir aracı aileniz veya iş arkadaşlarınızla birlikte takip etme.
- **Telefonda uygulama gibi:** alt gezinme çubuğu, tek elle hızlı dolum ekranı; ana ekrana eklenir, internet yokken de açılır, aşağı çekince yenilenir.
- **Paketler:** 2 araca kadar ücretsiz; daha fazlası için Plus, Pro ve Filo paketleri (önizleme).
- **Güvenlik ve gizlilik:** herkes yalnızca kendi araçlarını görür; e-postayla şifre sıfırlama, KVKK aydınlatma metni, hesabı silme.

## Kullanılan teknolojiler

| Katman | Teknoloji |
|---|---|
| Arayüz | React 18, TypeScript, Vite |
| Tasarım | Tailwind CSS, Lucide ikonları |
| Grafikler | Recharts |
| Sunucu | Node.js, Express 5 |
| Veritabanı | Neon Postgres (canlı), PGlite (yerel geliştirme) |
| Bildirimler | Web Push, Vercel Cron |
| Fiş okuma | Claude API (Anthropic) |
| E-posta | Resend |
| Çevrimdışı | Service Worker, PWA |
| Yayın | Vercel |
