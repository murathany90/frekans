# Şebeke Frekansı

Şebeke Frekansı, TEİAŞ Türkiye günlük şebeke frekansı verileri ile ENTSO-E (Almanya) / Netztransparenz frekans verilerini aynı statik web uygulamasında inceleyen, karşılaştıran ve analiz eden bir frekans kalite platformudur. Uygulama GitHub Pages üzerinde çalışır ve `gridfreq.com` alan adı için `CNAME` üretir; tarayıcı doğrudan TEİAŞ veya Netztransparenz sistemlerine bağlanmaz. Otomatik indirme, normalizasyon, kalite kontrolü ve yayınlama işleri GitHub Actions ve yerel Python betikleriyle yapılır.

## Kısa Durum

- Ana uygulama: `frekans_rapor_v1.html`
- Yayın girişi: `index.html`
- Analiz çekirdeği: `assets/analysis-core.mjs`
- Statik veri kökü: `data/`
- GitHub Pages çıktısı: `dist/`
- TEİAŞ son otomatik kaynak: `scripts/fetch_teias.py`
- Netztransparenz son otomatik kaynak: `scripts/fetch_netztransparenz.py`
- Netztransparenz OAuth istemcisi: `scripts/netztransparenz_client.py`

Mevcut manifest özetinde TEİAŞ ve Netztransparenz günleri ayrı tutulur. Türkiye ve ENTSO-E (Almanya) günleri birebir aynı takvim aralığında olmak zorunda değildir; uygulama ortak günleri karşılaştırma için, tekil kaynak günlerini ise tek kaynak grafiği ve tek kaynak analizleri için kullanır.

## Mimari

Uygulama tek HTML dosyası etrafında çalışan statik bir ön yüz ve önceden optimize edilmiş veri dosyalarından oluşur.

- `frekans_rapor_v1.html`: Sekmeler, grafikler, takvim, veri yükleme UI'ı, günlük karşılaştırma ve analiz ekranları.
- `assets/analysis-core.mjs`: Veri kalitesi, temel istatistik, RoCoF, Welch PSD, spektrogram, çapraz korelasyon, koherens ve sentetik sinyal yardımcıları.
- `assets/analysis-worker.mjs`: Ağır analizlerin Web Worker üzerinde çalıştırılması.
- `assets/echarts.min.js`: CDN erişimi yoksa kullanılan yerel ECharts yedeği.
- `scripts/normalize_frequency.py`: Günlük frekans paketini üretir, int16 binary yazar, dakika/saat özetlerini oluşturur ve manifestleri üretir.
- `scripts/build_site.py`: GitHub Pages için `dist/` klasörünü oluşturur.
- `scripts/validate_frequency.py`: Veri boyutu, manifest tutarlılığı ve kalite uyarılarını kontrol eder.

## Uygulama Sekmeleri ve Kullanım Akışı

### Günlük

Günlük sekmesi tarih seçimi, zaman hizalama, grafik katmanları ve 24 saatlik frekans grafiği için ana ekrandır. Tarih seçicide Türkiye, ENTSO-E (Almanya) veya ikisinde birden bulunan günler gösterilir. Gün yalnızca ENTSO-E verisine sahipse ENTSO-E serisi tekil olarak çizilir; Türkiye verisi boş kalır. Ortak günlerde Türkiye ve ENTSO-E aynı grafik üzerinde karşılaştırılır.

Günlük sekmesindeki ana kontroller:

- Tarih seçici: Gün, önceki/sonraki gün butonları ve takvim noktaları.
- Zaman eşleştirme: `UTC - otomatik`, `Aynı yerel saat`, `Manuel saat farkı`.
- Grafik katmanları: Fark katmanı ve Maks/Min zarfı.
- Yenile: Seçili günü yeniden hesaplar.
- Grafik sıfırla: Yakınlaştırmayı günlük görünüme döndürür.

### Analiz

Analiz sekmesi seçili gün veya tarih aralığı üzerinde bilimsel analizleri çalıştırır. Filtre barı günlük sekmedeki kontrol yapısına benzer biçimde kompakt tutulur: tarih, kaynak, analiz tipi ve çalıştır/iptal kontrolleri aynı hizada yer alır. Gelişmiş bölümde tarih modu, saat aralığı, çözünürlük, hizalama, bant sınırları, eşik ve pencere parametreleri bulunur.

Kaynak seçenekleri:

- `Türkiye`: TEİAŞ serisini tek başına analiz eder.
- `ENTSO-E (Almanya)`: Netztransparenz serisini tek başına analiz eder.
- `Türkiye + ENTSO-E`: Ortak veri gerektiren çift kaynak görünümü.
- `Türkiye - ENTSO-E`: İki kaynak arasındaki fark bileşeni.
- `Ortak bileşen`: İki serinin ortak mod davranışı.
- `Diferansiyel bileşen`: Yerel farklılaşma davranışı.

Tarih modları:

- Tek gün
- Tarih aralığı
- Son 7 ortak gün
- Son 30 ortak gün
- Ay seçimi
- Özel saat

### Raporlar

Raporlar sekmesi son analiz sonucundan rapor ön izlemesi, JSON çıktısı ve olay CSV çıktısı üretir. Rapor dili Türkçe/İngilizce seçilebilir. Çıktılar tarayıcıda üretilir; sunucuya rapor gönderilmez.

### Veri

Veri sekmesi otomatik katalog durumu, son TEİAŞ tarihi, son ENTSO-E tarihi, Netztransparenz kaynak yöntemi, kaynak sağlık kartları, eksik gün sayısı ve manuel CSV yükleme alanlarını gösterir. Manuel yükleme halen desteklenir ve tarayıcı belleğinde çalışır.

## Grafik Yapısı

### Günlük frekans grafiği

Günlük grafik ECharts ile çizilir. Tam gün görünümünde 86.400 saniyelik veri doğrudan çizilmek yerine dakika ortalamalarına indirgenir. Bu, grafiği hızlı ve okunabilir tutar. İstatistikler ise saniyelik serilerden hesaplanır.

Grafik katmanları:

- Türkiye frekansı
- ENTSO-E frekansı
- Türkiye - ENTSO-E farkı
- Türkiye minimum/maksimum zarfı
- ENTSO-E minimum/maksimum zarfı

Saatlik matris ve 15 dakikalık heatmap grafiğe bağlıdır. Saat veya çeyrek saat seçildiğinde saniyelik detay görünümü açılır. Çift tıklama günlük görünüme geri döndürür. Grafik araç çubuğu tam ekran, PNG indirme ve yakınlaştırma sıfırlama kontrolleri içerir.

### KPI kartları

Günlük hesap sonrası KPI alanı şu metrikleri gösterir:

- Türkiye ortalaması
- ENTSO-E ortalaması
- Türkiye ortalama mutlak sapma
- ENTSO-E ortalama mutlak sapma
- Bias
- MAE/RMSE
- Korelasyon
- Eşlenmiş veri oranı

### Analiz grafikleri

Analiz sekmesindeki grafik tipi seçilen analize göre değişir. Veri kalitesi, istatistik, RoCoF, PSD, çapraz korelasyon ve trend sonuçları çizgi grafik üretir. Spektrogram ısı haritası üretir. Osilasyon adayı analizi, bant geçiren bileşeni ve eşik üstü aralıkları gösterir.

## Analiz Laboratuvarı

Analizler `assets/analysis-core.mjs` ve gerekirse `assets/analysis-worker.mjs` üzerinden çalışır. Büyük hesaplar ana UI iş parçacığını kilitlememek için Web Worker yoluna devredilir.

### Veri kapsama

`analyzeDataQuality` geçerli örnek sayısı, eksik örnek, yinelenen zaman damgası, en uzun boşluk, sabit kalan seri süresi ve ani sıçrama sayısı üretir. Veri kalitesi denetimlerinde özellikle eksik saniyeler ve uzun boşluklar izlenir.

### Temel istatistikler

`computeBasicStats` ortalama, medyan, minimum, maksimum, standart sapma, varyans, RMS sapma, ortalama mutlak sapma, yüzde birlikler, çarpıklık, basıklık, bant içinde kalma oranı ve bant ihlali süresi üretir.

### Bant ihlali

Bant ihlali analizi nominal frekanstan uzaklaşan veya ayarlanan bant dışına çıkan aralıkları olay olarak çıkarır. Olay listesinde başlangıç, bitiş, süre, değer ve sınıflandırma gösterilir.

### RoCoF

RoCoF analizi frekansın zamana göre değişim hızını hesaplar. Desteklenen yöntemler merkezi fark, filtreli türev ve hareketli regresyon yaklaşımıdır. `rocofThreshold` eşiği üstündeki aralıklar olay olarak raporlanır.

### Welch PSD

Welch PSD analizi frekans serisini pencereli segmentlere böler, pencereleme ve FFT sonrası güç spektral yoğunluğu üretir. Baskın frekanslar ve bant enerjileri analiz sonucuna eklenir.

### Spektrogram

Spektrogram kısa zamanlı Fourier dönüşümü mantığıyla zaman-frekans enerji dağılımı üretir. Bu görünüm, gün içinde belirli saatlerde güçlenen salınım bantlarını görmeyi kolaylaştırır.

### Osilasyon adayı

Osilasyon adayı analizi bant geçiren FIR filtre, kayan pencere ve mHz eşikleme kullanır. `bandMin`, `bandMax`, `oscThreshold`, `windowSec`, `stepSec`, `filterTaps` ve `minDuration` parametreleri sonucu belirler.

### Çapraz korelasyon

Çapraz korelasyon Türkiye ve ENTSO-E ortak günlerinde çalışır. İki seri arasındaki en iyi gecikme, korelasyon büyüklüğü ve ortak mod göstergesi hesaplanır.

### Koherens ve faz

Koherens ve faz analizi iki seri arasındaki frekans alanı ilişkisini inceler. `computeMagnitudeSquaredCoherence` ve `computeCrossPowerSpectralDensity` ile ortak bant davranışı, faz farkı ve koherens tepe noktaları çıkarılır.

### Günlük trend

Günlük trend analizi seçilen tarih aralığında günlük istatistikleri tekrarlar ve RMS sapma gibi metriklerin zamana göre değişimini gösterir.

## Otomatik İndirme Süreçleri

Otomatik veri indirme işleri GitHub Actions üzerinde sunucudan sunucuya çalışır. Tarayıcı uygulaması doğrudan veri kaynaklarına istek atmaz. Bu tasarım CORS, gizli anahtar ve kaynak site erişim sınırlarını ön yüzde taşımamak için tercih edilmiştir.

### TEİAŞ otomatik güncelleme

TEİAŞ keşfi `scripts/discover_teias.py` ile yapılır. Betik `https://www.teias.gov.tr/gunluk-frekans-bilgisi` sayfasının gallery API yanıtını okur ve gerçek dosya indirme URL'lerini keşfeder. Dosya UUID'leri sabitlenmez.

İndirme ve normalizasyon akışı:

1. `.github/workflows/teias_daily_update.yml` Türkiye saatiyle 10:15, 12:15, 15:15 ve 18:15 olacak şekilde `15 7,9,12,15 * * *` UTC cron ile çalışır.
2. `scripts/fetch_teias.py --lookback-days 14 --discovery-retries 5 --discovery-timeout 90 --discovery-delay 3 --download-retries 5 --download-timeout 180` son 14 günü tekrar tarar; TEİAŞ gallery API veya dosya indirme aşaması zaman aşımı/geçici yavaşlık yaşarsa artan bekleme süresiyle yeniden dener.
3. Dosya ZIP ise açılır; CSV/TXT içeriği `parse_teias_csv` ile ayrıştırılır.
4. Önceki `sha256` ile yeni veri karşılaştırılır; revizyon varsa `previousSha256` ve `revisionDetected` meta alanları yazılır.
5. `write_day_outputs` günlük `.frequency.i16`, `minute.json`, `hourly.json`, `meta.json` dosyalarını üretir.
6. `scripts/build_daily_files.py` ve `scripts/validate_frequency.py` manifest ve kalite kontrolünü yeniler.
7. Testler geçerse `data/` ve `reports/` değişiklikleri bot commit'i olarak push edilir.

Başarısızlıkta `data/status.json` güncellenir ve `automation/teias-update` etiketli tekil GitHub issue açılır veya mevcut issue'ya yorum eklenir. Sonraki başarılı koşuda issue kapatılır.

### Netztransparenz otomatik güncelleme

Netztransparenz için yapılandırma `config/netztransparenz.json` içindedir. OAuth akışı `scripts/netztransparenz_client.py` tarafından yönetilir. Workflow secret adları:

- `NETZTRANSPARENZ_CLIENT_ID`
- `NETZTRANSPARENZ_CLIENT_SECRET`

Workflow akışı:

1. `.github/workflows/netztransparenz_daily_update.yml` her gün Türkiye saatiyle 10:30 ve 18:30 kontrollerine denk gelen `30 7,15 * * *` UTC cron ile çalışır.
2. Secret adları ve env var varlığı kontrol edilir.
3. `python scripts/netztransparenz_client.py --check` ile OAuth token check yapılır.
4. `scripts/fetch_netztransparenz.py` çalıştırılır.
5. Public Swagger içinde doğrulanmış saniyelik frekans API endpoint'i bulunursa `api` yolu denenir.
6. Doğrulanmış endpoint yoksa veya `--source auto` fallback gerektirirse resmi ZIP indirme yolu kullanılır.
7. Kullanılan kaynak yöntemi meta ve status dosyalarında `api`, `official_zip` veya `manual` olarak tutulur. Güncel üretim akışında doğrulanmış yöntem `official_zip` yoludur.
8. İçerik HTML/login sayfası, MW birimi veya beklenmeyen schema ise reddedilir.
9. Europe/Berlin yerel zamanı UTC gün indekslerine normalize edilir; DST geçiş günleri `local_second_to_day_index` ile korunur.
10. En fazla 4 saniyelik kısa boşluklar doldurulabilir; uzun boşluklar eksik kalır.
11. Veri 45-55 Hz bandı, medyanın 50 Hz çevresi, duplicate oranı ve tarih kapsamı ile doğrulanır.
12. Testler, build ve secret scan geçerse `data/` ve `reports/` değişiklikleri bot commit'i olarak push edilir.

Workflow manuel tetiklenebilir:

```powershell
gh workflow run netztransparenz_daily_update.yml `
  -f date_from=2026-07-01 `
  -f date_to=2026-07-12 `
  -f source=auto `
  -f dry_run=false
```

Desteklenen CLI örnekleri:

```powershell
python scripts/fetch_netztransparenz.py --from 2026-07-01 --to 2026-07-12 --source auto --fill-missing
python scripts/fetch_netztransparenz.py --from 2026-07-01 --to 2026-07-02 --source zip --dry-run
python scripts/netztransparenz_client.py --check
```

Başarısızlıkta `automation/netztransparenz-update` etiketli tekil GitHub issue açılır veya güncellenir. `not_yet_published` durumları hata issue'su açmaz.

### Manuel import

Manuel Netztransparenz CSV importu korunur:

```powershell
python scripts/import_netztransparenz.py --input "incoming\netztransparenz\2026\Frequenz_20260601_20260630.csv"
```

Manuel import `sourceMethod: manual` olarak meta üretir. Yeni otomatik ZIP/API günleri ise `sourceMethod: official_zip` veya `sourceMethod: api` olarak görünür.

## Veri Şeması ve Optimize Dosya Yapısı

Optimize veriler `data/<source>/<year>/<month>/` altında tutulur.

Her gün için dosyalar:

- `<YYYYMMDD>.frequency.i16`: 86.400 saniyelik frekans serisinin int16 binary hali.
- `<YYYYMMDD>.minute.json`: Dakikalık özetler.
- `<YYYYMMDD>.hourly.json`: Saatlik özetler.
- `<YYYYMMDD>.meta.json`: Kaynak URL, hash, örnek sayıları, kalite, zaman dilimi, sourceMethod ve HTTP bilgileri.

Manifest dosyaları:

- `data/manifest.json`: Tam eski uyumluluk manifesti.
- `data/manifest-summary.json`: Hafif özet manifest.
- `data/manifest/2026.json`: Yıl shard manifesti.
- `data/<source>/2026/index.json`: Kaynak-yıl indeksi.
- `data/status.json`: Otomatik güncelleme ve kaynak sağlık durumu.

Binary encoding:

- Temel değer: 50 Hz
- Ölçek: 10.000
- Eksik değer: `-32768`
- Normal gün boyutu: yaklaşık 172.800 byte

Kalite alanları eksik örnek, geçersiz satır, duplicate, frekans bandı dışı örnek, coverage ve kalite puanı içerir. `invalid` veya kritik kalite durumundaki günler diskte kalabilir ancak aktif `availableDates` listesine alınmaz.

## GitHub Actions ve Yayın Akışı

Ana workflow dosyaları:

- `.github/workflows/teias_daily_update.yml`: TEİAŞ otomatik veri güncellemesi.
- `.github/workflows/netztransparenz_daily_update.yml`: Netztransparenz otomatik veri güncellemesi.
- `.github/workflows/deploy_pages.yml`: GitHub Pages build ve deploy.
- `.github/workflows/frontend_tests.yml`: Playwright ve frontend statik testleri.
- `.github/workflows/validate_data.yml`: Veri ve analiz testleri.
- `.github/workflows/backfill_2026.yml`: 2026 backfill desteği.

GitHub Pages yayını için repository ayarlarında Pages source olarak **GitHub Actions** seçilmelidir. `deploy_pages.yml` build sırasında `python scripts/build_site.py` çalıştırır ve `dist/` klasörünü Pages artifact olarak yükler. Kök `CNAME` dosyası `gridfreq.com` değerini taşır ve build sırasında `dist/CNAME` olarak kopyalanır. Ham CSV/ZIP kaynakları, `incoming/`, `cache/`, test artifactleri ve geçici dosyalar Pages çıktısına konmaz.

## Yerel Çalıştırma

```powershell
cd C:\yazilim_projeler\zfrekans_rapor
python -m http.server 8080
```

Tarayıcı:

```text
http://127.0.0.1:8080/frekans_rapor_v1.html
```

## Sık Kullanılan Komutlar

TEİAŞ son günleri çek:

```powershell
python scripts/fetch_teias.py --lookback-days 14 --discovery-retries 5 --discovery-timeout 90 --discovery-delay 3 --download-retries 5 --download-timeout 180
```

Netztransparenz eksik günleri doldur:

```powershell
python scripts/fetch_netztransparenz.py --source auto --fill-missing
```

Manifest ve site üret:

```powershell
python scripts/build_daily_files.py
python scripts/build_site.py
```

Veri doğrula:

```powershell
python scripts/validate_frequency.py
```

## Testler

```powershell
python -m pytest tests
node tests/frontend_static_smoke.mjs
node tests/frontend_prompt2_static.mjs
node tests/frontend_prompt3_static.mjs
node tests/frontend_prompt4_static.mjs
node tests/frontend_prompt5_static.mjs
node tests/frontend_prompt6_static.mjs
node tests/frontend_netztransparenz_status_static.mjs
node tests/readme_documentation_static.mjs
node tests/workflow_static_smoke.mjs
node tests/netztransparenz_workflow_static.mjs
node tests/synthetic_signal_analysis.mjs
node tests/spectral_methods.mjs
python scripts/validate_frequency.py
python scripts/build_site.py
```

Playwright smoke için:

```powershell
python -m http.server 8080
$env:APP_URL="http://127.0.0.1:8080/frekans_rapor_v1.html"
node tests/frontend_smoke_playwright.mjs
node tests/frontend_germany_only_daily_playwright.mjs
node tests/frontend_initial_load_playwright.mjs
node tests/frontend_prompt5_playwright.mjs
node tests/frontend_prompt6_playwright.mjs
```

Test kapsamı parser, timezone hizalama, int16 encode/decode, manifest üretimi, otomatik workflow statikleri, Netztransparenz OAuth istemci davranışı, analiz çekirdeği, grafik UI kontrolleri ve README dokümantasyon kapsamını içerir.

## Repo Boyutu ve Yayın Sınırı

Ham TEİAŞ CSV dosyaları, ham Netztransparenz aylık ZIP/CSV dosyaları ve geçici indirmeler repoya veya Pages çıktısına dahil edilmemelidir. Optimize günlük binary dosyalar commitlenebilir. Boyut raporu `reports/data_quality/storage_report.md` içindedir.

## Sınırlamalar

- GitHub Pages ön yüzü veri kaynaklarından canlı veri çekmez; veri yalnızca commitlenmiş statik katalogdan okunur.
- Netztransparenz public Swagger içinde doğrulanmış saniyelik frekans API endpoint'i bulunmadığında otomatik süreç resmi ZIP fallback yolunu kullanır.
- Henüz yayınlanmamış kaynak günleri hata sayılmaz; status içinde `not_yet_published` olarak izlenir.
- Bu uygulama TEİAŞ, Netztransparenz veya başka bir TSO'nun resmi uygulaması değildir.
