# CarLog

CarLog, aracınızın yakıt ve bakım giderlerini tek yerde tutan, Türkçe bir araç takip
uygulamasıdır. Her dolumu, masrafı ve yaklaşan işi kaydeder; bunlardan aracınızın gerçek
yakıt tüketimini, aylık kilometresini ve size ne kadara mal olduğunu çıkarır. Telefonda
uygulama gibi çalışır, bilgisayardan da aynı hesapla kullanılır.

## Neler yapabilirsiniz

### Garajım
Birden fazla araç eklenebilir. Ana ekrandaki kaydırılabilir şeritte ortadaki araç öne çıkar,
yanındakiler silik görünür. Her araç kendi yakıt tipinin renginde gösterilir: hibrit mavi,
benzin lacivert, dizel grafit, LPG mor. Aracın sayfası açıldığında uygulama da o renge bürünür.

### Araç kataloğu
Araç eklerken **Marka → Model → Versiyon** seçilir. Türkiye'de yaygın 140'ı aşkın model ve
nesil katalogda hazırdır; yakıt tipi ve fabrika depo hacmi kendiliğinden gelir. Katalogdaki
çoğu araç için üreticinin açıkladığı karma tüketim de tutulur. Özet sekmesi bu değeri sizin
ölçtüğünüz tüketimle karşılaştırır ve farkı bir ibreyle gösterir. Katalogda olmayan araçlar
elle girilebilir.

### Dolumlar ve gerçek tüketim
Her dolumda tarih, kilometre, litre fiyatı ve tutar girilir; litre otomatik hesaplanır.
Deponun fullenip fullenmediği ve gösterge seviyesi de kaydedilebilir. Kilometre girmeden de
dolum eklenebilir.

Tüketim (L/100km), eldeki en güvenilir yöntemle hesaplanır:
- **Kesin:** iki full dolum arasında alınan tüm yakıt, aradaki km'ye bölünür.
- **Göstergeye göre:** depo hacmi biliniyorsa kısmi dolumlar da ölçülür.
- **Kaba tahmin:** ikisi de yoksa toplam litre toplam km'ye bölünür.

Mantıksız çıkan değerler işaretlenir ve ortalamaya katılmaz. Önceki dolumdan küçük km veya
depodan fazla litre gibi hatalı girişlerde kayıt sırasında uyarı çıkar.

### Masraflar
Bakım, lastik, sigorta, kasko, MTV, muayene, otopark, köprü/otoyol, yıkama ve ceza gibi
yakıt dışı giderler ayrı tutulur. Aylara göre listelenir ve türlere göre dağılımı gösterilir.
Toplamlar yakıt ve diğer masrafları hem ayrı ayrı hem birlikte verir.

### Özet ve raporlar
- **Özet:** bu ayın harcaması, ortalama tüketim, son kilometre ve aylık harcama grafiği.
- **Öne Çıkanlar:** verilerinizden çıkan kısa yorumlar. Örneğin bu ayın geçen aya göre
  durumu, son dolumlardaki tüketim eğilimi ve en ucuz yakıtı ne zaman aldığınız.
- **Aylık kilometre ve yakıt ortalaması:** her ay kaç km yaptığınız ve o ayın L/100km değeri.
- **Aylık rapor:** ay ay dolum sayısı, litre, yakıt ve diğer giderler, ortalama litre fiyatı.
- **Yıl Özeti:** yılın yolunu, yakıtını, harcamasını ve en yoğun ayını anlatan tam ekran
  hikâyeler. Sonunda paylaşılabilir bir özet görseli oluşturulur.
- **Dışa aktar:** seçilen araç ve dönemin kayıtları Excel'de açılan bir dosyaya indirilir.

### Hatırlatmalar ve bildirimler
Muayene, sigorta, kasko, bakım, MTV veya lastik değişimi gibi işler tarihe ya da kilometreye
göre planlanır ve istenirse her N ayda veya N km'de tekrarlanır. Tamamlanan iş masraf olarak
kaydedilir, sıradaki hatırlatma kendiliğinden kurulur. Bildirimler açıldığında telefona
7, 3 ve 1 gün kala, son gün ve süre geçtiğinde; kilometrede ise 500 km kala uyarı gelir.

### Aracı paylaşma
Bir aracı eşiniz, aileniz veya iş arkadaşlarınızla paylaşabilirsiniz. Davet linki gönderilir
ya da kullanıcı adıyla eklenir. Yardımcılar kayıt ekleyebilir ve kendi kayıtlarını
düzenleyebilir. Aracı silme ve paylaşımı yönetme yetkisi yalnızca sahibindedir. Her kaydın
altında onu kimin eklediği görünür.

### Telefonda uygulama gibi
- Safari'de **Paylaş → Ana Ekrana Ekle** ile kendi simgesiyle tam ekran açılır.
- Sayfalar iOS'taki gibi kayarak geçer. Sayılar sayarak gelir, grafikler dolarak açılır.
- İnternet yokken de açılır. Çevrimdışı eklenen kayıtlar bağlantı gelince kendiliğinden
  gönderilir.
- Açık, koyu ve sistem teması vardır. Telefondaki "Hareketi Azalt" ayarına uyulur.

### Hesaplar ve güvenlik
Her kullanıcı yalnızca kendi araçlarını ve kendisiyle paylaşılanları görür. Yöneticiler
ayrı bir panelden hesapları ve araç kataloğunu yönetir, ama kullanıcıların araçlarını
göremez. Şifreler hash'lenerek saklanır ve art arda hatalı giriş denemeleri engellenir.

## Kullanılan teknolojiler

| Katman | Teknoloji |
|---|---|
| Arayüz | React 18, TypeScript, Vite |
| Tasarım | Tailwind CSS, Lucide ikonları |
| Grafikler | Recharts |
| Sunucu | Node.js, Express 5 |
| Veritabanı | Neon Postgres (canlı), PGlite (yerel geliştirme) |
| Bildirimler | Web Push (`web-push`, VAPID), Vercel Cron |
| Çevrimdışı | Service Worker, PWA manifest |
| Animasyon | View Transitions API, CSS animasyonları |
| Yayın | Vercel |
