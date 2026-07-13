# Frekans Rapor

TEİAŞ günlük frekans verisi ile Netztransparenz frekans verisini karşılaştıran, alanlar arası osilasyon adaylarını tarayan ve GitHub Pages üzerinde statik olarak yayınlanabilen frekans analiz uygulaması.

## Mimari

- Ana uygulama: `frekans_rapor_v1.html`
- Yayın çıktısı: `python scripts/build_site.py` komutu ile `dist/index.html` ve `dist/data`
- Otomatik veri: GitHub Actions, TEİAŞ son 14 günü sunucudan sunucuya tarar
- Statik veri: `data/manifest.json`, `data/<source>/2026/MM/*.frequency.i16`, `minute.json`, `hourly.json`, `meta.json`
- Manuel veri: mevcut tarayıcıdan CSV yükleme akışı korunur

## Veri Akışı

TEİAŞ keşfi `https://www.teias.gov.tr/gunluk-frekans-bilgisi` sayfasının resmi gallery API yanıtından yapılır. Dosya UUID'leri sabitlenmez; gerçek indirme URL'si keşiften gelir.

Netztransparenz için 2026 yılına ait güvenilir otomatik statik arşiv bağlantısı doğrulanmadı. Bu fazda manuel aylık CSV importu desteklenir:

```powershell
python scripts/import_netztransparenz.py --input "incoming\netztransparenz\2026\Frequenz_20260601_20260630.csv"
```

## Yerel Çalıştırma

```powershell
cd C:\yazilim_projeler\zfrekans_rapor
python -m http.server 8080
```

Tarayıcı:

```text
http://localhost:8080/frekans_rapor_v1.html
```

## İlk 2026 Backfill

```powershell
python scripts/backfill_2026.py --source teias
python scripts/validate_frequency.py
```

Bu çalışmada TEİAŞ için 181 yayımlanmış gün işlendi; 178 gün aktif manifestte, 3 geçersiz gün aktif yayından dışlandı. 2026-07-01 ile 2026-07-13 arası TEİAŞ tarafından henüz yayımlanmamış olarak raporlandı.

## Günlük Güncelleme

`.github/workflows/teias_daily_update.yml` Türkiye saatiyle yaklaşık 07:17, 11:17, 15:17 ve 19:17 için UTC cron kullanır. Workflow son 14 günü tekrar tarar, hash değişimlerini yakalar, manifesti yeniler, testleri çalıştırır ve değişiklik varsa bot commit'i oluşturur.

## GitHub Pages

1. Repository Settings > Pages bölümünde Source olarak **GitHub Actions** seçin.
2. `deploy_pages.yml` workflow'unun `pages: write` ve `id-token: write` izinleriyle çalışmasına izin verin.
3. Build komutu ham CSV, `incoming/`, `cache/`, test ve geçici dosyaları Pages çıktısına koymaz.

## Testler

```powershell
python -m pytest tests
python scripts/validate_frequency.py
python scripts/build_site.py
```

Test kapsamı parser, int16 encode/decode, manifest üretimi, kalite dışlama kuralı ve Europe/Istanbul-Europe/Berlin UTC hizalamasını içerir.

## Veri Kalitesi

Kalite puanı eksik saniye, yinelenen kayıt, geçersiz frekans ve parse edilemeyen satırlardan türetilir. `invalid` durumundaki günler diskte meta olarak kalabilir ancak `manifest.json` içindeki aktif `availableDates` listesine girmez.

## Repo Boyutu

Ham TEİAŞ CSV, ham Netztransparenz aylık CSV ve geçici indirmeler repoda tutulmaz. Optimize günlük binary dosya normal günde yaklaşık 173 KB'tır. Boyut raporu `reports/data_quality/storage_report.md` altındadır.

## Sınırlamalar

- Netztransparenz 2026 otomatik indirme üretim workflow'una alınmadı; manuel import gerekir.
- GitHub Actions dışında GitHub Pages frontend'i doğrudan TEİAŞ sitesinden veri çekmez.
- Bu uygulama TEİAŞ'ın veya diğer TSO'ların resmi uygulaması değildir.
