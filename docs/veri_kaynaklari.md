# Veri Kaynakları

## TEİAŞ

Kaynak sayfa: `https://www.teias.gov.tr/gunluk-frekans-bilgisi`

Keşif yöntemi:

1. TEİAŞ sayfasının kullandığı gallery API okunur.
2. `gunluk-frekans-bilgisi` medya girdileri tarihli dosyalara eşlenir.
3. Gerçek dosya indirme adresi `webim.teias.gov.tr/file/{slug}?download` biçimindeki resmi slug ile oluşturulur.
4. UUID değerleri koda sabitlenmez.

2026 backfill sonucunda 2026-01-01 ile 2026-06-30 arasında 181 yayımlanmış TEİAŞ dosyası bulundu. 2026-05-08, 2026-05-09 ve 2026-05-10 geçersiz veri olarak aktif manifestten dışlandı.

## Netztransparenz

Kaynak sayfa: `https://www.netztransparenz.de/de-de/Regelenergie/Daten-Regelreserve/Sek%C3%BCndliche-Daten`

Resmi sayfadaki arşiv bağlantıları 2012-06/2022 dönemini statik ZIP olarak sunar. 2026 için güvenilir, sabit ve üretim workflow'una alınabilir otomatik bağlantı doğrulanmadığı için bu fazda manuel aylık import kullanılır.

Kullanılan örnek dosya:

```text
docs/Netztransparenz_frekans_aylık/Frequenz_20260601_20260630.csv/Frequenz_20260601_20260630.csv
```

Bu dosyadan 2026-06-01 ile 2026-06-30 arası 30 gün optimize veriye dönüştürüldü.
