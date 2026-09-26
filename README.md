# CarLog

Araç yakıt giderlerini takip etmek için basit bir React + Node.js uygulaması.
Birden fazla araç eklenebilir; ana ekrandaki (Garajım) araç kutusuna tıklayınca o
aracın Özet, Dolumlar, Aylık Rapor ve Araç Bilgileri sekmeleri açılır.

Her dolumda kaydedilenler: tarih, kilometre, litre fiyatı (TL), toplam tutar (TL),
litre (tutar ÷ fiyat olarak otomatik hesaplanır) ve **depo fullendi mi**; fullenmediyse
isteğe bağlı olarak dolumdan önceki gösterge.

### Araç kataloğu

Araç eklerken **Marka → Model → Versiyon (nesil · yıllar · yakıt)** seçilir; yakıt
seçenekleri ve **fabrika depo hacmi** otomatik gelir (düzenlenebilir). Başlangıç
kataloğu Türkiye'de yaygın ~70 model/nesildir ([server/catalogSeed.ts](server/catalogSeed.ts));
değerler üretici teknik verilerinden (auto-data.net) alınmış, çelişkili olanlar
ikinci kaynakla doğrulanıp not düşülmüştür. Katalogda olmayan araç "Listede yok"
ile elle girilir. Yönetici panelinin **Araç Kataloğu** sekmesinde katalog
düzenlenir ve elle girilen marka/modeller (kime ait olduğu gösterilmeden, yalnızca
sayılarıyla) "Katalogda Olmayan Araçlar" olarak listelenir. Elektrikli araçlar
şimdilik katalogda yoktur.

### Tüketim (L/100km) nasıl hesaplanır

Depo her seferinde fullenmeyebileceği için her aralıkta eldeki en güvenilir yöntem
kullanılır ([src/lib/consumption.ts](src/lib/consumption.ts)):

1. **Kesin (full–full):** iki full dolum arasında alınan tüm yakıt (aradaki yarım
   dolumlar dahil) ÷ aradaki km. Ara ara fullemek yeterlidir.
2. **~ Göstergeye göre tahmini:** aracın depo hacmi girilmişse kısmi dolumlar dolumdan
   doluma hesaplanır: önceki dolumdan sonra depodaki yakıt − bu dolumdan önce kalan
   (gösterge × depo hacmi).
3. **~ Kaba tahmin:** ikisi de yoksa toplam litre ÷ toplam km (bir depo kadar sapabilir).

2–30 L/100km dışındaki aralıklar ⚠ ile işaretlenir ve ortalamalara katılmaz (genelde
girilmemiş dolum veya yanlış km). Aylık raporda bir aralık, onu kapatan dolumun ayına
sayılır; 300 km'den az veriye dayanan aylar "az veri" olarak işaretlenir. Kayıt
sırasında önceki dolumdan küçük km, 2.000 km'yi aşan boşluk veya depo hacminden
fazla litre için uyarı verilir. Bu özellikten önce girilmiş dolumlar "?" olarak
görünür ve tek tıkla "full" işaretlenebilir.

Yakıt dışındaki masraflar (bakım, lastik, sigorta/kasko, MTV, muayene, otopark,
köprü/otoyol, yıkama, ceza, diğer) aracın **Masraflar** sekmesinde ayrı tutulur:
aylara göre gruplanmış liste, ay ara toplamları ve türlere göre dağılım. Özet,
Aylık Rapor, grafik ve ana ekrandaki toplamlar yakıt + diğer masrafları birlikte
(**Genel Toplam**) ve ayrı ayrı gösterir.

**Hatırlatmalar** sekmesinde muayene, sigorta, kasko, bakım, MTV, lastik, egzoz
gibi işler tarih ve/veya kilometreye göre planlanır; isteğe bağlı olarak her N
ayda / N km'de tekrarlanır. "Tamamlandı" denince sıradaki hatırlatma otomatik
kurulur, girilen tutar masraf olarak eklenir. Gecikmiş ve yaklaşan (30 gün /
1.000 km) hatırlatmalar ana ekranda ve araç kutularında görünür.

Dolum, masraf ve hatırlatmalar sonradan **düzenlenebilir**; düzenlenen kayıtta
"düzenlendi" notu ve düzenleyen kişi görünür. **Dışa Aktar** (ana ekran ve araç
sayfası) seçilen araç, içerik ve dönem için Excel'de doğrudan açılan bir CSV
indirir (UTF-8 BOM, `;` ayırıcı, virgüllü ondalık).

## Kullanıcılar ve yetkiler

- **Kullanıcı paneli** (ana sayfa): *Giriş Yap* ve *Hesap Oluştur* sekmeleri.
  Kayıt olan herkes normal **kullanıcı** olur.
- **Yönetici paneli** (`/#/admin`): yöneticiler yalnızca buradan, kullanıcılar
  yalnızca ana sayfadan giriş yapar. Giriş sonrası üst menüdeki **Yönetici
  Paneli**'nden kullanıcı eklenir (yönetici dahil), şifre değiştirilir, kullanıcı
  silinir.
- **Yönetici** yalnızca hesapları yönetir; başkalarının araçlarını göremez. Kendi
  araçları için o da sıradan bir kullanıcıdır.

### Araç sahipliği ve paylaşım

Her kullanıcı yalnızca **sahibi olduğu** ve **kendisiyle paylaşılan** araçları görür
(ana ekranda "Araçlarım" ve "Benimle Paylaşılanlar"). Aracı ekleyen kişi sahibidir.

| | Sahip | Yardımcı |
|---|---|---|
| Aracı ve kayıtlarını görür | ✔ | ✔ |
| Dolum, masraf, hatırlatma ekler; hatırlatma tamamlar | ✔ | ✔ |
| Kayıt düzenler ve siler | hepsini | kendi eklediklerini |
| Aracı siler, araç bilgilerini değiştirir | ✔ | – |
| Paylaşımı yönetir (davet, çıkarma) | ✔ | – (yalnızca ayrılabilir) |

Sahip, aracın **Paylaşım** sekmesinden:
- **Davet linki** oluşturur (7 gün geçerli, çok kullanımlık, iptal edilebilir) ve
  Paylaş/Kopyala ile gönderir. Linki açan kişi giriş yapar ya da hesap açar, daveti
  kabul edince yardımcı olur. Veritabanında linkin yalnızca özeti (SHA-256) tutulur.
- Hesabı olan birini **kullanıcı adıyla** doğrudan ekler, yardımcıları çıkarır.

Tüm kurallar sunucuda uygulanır ([server/access.ts](server/access.ts)); erişimi
olmayan bir araç "bulunamadı" yanıtı verir. Her kaydın altında onu **kimin
eklediği** (ve düzenlendiyse kimin düzenlediği) görünür.

Bir kullanıcı silinirse sahibi olduğu araçlar en eski yardımcısına devredilir;
yardımcısı olmayan araçlar kayıtlarıyla silinir (yönetici panelinde önce uyarı çıkar).

Paylaşımdan önceki veriler ilk açılışta otomatik düzenlenir: sahipsiz araçlar en
eski yöneticiye verilir, o araçlara kayıt girmiş herkes yardımcı olur.

### İlk yönetici

Herkese açık bir "admin oluştur" ekranı yoktur. İlk yönetici iki yoldan biriyle gelir:

1. Eski verileri taşımak (`npm run migrate:sqlite`, aşağıda) — eski yönetici hesabı da taşınır.
2. Vercel'de **Settings → Environment Variables** altına `ADMIN_SETUP_KEY` adında
   uzun, gizli bir değer ekleyip yeniden yayınlamak. Ardından `/#/admin`
   sayfasında bu anahtarla ilk yönetici oluşturulur. Hiç yönetici yokken ve anahtar
   doğruysa çalışır; ilk yöneticiden sonra kapanır. İşiniz bitince değişkeni silebilirsiniz.

Şifreler scrypt ile hash'lenerek saklanır; oturum 30 gün geçerli bir HttpOnly
çerezde tutulur. Aynı IP'den 15 dakikada 10 hatalı giriş, 5 hatalı kurulum
anahtarı denemesi veya 5 yeni hesaptan sonra ilgili işlem geçici olarak engellenir.

## Canlı ortam (Vercel)

- Arayüz Vite ile `dist/` klasörüne derlenir; `/api/*` istekleri
  [`api/index.ts`](api/index.ts) sunucusuz fonksiyonuna gider (bkz. [`vercel.json`](vercel.json)).
- Veriler Vercel projesine **Storage** sekmesinden bağlanan **Neon Postgres**
  veritabanında tutulur. Bağlantı `DATABASE_URL` (veya `POSTGRES_URL`) ortam
  değişkeninden okunur; tablolar ilk istekte otomatik oluşturulur.
- `main` dalına yapılan her `git push` Vercel'de otomatik yeni sürüm yayınlar.
  Veritabanı sürümlerden etkilenmez.

## Yerel geliştirme

Node **22.18+** gerekir (yerleşik TypeScript desteği için).

```bash
npm install
npm run dev        # http://localhost:5173 (sunucu + arayüz tek komutta)
npm run build      # tip kontrolü + arayüzü dist/ klasörüne derler
```

`DATABASE_URL` tanımlı değilse yerel geliştirme, `data/pglite` klasöründe
çalışan gömülü bir Postgres (PGlite) kullanır; canlı verilere dokunmaz.
Sunucu kodunu (`server/`) değiştirdikten sonra `npm run dev`'i yeniden başlatın;
arayüz değişiklikleri anında yansır.

### `.env.local` ile canlı veritabanına bağlanmak

Proje kökünde `.env.local` dosyası varsa (git'e eklenmez) `npm run dev`,
`npm start` ve `npm run migrate:sqlite` içindeki değişkenleri kullanır:

```
DATABASE_URL=postgresql://...
```

**Dikkat:** Bu dosya varken yereldeki her işlem canlı veritabanında yapılır.
İşiniz bitince dosyayı silin.

### Eski SQLite verisini taşımak

Sunucunun ilk sürümü verileri `data/carlog.db` dosyasında tutuyordu. Bu dosyadaki
kullanıcılar (şifreleriyle), araçlar ve dolumlar tek komutla Postgres'e taşınır:

```bash
npm run migrate:sqlite
```

Hedef `DATABASE_URL` (varsa `.env.local`'dan) ya da yerel PGlite'tır. Komut tekrar
çalıştırılabilir; hedefte zaten bulunan kayıtlar atlanır.

Sunucudan da eski, tarayıcının `localStorage`'ında tutulan kayıtlar için admin'e
ana ekranda **Sunucuya Aktar** kutusu gösterilir (yalnızca o kayıtların bulunduğu
adreste, ör. `localhost:5173`).

## Stack

React 18, TypeScript (strict), Vite, Tailwind CSS, Recharts, Lucide icons;
sunucuda Express 5, Neon Postgres (`@neondatabase/serverless`), yerelde PGlite.

## Proje yapısı

```
api/
  index.ts          Vercel fonksiyonu; server/app.ts'i dışa açar
server/
  app.ts            /api Express uygulaması (Vercel ve yerel sunucu ortak)
  index.ts          Yerel sunucu; geliştirmede Vite'ı ara katman olarak çalıştırır
  api.ts            Uç noktalar (auth, vehicles, catalog, members, invites, entries,
                    expenses, reminders, users, import)
  catalogSeed.ts    Başlangıç araç kataloğu (marka, model, nesil, depo hacmi)
  auth.ts           Şifre hash'leme, oturumlar, rol ve giriş denemesi kontrolü
  access.ts         Araç bazlı erişim kuralları (sahip / yardımcı)
  db.ts             Postgres bağlantısı (Neon / PGlite), şema ve satır dönüşümleri
  validate.ts       Gelen verinin doğrulanması
  migrate-sqlite.ts Eski data/carlog.db verisini Postgres'e taşır
src/
  pages/            AuthPage, HomePage (Garajım), NewVehiclePage, VehiclePage, UsersPage,
                    InvitePage (davet linki)
  components/       VehicleCard, VehicleForm, EntryForm, EntryTable, ExpenseForm, ExpenseList,
                    CategoryBreakdown, MonthlySummaryTable, SpendChart, StatCard, BackLink,
                    Reminders, UpcomingReminders, SharePanel, CatalogAdmin, ExportDialog, Modal,
                    DialogProvider,
                    LegacyImportBanner
  lib/              api.ts (sunucu istemcisi), calc.ts, format.ts, chartColors.ts, reminders.ts,
                    export.ts (CSV), legacy.ts,
                    router.ts (hash tabanlı yönlendirme)
  types.ts          Sunucu ve arayüzün ortak tipleri
  App.tsx           Oturum durumu, veri yükleme ve sayfa seçimi
```
