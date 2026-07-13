# Veri Mimarisi

Veri hattı ham CSV'yi doğrudan Pages üzerinde yayınlamaz. Her gün için optimize edilmiş dört dosya üretilir:

- `YYYYMMDD.frequency.i16`: saniyelik int16 little-endian frekans verisi
- `YYYYMMDD.minute.json`: dakikalık ortalama, min, maks, geçerli örnek sayısı
- `YYYYMMDD.hourly.json`: saatlik ortalama, min, maks, standart sapma ve 50 Hz mutlak sapma
- `YYYYMMDD.meta.json`: kaynak, kalite ve hash bilgisi

Frekans kodlaması:

```text
encoded = round((frequencyHz - 50.0) * 10000)
frequencyHz = 50.0 + encoded / 10000
missing = -32768
```

`data/manifest.json` aktif kaynakları ve kullanılabilir günleri listeler. `invalid` günler `excludedDates` altında görünür, `availableDates` listesine girmez.

Depolama kökü manifestte soyutlanır:

```json
{
  "storage": {
    "type": "github-pages",
    "baseUrl": "./data"
  }
}
```

Bu nedenle frontend gelecekte aynı manifest yapısıyla S3 uyumlu veya R2 benzeri bir `baseUrl` değerine taşınabilir.
