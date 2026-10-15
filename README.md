# CarLog

CarLog, aracınızın yakıt ve bakım giderlerini tek yerde tutan Türkçe bir araç takip
uygulamasıdır. Dolumlarınızı, masraflarınızı ve yaklaşan işlerinizi kaydeder; bunlardan aracınızın
gerçek yakıt tüketimini, aylık kilometresini ve size ne kadara mal olduğunu çıkarır. Telefonda
uygulama gibi çalışır, bilgisayardan da aynı hesapla kullanılır.

## Özellikler

- **Ana sayfa:** seçilen yılın harcaması, tüketimi ve kilometresi; araç kartları ve aylık grafikler.
- **Araç kataloğu:** Türkiye'de yaygın modeller hazır; depo hacmi ve fabrika tüketimi kendiliğinden gelir.
- **Gerçek tüketim:** full–full dolumlar, depo göstergesi ya da kaba tahminle L/100km hesabı.
- **Masraflar:** bakım, sigorta, vergi, lastik gibi yakıt dışı giderler.
- **Raporlar:** aracın özeti, öne çıkan yorumlar, aylık rapor, Yıl Özeti ve Excel'e aktarma.
- **Hatırlatmalar:** muayene, sigorta, bakım gibi işler için tarih ya da kilometreye göre bildirim.
- **Paylaşım:** bir aracı aileniz veya iş arkadaşlarınızla birlikte takip etme.
- **Telefonda uygulama gibi:** ana ekrana eklenir, internet yokken de açılır, aşağı çekince yenilenir.
- **Güvenlik:** herkes yalnızca kendi araçlarını görür; yöneticiler hesapları ve kataloğu yönetir.

## Kullanılan teknolojiler

| Katman | Teknoloji |
|---|---|
| Arayüz | React 18, TypeScript, Vite |
| Tasarım | Tailwind CSS, Lucide ikonları |
| Grafikler | Recharts |
| Sunucu | Node.js, Express 5 |
| Veritabanı | Neon Postgres (canlı), PGlite (yerel geliştirme) |
| Bildirimler | Web Push, Vercel Cron |
| Çevrimdışı | Service Worker, PWA |
| Yayın | Vercel |
