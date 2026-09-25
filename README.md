# CarLog

Araç yakıt giderlerini takip etmek için basit bir React + Node.js uygulaması.
Birden fazla araç eklenebilir; ana ekrandaki (Garajım) araç kutusuna tıklayınca o
aracın Özet, Dolumlar, Aylık Rapor ve Araç Bilgileri sekmeleri açılır.

Her dolumda kaydedilenler: tarih, kilometre, litre fiyatı (TL), toplam tutar (TL)
ve litre (tutar ÷ fiyat olarak otomatik hesaplanır). Uygulama bunlardan
dolumlar arası tüketimi (L/100km) ve aylık toplam gider/litre özetini hesaplar.

## Kullanıcılar ve yetkiler

- **İlk açılışta** kurulum ekranı gelir ve **admin** hesabı oluşturulur.
- Admin, üst menüdeki **Kullanıcılar** sayfasından kullanıcı ekler, şifre
  değiştirir ve kullanıcı siler.
- **Kullanıcı**: araç ve dolum ekleyebilir, araç bilgilerini düzenleyebilir.
- **Admin**: bunlara ek olarak dolum/araç silebilir ve kullanıcıları yönetir.
  Silme yetkisi sunucuda da kontrol edilir.
- Her dolumun altında onu **kimin eklediği** küçük yazıyla görünür.

Şifreler scrypt ile hash'lenerek saklanır; oturum 30 gün geçerli bir HttpOnly
çerezde tutulur. Aynı IP'den 15 dakikada 10 hatalı girişten sonra giriş geçici
olarak engellenir.

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
  api.ts            Uç noktalar (auth, vehicles, entries, users, import)
  auth.ts           Şifre hash'leme, oturumlar, yetki ve giriş denemesi kontrolü
  db.ts             Postgres bağlantısı (Neon / PGlite), şema ve satır dönüşümleri
  validate.ts       Gelen verinin doğrulanması
  migrate-sqlite.ts Eski data/carlog.db verisini Postgres'e taşır
src/
  pages/            AuthPage, HomePage (Garajım), NewVehiclePage, VehiclePage, UsersPage
  components/       VehicleCard, VehicleForm, EntryForm, EntryTable, MonthlySummaryTable,
                    SpendChart, StatCard, BackLink, LegacyImportBanner
  lib/              api.ts (sunucu istemcisi), calc.ts, format.ts, legacy.ts,
                    router.ts (hash tabanlı yönlendirme)
  types.ts          Sunucu ve arayüzün ortak tipleri
  App.tsx           Oturum durumu, veri yükleme ve sayfa seçimi
```
