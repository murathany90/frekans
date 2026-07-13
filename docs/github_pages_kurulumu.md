# GitHub Pages Kurulumu

## Yerel Build

```powershell
python scripts/build_site.py
```

Bu komut:

- `frekans_rapor_v1.html` dosyasını `dist/index.html` olarak kopyalar.
- `data/` altındaki optimize dosyaları `dist/data` altına taşır.
- `incoming/`, `cache/`, ham CSV ve test dosyalarını yayın çıktısına koymaz.
- Veri doğrulama ve boyut raporu üretir.

## GitHub Ayarları

Repository Settings > Pages altında Source değerini **GitHub Actions** yapın. Deploy workflow'u resmi `actions/upload-pages-artifact` ve `actions/deploy-pages` adımlarını kullanır.

Gerekli workflow izinleri:

- `contents: read`
- `pages: write`
- `id-token: write`

Günlük veri güncelleme workflow'u ayrıca `contents: write` izniyle veri commit'i yapar.
