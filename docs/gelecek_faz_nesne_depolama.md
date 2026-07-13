# Gelecek Faz: Nesne Depolama

Bu fazda Cloudflare R2, S3 veya Backblaze B2 kurulmadı ve gizli anahtar gerektiren hiçbir frontend entegrasyonu yapılmadı.

Gelecek geçiş için temel karar manifest tabanlı `baseUrl` alanıdır:

```json
{
  "storage": {
    "type": "s3-compatible",
    "baseUrl": "https://frequency-data.example.com"
  }
}
```

Frontend veri yollarını manifestteki dosya alanlarından okur. Taşıma sırasında beklenen değişiklikler:

- `data/` çıktıları nesne depolamaya yüklenir.
- Manifest aynı şemada kalır.
- CORS yalnızca statik okuma için açılır.
- GitHub Actions veri üretmeye devam eder, yayın adımı dosyaları hedef bucket'a taşır.

Bu geçiş yapılana kadar GitHub Pages `./data` kökü tek aktif depolama katmanıdır.
