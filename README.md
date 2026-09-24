# CarLog

Araç yakıt giderlerini takip etmek için basit bir React uygulaması.

Her dolumda kaydedilenler: tarih, kilometre, litre, litre fiyatı (TL) ve toplam
tutar (TL). Uygulama bunlardan otomatik olarak dolumlar arası tüketimi
(L/100km) ve aylık toplam gider/litre özetini hesaplar.

## Kurulum

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
```

Requires Node 18+.

## Stack

React 18, TypeScript (strict), Vite, Tailwind CSS, Recharts, Lucide icons.

## Veri

Tüm kayıtlar tarayıcının `localStorage`'ında (`carlog:entries:v1`) tutulur,
sunucu veya hesap yoktur.

## Proje yapısı

```
src/
  components/   EntryForm, EntryTable, MonthlySummaryTable, SpendChart, StatCard
  lib/           calc.ts (tüketim/aylık özet hesapları), format.ts, storage.ts
  types.ts       FuelEntry, DerivedEntry, MonthlySummary
  App.tsx        Sayfa düzeni ve durum yönetimi
```
