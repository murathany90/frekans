# Frekans Rapor - Agent Talimatları

Bu belge, repoda çalışan yapay zeka asistanının uyması gereken kesin kuralları tanımlar. Proje, TEİAŞ ve Netztransparenz frekans verilerini karşılaştıran, alanlar arası osilasyon analizi yapan ve GitHub Pages üzerinden yayınlanan statik `frekans_rapor` uygulamasıdır.

## 1. Proje Mimarisi

- **Ana uygulama:** `frekans_rapor_v1.html` — tüm UI, JS ve CSS tek dosyada inline
- **Statik site build:** `python scripts/build_site.py` → `dist/` klasörüne çıktı üretir, GitHub Pages'e gönderilir
- **Veri formatı:** Günlük frekans `data/teias/2026/MM/YYYYMMDD.frequency.i16` (int16 binary, `baseHz + raw/scale`)
- **Manifest:** `data/manifest.json` — hangi günlerin aktif olduğunu, dosya yollarını, encoding meta verisini tutar
- **Status:** `data/status.json` — son başarılı TEİAŞ tarihi, eksik gün sayısı, kalite uyarıları
- **Ham CSV:** Repoda TUTULMAZ (sadece optimize binary `.i16` + `.minute.json` + `.hourly.json` + `.meta.json`)
- **Backend yok:** Tamamen statik, Node.js/Python runtime gerektiren bir çözüm ÖNERİLMEZ

## 2. Script'ler ve Görevleri

| Script | Görev |
|--------|-------|
| `scripts/fetch_teias.py` | TEİAŞ API'sinden son 14/30 günü çeker, CSV'yi parse eder, binary `.i16` dosyaya yazar |
| `scripts/import_netztransparenz.py` | Manuel indirilen aylık CSV'yi parse eder, binary formatına dönüştürür |
| `scripts/build_daily_files.py` | Günlük manifest güncellemesi + veri dizini oluşturma (GitHub Actions'ta kullanılır) |
| `scripts/build_manifest.py` | `manifest.json` dosyasını sıfırdan oluşturur |
| `scripts/validate_frequency.py` | Tüm veri bütünlüğünü doğrular, storage raporu yazar |
| `scripts/build_site.py` | `dist/` klasörünü hazırlar (HTML + data kopyalama + validasyon) |
| `scripts/backfill_2026.py` | 2026 başından itibaren TEİAŞ verilerini toplu çeker |
| `scripts/discover_teias.py` | TEİAŞ gallery API'sinden dosya listesini keşfeder |
| `scripts/normalize_frequency.py` | CSV parse, int16 encode/decode, manifest yazma — paylaşılan çekirdek modül |

## 3. Test ve Doğrulama Komutları (Zorunlu)

Her geliştirme sonrası sırasıyla ÇALIŞTIRILMALIDIR:

```powershell
# 1. Python test suite
python -m pytest tests -v

# 2. Veri bütünlük doğrulama
python scripts/validate_frequency.py

# 3. Frontend statik smoke test
node tests/frontend_static_smoke.mjs

# 4. Site build test (dist çıktısı üretir)
python scripts/build_site.py
```

**Kural:** Yukarıdaki dört adımdan biri bile başarısız olursa geliştirme TAMAMLANMIŞ SAYILMAZ.

## 4. Çalışma Ortamı

- **Yerel:** Windows + PowerShell 5.1
- **CI/CD:** Ubuntu 24.04 + Python 3.12
- **Bağımlılık:** `pip install -r scripts/requirements.txt` (yalnızca `pytest>=9.0`)
- **Node test:** CI'da `node tests/frontend_static_smoke.mjs` çalışır
- **HTML dosyası** `frekans_rapor_v1.html` — düzenleme yaparken daima ID bazlı element referanslarını kontrol et (`$('elementId')`)

### 4.1. Python Modül Import Kuralı

Script'ler `scripts/` içinden birbirini import eder. Çalıştırma sırasında modül yolunun bulunması için her script'in başında şu blok bulunur:

```python
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
```

Bu bloğu KALDIRMA veya DEĞİŞTİRME. Aksi halde GitHub Actions'da `ModuleNotFoundError: No module named 'scripts'` hatası alınır.

## 5. GitHub Actions İş Akışları

| Workflow | Tetikleyici | İşlem |
|----------|-------------|-------|
| `teias_daily_update.yml` | `cron: 17 4,8,12,16 * * *` (günde 4 kez) | TEİAŞ son 14 günü çeker, manifest günceller, test eder, commit/push yapar; başarısız olursa issue açar |
| `deploy_pages.yml` | `push` (main branch, `data/`, `scripts/`, `tests/`, `frekans_rapor_v1.html` değişiklikleri) | Test çalıştırır, `build_site.py` ile statik site üretir, GitHub Pages'e deploy eder |
| `validate_data.yml` | `push` + `pull_request` (data/scripts/tests değişiklikleri) | Validasyon + test çalıştırır, manifest üretir |
| `backfill_2026.yml` | `workflow_dispatch` (manuel) | 2026 TEİAŞ toplu backfill, commit/push |

**Önemli:**
- `teias_daily_update.yml` **contents: write** + **issues: write** iznine sahiptir
- `deploy_pages.yml` **pages: write** + **id-token: write** iznine sahiptir
- `teias_daily_update.yml` başarısız olursa otomatik **GitHub Issue** açar

## 6. Geliştirme ve Teslim Süreci

### Adım adım:

1. **Analiz:** Kod değişikliğinden önce hangi dosyaların etkileneceğini, hangi fonksiyonların değişeceğini belirle. `agent.md`'deki kuralları ve proje mimarisini göz önünde bulundur.

2. **Geliştirme:** Değişiklikleri yap. HTML, JS, CSS veya Python script'lerinde olsun, mevcut kod yapısına ve isimlendirme kurallarına sadık kal.

3. **Lokal Test (Zorunlu):**
   ```powershell
   python -m pytest tests -v
   python scripts/validate_frequency.py
   node tests/frontend_static_smoke.mjs
   python scripts/build_site.py
   ```
   Tüm testler **PASSED** olmalı, validasyon **issues: []** dönmeli.

4. **Commit:**
   - Conventional Commits formatı: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
   - Stage edilecekler: değişiklik içeren dosyalar (gereksiz dosyaları stage ETME: `docs/`, `cache/`, `incoming/`, `prompt*.md`)
   - Commit mesajı net ve açıklayıcı olmalı

5. **Push:**
   ```powershell
   git push
   ```

6. **CI Monitoring:** GitHub Actions'ta tetiklenen workflow'ları (özellikle `deploy_pages.yml` ve `validate_data.yml`) izle. Yeşil/success durumunu kontrol et.

7. **Teslim Şartı (KRİTİK):**
   - Kod yazıldı + push yapıldı = görev **BİTMEDİ**
   - GitHub Actions **tüm workflow'ları başarıyla (yeşil) tamamladıktan** sonra görev tamamlanmış sayılır
   - Eğer Actions hatası oluşursa: hatayı analiz et → düzelt → push et → yeşil görene kadar tekrarla

## 7. Sık Yapılan Hatalar

- `frekans_rapor_v1.html`'de bir elementi kaldırırken JS tarafında `$('oId')` referansını da kaldırmayı UNUTMA
- CDN script sıralamasını bozma (echarts önce yüklenmeli)
- `.frequency.i16` binary formatını değiştirme — `normalize_frequency.py` içindeki `encode_frequency`/`decode_frequency` fonksiyonları referans alınmalı
- `sys.path.insert` bloğunu yeni script'lerde eklemeyi UNUTMA
- GitHub Actions ortamında `data/teias/` altında OLMASI GEREKEN: `YYYY/MM/2026MMDD.frequency.i16` ve ilgili JSON dosyaları
- `manifest.json` içindeki `sources.teias.availableDates` listesi, validasyondan **geçemeyen** günleri içermez
- Testleri `node tests/frontend_static_smoke.mjs` ile de çalıştır (sadece pytest yeterli DEĞİL)
