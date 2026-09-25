# CarLog

Araç yakıt giderlerini takip etmek için basit bir React + Node.js uygulaması.
Birden fazla araç eklenebilir; ana ekrandaki (Garajım) araç kutusuna tıklayınca o
aracın Özet, Dolumlar, Aylık Rapor ve Araç Bilgileri sekmeleri açılır.

Her dolumda kaydedilenler: tarih, kilometre, litre fiyatı (TL), toplam tutar (TL)
ve litre (tutar ÷ fiyat olarak otomatik hesaplanır). Uygulama bunlardan
dolumlar arası tüketimi (L/100km) ve aylık toplam gider/litre özetini hesaplar.

Yakıt dışındaki masraflar (bakım, lastik, sigorta/kasko, MTV, muayene, otopark,
köprü/otoyol, yıkama, ceza, diğer) aracın **Masraflar** sekmesinde ayrı tutulur:
aylara göre gruplanmış liste, ay ara toplamları ve türlere göre dağılım. Özet,
Aylık Rapor, grafik ve ana ekrandaki toplamlar yakıt + diğer masrafları birlikte
(**Genel Toplam**) ve ayrı ayrı gösterir.

## Kullanıcılar ve yetkiler

- **Kullanıcı paneli** (ana sayfa): *Giriş Yap* ve *Hesap Oluştur* sekmeleri.
  Kayıt olan herkes normal **kullanıcı** olur.
- **Yönetici paneli** (`/#/admin`): yöneticiler yalnızca buradan, kullanıcılar
  yalnızca ana sayfadan giriş yapar. Giriş sonrası üst menüdeki **Yönetici
  Paneli**'nden kullanıcı eklenir (yönetici dahil), şifre değiştirilir, kullanıcı
  silinir.
- **Kullanıcı**: araç, dolum ve masraf ekleyebilir, araç bilgilerini düzenleyebilir.
- **Yönetici**: bunlara ek olarak dolum/masraf/araç silebilir ve kullanıcıları yönetir.
  Silme yetkisi sunucuda da kontrol edilir.
- Her dolum ve masrafın altında onu **kimin eklediği** küçük yazıyla görünür.

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
  api.ts            Uç noktalar (auth, vehicles, entries, expenses, users, import)
  auth.ts           Şifre hash'leme, oturumlar, yetki ve giriş denemesi kontrolü
  db.ts             Postgres bağlantısı (Neon / PGlite), şema ve satır dönüşümleri
  validate.ts       Gelen verinin doğrulanması
  migrate-sqlite.ts Eski data/carlog.db verisini Postgres'e taşır
src/
  pages/            AuthPage, HomePage (Garajım), NewVehiclePage, VehiclePage, UsersPage
  components/       VehicleCard, VehicleForm, EntryForm, EntryTable, ExpenseForm, ExpenseList,
                    CategoryBreakdown, MonthlySummaryTable, SpendChart, StatCard, BackLink,
                    LegacyImportBanner
  lib/              api.ts (sunucu istemcisi), calc.ts, format.ts, chartColors.ts, legacy.ts,
                    router.ts (hash tabanlı yönlendirme)
  types.ts          Sunucu ve arayüzün ortak tipleri
  App.tsx           Oturum durumu, veri yükleme ve sayfa seçimi
```
