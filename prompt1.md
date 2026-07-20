ROLÜN

Sen kıdemli bir Python veri mühendisi, frontend geliştiricisi, GitHub Actions/Pages uzmanı ve elektrik güç sistemi frekans analizi konusunda deneyimli bir yazılım mühendisisin.

Windows üzerindeki mevcut proje dizininde çalışacaksın:

C:\yazilim_projeler\zfrekans_rapor

Uygulamanın mevcut ana dosyası:

C:\yazilim_projeler\zfrekans_rapor\frekans_rapor_v1.html

Bu HTML dosyası daha önce geliştirilmiş, çalışan tek dosyalık bir frekans karşılaştırma ve osilasyon analiz uygulamasıdır. Uygulamada TEİAŞ ve Netztransparenz frekans verisi yükleme, günlük grafik, saatlik istatistik matrisi, 15 dakikalık analiz, kaynak seçilebilir osilasyon taraması, Excel ve PDF çıktısı gibi çalışan özellikler bulunmaktadır.

Öncelikle mevcut dosyayı ve repodaki diğer dosyaları ayrıntılı incele. Mevcut özellikleri, veri modellerini, grafik davranışlarını, CSV ayrıştırma mantığını ve kullanıcı arayüzünü anlamadan kod değiştirmeye başlama.

ANA HEDEF

Mevcut frekans_rapor_v1.html uygulamasını koruyarak, projeyi GitHub Pages üzerinde yayınlanabilen ve GitHub Actions ile her gün otomatik veri güncelleyen bir frekans analiz sitesine dönüştür.

İlk fazda:

1. TEİAŞ’ın 2026 yılı günlük frekans verilerini mümkün olan en eski 2026 tarihinden en güncel yayımlanmış güne kadar indir.
2. Netztransparenz’in 2026 yılı frekans verilerini otomatik indirmeyi dene.
3. Netztransparenz otomatik indirme güvenilir biçimde mümkün değilse manuel aylık CSV içe aktarma altyapısı oluştur.
4. İlk kurulumdan sonra her gün yalnızca TEİAŞ kaynağı otomatik güncellensin.
5. TEİAŞ günlük güncellemesinde son 14 gün tekrar taransın.
6. GitHub Pages, ham dev CSV dosyaları yerine optimize edilmiş statik veri dosyalarını kullansın.
7. Uygulama hem otomatik yayımlanmış verileri hem de mevcut manuel CSV yükleme özelliğini desteklesin.
8. Cloudflare R2, S3 veya Backblaze B2 bu fazda kullanılmasın. Ancak mimari ileride bu depolama sistemlerine geçişi kolaylaştıracak şekilde oluşturulsun.

ÇOK ÖNEMLİ KISITLAR

- Mevcut çalışan özellikleri bozma.
- Büyük ve gereksiz kod refactoring yapma.
- frekans_rapor_v1.html ana kaynak dosya olarak korunmalıdır.
- Uygulamanın mevcut manuel CSV yükleme özelliği kaldırılmamalıdır.
- Osilasyon analizinde TEİAŞ ve Netztransparenz kaynak seçimi korunmalıdır.
- Grafikte seçilmeyen frekansın ikinci eksende varsayılan pasif olma davranışı korunmalıdır.
- Excel ve PDF çıktıları korunmalı ve otomatik yüklenen verilerle de çalışmalıdır.
- Gerçek olmayan, sentetik veya tahmin edilmiş frekans verisi üretme.
- Kaynakta veri yoksa bunu açıkça “veri bulunamadı” olarak raporla.
- TEİAŞ veya Netztransparenz dosya bağlantılarını tahmin ederek sabit URL üretme.
- Kaynağın gerçekten sunduğu dosya veya API bağlantısını kullan.
- Gizli anahtar veya erişim bilgisi frontend JavaScript koduna yazılmamalıdır.
- GitHub Pages üzerinde çalışan frontend doğrudan TEİAŞ sitesinden veri çekmeye çalışmamalıdır.
- TEİAŞ verisi GitHub Actions tarafından sunucudan sunucuya alınmalıdır.
- Site TEİAŞ’ın resmî sitesiymiş izlenimi vermemelidir.

1. MEVCUT UYGULAMANIN İNCELENMESİ

İlk adım olarak aşağıdaki kontrolleri yap:

- frekans_rapor_v1.html içindeki tüm sekmeleri incele.
- TEİAŞ günlük CSV ayrıştırma mantığını belirle.
- Netztransparenz aylık CSV ayrıştırma mantığını belirle.
- Dosyaların tarih ve saat alanlarının nasıl yorumlandığını tespit et.
- Europe/Istanbul ve Europe/Berlin saat dilimi davranışlarını kontrol et.
- Günlük grafik, saatlik grafik ve 15 dakikalık grafik veri yapılarını belirle.
- Osilasyon Web Worker kodunu ve kaynak seçimini incele.
- Excel ve PDF oluşturma kodunu incele.
- Kullanılan haricî kütüphaneleri ve CDN bağlantılarını listele.
- Mevcut HTML’nin yedeğini oluştur:

backups/frekans_rapor_v1_before_github_pages.html

Yapılan mevcut durum analizini şu dosyaya yaz:

docs/mevcut_durum_analizi.md

2. HEDEF REPO YAPISI

Projeyi aşağıdaki yapıya yakın biçimde düzenle:

zfrekans_rapor/
│
├── frekans_rapor_v1.html
├── index.html
├── README.md
├── .gitignore
│
├── scripts/
│   ├── fetch_teias.py
│   ├── discover_teias.py
│   ├── import_netztransparenz.py
│   ├── normalize_frequency.py
│   ├── validate_frequency.py
│   ├── build_daily_files.py
│   ├── build_manifest.py
│   ├── build_site.py
│   ├── backfill_2026.py
│   └── requirements.txt
│
├── data/
│   ├── manifest.json
│   ├── status.json
│   ├── sources.json
│   ├── teias/
│   │   └── 2026/
│   │       ├── index.json
│   │       └── MM/
│   │           ├── YYYYMMDD.meta.json
│   │           ├── YYYYMMDD.minute.json
│   │           ├── YYYYMMDD.hourly.json
│   │           └── YYYYMMDD.frequency.i16
│   │
│   └── netztransparenz/
│       └── 2026/
│           ├── index.json
│           └── MM/
│               ├── YYYYMMDD.meta.json
│               ├── YYYYMMDD.minute.json
│               ├── YYYYMMDD.hourly.json
│               └── YYYYMMDD.frequency.i16
│
├── incoming/
│   └── netztransparenz/
│       └── 2026/
│
├── cache/
│
├── reports/
│   └── data_quality/
│
├── docs/
│   ├── mevcut_durum_analizi.md
│   ├── veri_mimarisi.md
│   ├── veri_kaynaklari.md
│   ├── github_pages_kurulumu.md
│   ├── manuel_netztransparenz_aktarimi.md
│   ├── veri_kalitesi_metodolojisi.md
│   └── gelecek_faz_nesne_depolama.md
│
├── tests/
│   ├── test_teias_parser.py
│   ├── test_netztransparenz_parser.py
│   ├── test_timezone_alignment.py
│   ├── test_frequency_validation.py
│   └── fixtures/
│
└── .github/
    └── workflows/
        ├── teias_daily_update.yml
        ├── deploy_pages.yml
        ├── backfill_2026.yml
        └── validate_data.yml

Gereksiz dosya oluşturma. Mevcut repo yapısına göre bu yapıyı uyarlayabilirsin ancak isimler ve sorumluluklar açık olmalıdır.

3. GITHUB PAGES YAYIN MİMARİSİ

GitHub Pages statik yayın katmanı olacaktır.

GitHub Pages doğrudan frekans kaynağına bağlanmayacaktır.

Yayın sırasında:

- frekans_rapor_v1.html dosyasını dist/index.html olarak kopyala.
- data klasöründeki yalnızca yayınlanması gereken optimize edilmiş dosyaları dist/data altına kopyala.
- gerekli yerel JavaScript/CSS bağımlılıklarını dist/assets altına kopyala.
- ham CSV, cache, test ve incoming klasörlerini Pages çıktısına dahil etme.
- build çıktısını GitHub Pages’ın resmî Actions dağıtım yapısıyla yayımla.
- gh-pages dalına elle dosya kopyalamaya dayalı kırılgan bir yapı kurma.
- GitHub’ın resmî upload-pages-artifact ve deploy-pages adımlarını kullan.
- deploy işlemi başarısız olsa bile main dalındaki geçerli veri zarar görmemelidir.

index.html için iki seçenekten güvenli olanı uygula:

A. frekans_rapor_v1.html içeriğini build sırasında dist/index.html olarak kopyala.
B. Repo kökündeki index.html dosyasını frekans_rapor_v1.html dosyasına yönlendiren basit bir giriş dosyası olarak kullan.

Kaynak dosyanın adı frekans_rapor_v1.html olarak korunmalıdır.

4. TEİAŞ VERİ KEŞFİ VE İNDİRME

Ana kaynak:

https://www.teias.gov.tr/gunluk-frekans-bilgisi

Öncelikle sayfanın veri yayın mekanizmasını analiz et.

Şu sırayla ilerle:

1. Sayfa kaynak kodunu ve ağ isteklerini incele.
2. Takvimin veya tarih seçiminin kullandığı JSON/API isteğini bulmaya çalış.
3. API bulunursa doğrudan resmî API veya dosya bağlantısını kullan.
4. API bulunamazsa sayfadaki HTML veya JavaScript içinden gerçek dosya bağlantısını bul.
5. Sayfa içeriği yalnızca JavaScript çalıştıktan sonra oluşuyorsa, son çare olarak Playwright tabanlı keşif modülü ekle.
6. Playwright’ı varsayılan bağımlılık yapma; requests/HTTP yöntemi çalışıyorsa onu kullan.
7. Sabit ve geçici UUID’leri doğrudan kod içine gömme.
8. TEİAŞ sayfa yapısı değişirse işlem başarısız olmalı ve açıklayıcı hata vermelidir.

fetch_teias.py aşağıdaki argümanları desteklemelidir:

python scripts/fetch_teias.py --date 2026-06-07
python scripts/fetch_teias.py --start 2026-01-01 --end 2026-06-30
python scripts/fetch_teias.py --lookback-days 14
python scripts/fetch_teias.py --latest
python scripts/fetch_teias.py --dry-run

Her indirilen dosyada şunları kaydet:

- kaynak adı
- kaynak sayfa URL’si
- gerçek dosya URL’si
- yerel tarih
- UTC indirme zamanı
- HTTP durum kodu
- dosya boyutu
- SHA-256 özeti
- ayrıştırılan satır sayısı
- geçerli kayıt sayısı
- eksik saniye sayısı
- yinelenen saniye sayısı
- geçersiz frekans sayısı
- minimum frekans
- maksimum frekans
- ortalama frekans
- kalite puanı
- veri durumu

Dosya daha önce aynı SHA-256 ile işlenmişse tekrar dönüştürme yapma.

Dosya değişmişse:

- revizyonu algıla,
- önceki hash’i metadata içinde sakla,
- normalize edilmiş çıktıyı yeniden oluştur,
- status.json içinde revizyon bilgisini güncelle.

5. TEİAŞ 2026 GERİYE DÖNÜK VERİ TOPLAMA

backfill_2026.py oluştur.

Bu işlem:

- 1 Ocak 2026’dan çalıştırıldığı tarihe kadar tüm günleri taramalıdır.
- Gelecek tarihleri sorgulamamalıdır.
- Her gün için TEİAŞ dosyasını keşfetmelidir.
- Bulunamayan günleri hata yerine “not_published” olarak kaydetmelidir.
- Başarısız günleri ayrı raporlamalıdır.
- 429 ve 5xx cevaplarında kontrollü tekrar denemesi yapmalıdır.
- İstekler arasında uygun bekleme kullanmalıdır.
- TEİAŞ sitesine aşırı ve paralel istek göndermemelidir.
- Varsayılan olarak ardışık veya çok düşük paralellikte çalışmalıdır.
- İşlem yarıda kesilirse kaldığı yerden devam edebilmelidir.
- Her 30–50 dosyada ara durum kaydetmelidir.
- Başarılı dosyaları tekrar indirmemelidir.

Komut:

python scripts/backfill_2026.py --source teias

İşlemin sonunda şu rapor oluşturulmalıdır:

reports/data_quality/teias_2026_backfill.json
reports/data_quality/teias_2026_backfill.md

6. GÜNLÜK TEİAŞ GITHUB ACTIONS GÖREVİ

.github/workflows/teias_daily_update.yml oluştur.

GitHub Actions cron zamanları UTC olarak tanımlanmalıdır.

Türkiye saatiyle yaklaşık aşağıdaki zamanlarda deneme yap:

- 07:17
- 11:17
- 15:17
- 19:17

UTC cron değerlerini buna göre ayarla.

Workflow şu işlemleri yapmalıdır:

1. Repoyu checkout et.
2. Python ortamını hazırla.
3. Bağımlılıkları yükle.
4. Son 14 günü tarat:
   python scripts/fetch_teias.py --lookback-days 14
5. Dosyaları doğrula ve normalize et.
6. Günlük, dakikalık ve saatlik dosyaları üret.
7. manifest.json, status.json ve TEİAŞ index.json dosyalarını güncelle.
8. Testleri çalıştır.
9. Değişiklik varsa bot kullanıcısıyla commit et.
10. Değişiklik yoksa commit oluşturma.
11. Commit mesajında otomatik veri güncellemesi olduğunu belirt.
12. Sonsuz workflow döngüsüne yol açma.
13. Aynı anda iki veri güncelleme işi çalışmamalıdır.

Concurrency kullan:

concurrency:
  group: teias-frequency-daily-update
  cancel-in-progress: false

Workflow’a manuel çalıştırma desteği ekle:

workflow_dispatch

Workflow hatasında:

- mevcut geçerli veriyi silme,
- eksik veya bozuk dosyayı yayımlama,
- mümkünse otomatik GitHub Issue oluştur,
- status.json içinde son başarılı güncelleme zamanını koru.

14 günlük geriye tarama şu sorunları yakalamalıdır:

- geç yayımlanan günlük dosya
- önceki gün başarısız olmuş indirme
- geriye dönük düzeltilmiş dosya
- değişmiş kaynak dosyası
- kısa süreli TEİAŞ erişim hatası

7. NETZTRANSPARENZ 2026 VERİLERİ

Netztransparenz kaynağı için önce otomatik indirmeyi araştır.

Ancak otomatik indirmenin güvenilir olduğu kanıtlanmadan production workflow oluşturma.

Otomatik kaynak bulunursa:

- yalnızca resmî Netztransparenz kaynağını kullan,
- aylık dosyayı indir,
- hash kontrolü yap,
- ayı günlük dosyalara böl,
- Europe/Berlin saat dilimini doğru işle,
- CET/CEST geçişlerini doğru ele al,
- her gün için normalize edilmiş veri üret.

Otomatik 2026 verisi bulunamazsa veya bağlantı güvenilir değilse:

- işlemi başarısız gibi göstermeden manuel mod kullan,
- sentetik veri üretme,
- eski yılların verisini 2026 olarak kullanma,
- yanlış URL tahmin etme.

Manuel aktarım için:

scripts/import_netztransparenz.py

oluştur.

Kullanım örnekleri:

python scripts/import_netztransparenz.py ^
  --input "D:\veriler\Frequenz_20260601_20260630.csv"

python scripts/import_netztransparenz.py ^
  --input "incoming\netztransparenz\2026\Frequenz_20260601_20260630.csv"

Script:

- aylık dosya biçimini otomatik tanımalı,
- ayraç türünü algılamalı,
- ondalık nokta/virgül farkını çözmeli,
- tarih ve saat kolonlarını algılamalı,
- başlık adlarındaki farklılıkları toleranslı karşılamalı,
- aylık veriyi günlere ayırmalı,
- Europe/Berlin saat dilimini kullanmalı,
- UTC’ye normalize etmeli,
- yaz/kış saati geçişlerini doğru işlemeli,
- gün başına kalite raporu üretmeli,
- optimize edilmiş veri dosyalarını data/netztransparenz/2026 altına yazmalı,
- manifest ve index dosyalarını güncellemelidir.

incoming klasörü .gitignore içinde olmalıdır.

Büyük aylık ham CSV dosyalarını repoya commit etmeyi zorunlu kılma.

Manuel süreç şu şekilde çalışabilmelidir:

1. Kullanıcı aylık CSV’yi bilgisayarına indirir.
2. CSV’yi incoming/netztransparenz/2026 klasörüne koyar.
3. Yerel import komutunu çalıştırır.
4. Script optimize edilmiş küçük veri dosyalarını üretir.
5. Yalnızca data altındaki optimize edilmiş dosyalar commit edilir.
6. Ham aylık CSV commit edilmez.

Bunun için ayrıntılı Türkçe rehber oluştur:

docs/manuel_netztransparenz_aktarimi.md

8. VERİ NORMALİZASYONU

Tüm kaynaklar ortak veri modeline dönüştürülmelidir.

Ana zaman temeli UTC epoch saniyesi olmalıdır.

Her kaynak metadata içinde kendi yerel saat dilimini korumalıdır:

- TEİAŞ: Europe/Istanbul
- Netztransparenz: Europe/Berlin

Aynı fiziksel zaman karşılaştırması UTC üzerinden yapılmalıdır.

Aynı yerel saat karşılaştırması ayrı ve açık bir kullanıcı seçeneği olarak korunmalıdır.

Frekansın kompakt saklanması için Int16 formatı kullan:

encoded = round((frequencyHz - 50.0) * 10000)

Çözümleme:

frequencyHz = 50.0 + encoded / 10000

Kurallar:

- little-endian Int16 kullan.
- eksik veri için -32768 sentinel değeri kullan.
- gerçek verinin sentinel ile çakışmamasını doğrula.
- metadata içinde scale ve base değerlerini yaz.
- her günlük dosya için başlangıç UTC zamanı belirtilmelidir.
- örnek aralığı belirtilmelidir.
- veri 1 saniyelik değilse orijinal çözünürlük saklanmalıdır.
- yapay ara değer üretimi varsayılan olarak yapılmamalıdır.

Örnek meta dosyası:

{
  "source": "teias",
  "localDate": "2026-06-07",
  "timezone": "Europe/Istanbul",
  "startUtc": "2026-06-06T21:00:00Z",
  "sampleIntervalSeconds": 1,
  "expectedSamples": 86400,
  "validSamples": 86400,
  "missingSamples": 0,
  "duplicateSamples": 0,
  "encoding": {
    "type": "int16-le",
    "baseHz": 50.0,
    "scale": 10000,
    "missingValue": -32768
  },
  "minimumHz": 49.893,
  "maximumHz": 50.104,
  "averageHz": 49.998,
  "sha256": "...",
  "sourceUrl": "...",
  "downloadedAtUtc": "...",
  "qualityScore": 100
}

9. ÖNCEDEN HESAPLANMIŞ VERİLER

Her gün için aşağıdaki çıktıları üret:

frequency.i16
- saniyelik kompakt frekans verisi

minute.json
- 1.440 dakikalık kayıt
- dakika ortalama
- dakika minimum
- dakika maksimum
- geçerli örnek sayısı

hourly.json
- 24 saatlik kayıt
- saat ortalama
- minimum
- maksimum
- standart sapma
- mutlak 50 Hz sapması
- geçerli örnek sayısı

meta.json
- veri kalitesi ve kaynak bilgisi

TSO karşılaştırma değerleri yalnızca iki kaynak aynı anda mevcutsa hesaplanmalıdır:

- bias
- MAE
- RMSE
- korelasyon
- ortak veri sayısı
- ortak veri oranı
- maksimum mutlak fark
- zaman ofseti
- karşılaştırma modu

Karşılaştırma sonuçlarını gerektiğinde tarayıcıda hesaplamak mümkün olmakla birlikte, sık kullanılan günlük özetler build aşamasında önceden hesaplanabilir.

10. MANIFEST VE DURUM DOSYALARI

data/manifest.json aşağıdaki bilgileri içermelidir:

- şema sürümü
- son güncelleme zamanı
- mevcut kaynaklar
- her kaynak için ilk tarih
- her kaynak için son tarih
- mevcut günler
- veri dosyası yolları
- dosya sürümü veya hash
- veri çözünürlüğü
- kaynak durumu

Örnek yapı:

{
  "schemaVersion": 1,
  "updatedAtUtc": "2026-07-13T08:30:00Z",
  "sources": {
    "teias": {
      "label": "TEİAŞ",
      "timezone": "Europe/Istanbul",
      "firstDate": "2026-01-01",
      "latestDate": "2026-07-12",
      "availableDates": [],
      "status": "active"
    },
    "netztransparenz": {
      "label": "Netztransparenz",
      "timezone": "Europe/Berlin",
      "firstDate": "2026-01-01",
      "latestDate": "2026-06-30",
      "availableDates": [],
      "status": "manual_monthly_import"
    }
  }
}

data/status.json:

- son başarılı TEİAŞ kontrolü
- son başarılı TEİAŞ veri tarihi
- son başarılı Netztransparenz veri tarihi
- en son workflow sonucu
- eksik gün sayısı
- kalite uyarıları
- veri gecikme süresi
- 14 günlük tarama sonucu
- son hata mesajı
- son hata zamanı

11. MEVCUT HTML UYGULAMASININ OTOMATİK VERİYE BAĞLANMASI

frekans_rapor_v1.html açıldığında:

1. Önce data/manifest.json dosyasını yüklemeye çalış.
2. Manifest varsa otomatik veri modu etkinleşsin.
3. Manifest yoksa uygulama mevcut manuel yükleme moduyla çalışmaya devam etsin.
4. Kullanıcı otomatik veriyi veya manuel yüklenen veriyi seçebilsin.
5. Manuel yükleme otomatik veriyi geçici olarak geçersiz kılabilsin.
6. Sayfa yenilendiğinde tekrar sunucudaki manifest kullanılabilsin.

Frekans Veri Yükleme sekmesine şu alanları ekle:

- Otomatik veri kaynağı durumu
- Son TEİAŞ veri tarihi
- Son Netztransparenz veri tarihi
- Son güncelleme zamanı
- Veri gecikmesi
- Veri kalite durumu
- Otomatik veri kullan
- Manuel CSV kullan
- Veriyi yeniden yükle
- Kaynak dosyayı aç bağlantısı
- Metadata görüntüle

Gün filtresi yalnızca mevcut veri bulunan tarihleri göstermelidir.

Bir kaynak seçilen günde yoksa:

- grafik çökmemeli,
- ilgili seri gizlenmeli,
- “Bu tarih için veri bulunamadı” mesajı gösterilmeli,
- mevcut diğer kaynak gösterilmeye devam etmelidir.

12. İSTEK ÜZERİNE VERİ YÜKLEME

Sayfa açılırken bütün yılın saniyelik verisini indirme.

Performans modeli:

Günlük görünüm:
- minute.json yükle
- 1.440 nokta çiz

Saat başlığına tıklanınca:
- ilgili günlük frequency.i16 dosyasını yükle
- sadece seçilen 3.600 saniyeyi çiz

15 dakikalık karta tıklanınca:
- aynı günlük binary dosyadan 900 saniyeyi çiz

Osilasyon analizi:
- seçilen kaynak için ilgili günlük saniyelik dosyayı yükle
- analiz yalnızca istenen gün için çalışsın
- analiz Web Worker içinde çalışmaya devam etsin

Bir binary günlük dosya aynı oturumda tekrar istenirse bellekteki cache kullanılsın.

Tarayıcı cache davranışı için veri URL’sine manifestteki hash veya sürüm parametresi eklenebilir:

data/.../20260607.frequency.i16?v=HASH

13. SAAT DİLİMİ VE EŞLEŞTİRME TESTLERİ

Manuel sabit saat farkını tek gerçek kaynak olarak kullanma.

IANA saat dilimleri temel alınmalıdır.

Özellikle test et:

Haziran 2026:
- Türkiye UTC+3
- Almanya yaz saati UTC+2
- fiziksel zaman farkı 1 saat

Kış dönemi:
- Türkiye UTC+3
- Almanya UTC+1
- fiziksel zaman farkı 2 saat

Almanya DST geçiş günleri:
- 29 Mart 2026
- 25 Ekim 2026

Bu günlerde Almanya yerel günü 86.400 saniye varsayılmamalıdır.

Veri UTC’ye dönüştürüldükten sonra karşılaştırma yapılmalıdır.

Test dosyası:

tests/test_timezone_alignment.py

Şu durumları doğrulamalıdır:

- TEİAŞ 15:00 TRT ile Netztransparenz 14:00 CEST aynı fiziksel andır.
- Kış döneminde TEİAŞ 15:00 TRT ile Almanya 13:00 CET aynı fiziksel andır.
- DST geçişinde kayıp veya çift yerel saat doğru işlenmektedir.
- Aynı yerel saat modu fiziksel UTC modundan ayrı çalışmaktadır.

14. VERİ KALİTESİ

Her günlük veri için kalite puanı üret.

Örnek puanlama:

- tam örnek sayısı
- eksik saniyeler
- yinelenen zaman damgaları
- geçersiz frekans
- sıra dışı frekans
- zaman sıralaması bozukluğu
- boş kayıt
- dosya tarihi uyumsuzluğu
- HTML hata sayfasının CSV sanılması
- önceki dosyayla beklenmeyen birebir aynı içerik

Kalite sınıfları:

- 95–100: İyi
- 80–94: Uyarı
- 0–79: Kritik
- doğrulanamayan dosya: Geçersiz

Geçersiz dosya Pages üzerinde aktif veri olarak yayımlanmamalıdır.

15. GITHUB SINIRLARINI KORUMA

Şimdilik yalnızca 2026 yılı verisi işlenecektir.

Repo içinde ham günlük veya aylık CSV arşivi biriktirme.

Repo içinde tutulacaklar:

- optimize edilmiş int16 günlük veriler
- dakikalık JSON
- saatlik JSON
- metadata
- manifest
- kalite raporları
- uygulama kodu

Repo dışında veya yerel olarak tutulacaklar:

- ham TEİAŞ CSV cache
- ham Netztransparenz aylık CSV
- geçici indirme dosyaları
- ayrıştırma ara çıktıları

.gitignore içine ekle:

incoming/
cache/
*.tmp
*.part
raw/
downloads/
__pycache__/
.pytest_cache/
.venv/

Build aşamasında toplam data klasörü boyutunu raporla.

Belirlenen üst sınırlar:

- tek günlük frequency.i16 yaklaşık 173 KB civarında olmalı
- gereksiz biçimde saniyelik JSON oluşturulmamalı
- manifest gereksiz büyümemeli
- aynı verinin birden fazla kopyası tutulmamalı
- minify edilmemiş büyük vendor dosyaları tekrar tekrar eklenmemeli

Boyut raporu:

reports/data_quality/storage_report.md

16. GELECEK NESNE DEPOLAMA FAZI

Bu fazda Cloudflare R2, S3 veya Backblaze B2 kurma.

Ancak veri URL üretimini soyutla.

Frontend doğrudan sabit olarak yalnızca:

data/teias/...

şeklinde bir yapıya bağımlı kalmasın.

Manifestte baseUrl desteği olsun:

{
  "storage": {
    "type": "github-pages",
    "baseUrl": "./data"
  }
}

Gelecekte şu şekilde değiştirilebilsin:

{
  "storage": {
    "type": "s3-compatible",
    "baseUrl": "https://frequency-data.example.com"
  }
}

Bu gelecek fazı şu dosyada açıkla:

docs/gelecek_faz_nesne_depolama.md

Ancak bu fazda hiçbir ücretli servis, hesap veya gizli anahtar gerektirme.

17. EXCEL VE PDF ÇIKTILARI

Mevcut Excel ve PDF çıktıları korunmalıdır.

Otomatik yüklenen verilerde de çalışmalıdır.

PDF içinde:

- rapor tarihi
- veri kaynakları
- veri güncelleme zamanı
- karşılaştırma modu
- saat dilimi bilgisi
- TEİAŞ kalite puanı
- Netztransparenz kalite puanı
- günlük frekans grafiği
- saatlik istatistik matrisi
- 15 dakikalık fark analizi
- osilasyon bulguları
- kullanılan osilasyon kaynağı
- metodoloji notu

yer almalıdır.

Türkçe karakterler eksiksiz çıkmalıdır.

Özellikle şu bozulmalar bulunmamalıdır:

- Alanlar Aras1
- Osilasyon Bulgular�
- TE�AŞ

PDF üretmeden önce yazdırma alanındaki tüm metinlerin UTF-8 olduğunu doğrula.

Excel dosyasına veri kaynağı metadata sayfası ekle.

18. SİTEDE GÖSTERİLECEK UYARILAR

Sayfanın alt kısmında açık biçimde şu uyarılar yer almalıdır:

“Bu uygulama TEİAŞ’ın veya diğer TSO’ların resmî uygulaması değildir.”

“Frekans verileri ilgili kaynak kurumların kamuya açık yayınlarından elde edilmektedir.”

“Kaynaklar arası farklar ölçüm noktası, zaman damgası, örnekleme, filtreleme ve veri işleme yöntemlerinden kaynaklanabilir.”

“0,10–0,20 Hz bant analizi alanlar arası osilasyon adayı tespitidir. Kesin inter-area mod sınıflandırması için çok noktalı PMU ölçümleri, faz ilişkisi, koherens ve mod şekli analizi gerekir.”

Ham veriyi yeniden yayımlamak yerine mümkün olduğunca kaynak bağlantısı ve türetilmiş analiz sun.

19. TESTLER

Aşağıdaki testleri oluştur ve çalıştır:

python -m pytest tests

Test kapsamı:

- TEİAŞ CSV parser
- Netztransparenz CSV parser
- başlıklı ve başlıksız CSV
- noktalı ve virgüllü ondalık
- farklı ayraçlar
- eksik saniye
- yinelenen saniye
- bozuk tarih
- HTML hata sayfası
- 86.400 örnekli normal TEİAŞ günü
- Almanya DST günü
- int16 encode/decode
- missing sentinel
- UTC hizalama
- dakika ortalamaları
- saatlik istatistik
- manifest üretimi
- hash değişimi
- tekrar indirmenin atlanması

Frontend için en azından basit tarayıcı doğrulama betiği veya Playwright testi oluştur:

- sayfa açılıyor
- manifest yükleniyor
- gün listesi oluşuyor
- günlük grafik çiziliyor
- saat başlığı 3.600 noktalık görünümü açıyor
- çift tıklama günlük grafiğe dönüyor
- 15 dakikalık kart 900 noktalık görünümü açıyor
- osilasyon kaynağı değiştirilebiliyor
- seçilmeyen kaynak ikinci eksende varsayılan pasif
- Excel çıktısı oluşturuluyor
- PDF raporu açılıyor

20. README

README.md dosyasını Türkçe olarak hazırla.

Şu bölümleri içermelidir:

- proje amacı
- mimari
- mevcut HTML uygulaması
- otomatik TEİAŞ veri akışı
- 14 günlük geriye tarama
- Netztransparenz manuel aylık aktarım
- yerel çalıştırma
- testler
- GitHub Pages kurulumu
- GitHub Actions yetkileri
- ilk 2026 backfill çalıştırması
- hata giderme
- veri kalitesi
- veri lisansı ve kaynak gösterimi
- repo boyutu yönetimi
- gelecek nesne depolama fazı

Yerel çalıştırma örneği:

cd C:\yazilim_projeler\zfrekans_rapor
python -m http.server 8080

Tarayıcı:

http://localhost:8080/frekans_rapor_v1.html

21. İLK KURULUM VE ÇALIŞTIRMA AKIŞI

Aşağıdaki sırayla çalış:

1. Mevcut repo ve HTML analizini yap.
2. Yedek oluştur.
3. Python veri altyapısını oluştur.
4. Parser testlerini oluştur.
5. Bir TEİAŞ günlük dosyasıyla uçtan uca test yap.
6. TEİAŞ 2026 backfill işlemini çalıştır.
7. Başarılı ve başarısız günleri raporla.
8. Netztransparenz otomatik kaynağını araştır.
9. Güvenilir otomatik kaynak varsa 2026 verisini indir.
10. Güvenilir değilse manuel import altyapısını tamamla.
11. Kullanıcı tarafından sağlanan 2026 aylık Netztransparenz CSV dosyalarını local import ile işle.
12. Manifest ve data klasörünü oluştur.
13. HTML’yi manifest tabanlı otomatik veriyle entegre et.
14. Mevcut manuel CSV yükleme özelliklerini tekrar test et.
15. GitHub Actions workflow’larını oluştur.
16. Pages build işlemini yerelde test et.
17. Testleri çalıştır.
18. Boyut raporu oluştur.
19. README ve teknik dokümantasyonu tamamla.
20. Son değişiklik özetini raporla.

22. KABUL KRİTERLERİ

Çalışma aşağıdaki koşulların tamamı sağlanmadan tamamlanmış sayılmamalıdır:

- frekans_rapor_v1.html çalışıyor.
- Mevcut dört sekme korunuyor.
- Manuel TEİAŞ CSV yükleme çalışıyor.
- Manuel Netztransparenz CSV yükleme çalışıyor.
- Otomatik manifest yükleme çalışıyor.
- 2026 TEİAŞ verileri mümkün olan kapsamda sisteme eklenmiş.
- Eksik TEİAŞ günleri açıkça raporlanmış.
- Netztransparenz 2026 otomatik veya manuel import yoluyla eklenebilir.
- Aylık Netztransparenz ham CSV’sinin repoya commit edilmesi zorunlu değil.
- Son 14 gün taraması çalışıyor.
- Günlük veri güncelleme workflow’u çalışıyor.
- Pages deploy workflow’u çalışıyor.
- Site bütün yılın saniyelik verisini başlangıçta indirmiyor.
- Günlük grafik dakikalık veri kullanıyor.
- Saat görünümü 3.600 saniyelik veri kullanıyor.
- 15 dakika görünümü 900 saniyelik veri kullanıyor.
- Osilasyon analizi seçilen kaynakta çalışıyor.
- Diğer kaynak ikinci eksende varsayılan pasif başlıyor.
- UTC ve aynı yerel saat modları korunuyor.
- Haziran 2026 için 1 saatlik Türkiye–Almanya farkı doğru.
- Kış dönemi için 2 saatlik fark doğru.
- Almanya DST günleri doğru işleniyor.
- Bias, MAE, RMSE ve korelasyon doğru hesaplanıyor.
- Excel çıktısı çalışıyor.
- PDF çıktısı çalışıyor.
- PDF Türkçe karakterleri doğru.
- Geçersiz veri yayınlanmıyor.
- Sentetik veri üretilmiyor.
- Repo boyutu kontrol altında.
- GitHub Pages üzerinde statik olarak çalışıyor.

23. AJANIN ÇALIŞMA BİÇİMİ

- Önce analiz et, sonra değişiklik yap.
- Her büyük aşamadan önce ilgili dosyaları incele.
- Mevcut dosyayı tamamen yeniden yazmak yerine hedefli değişiklik yap.
- Silinen veya değiştirilen özellikleri raporla.
- Kritik kararları docs altında belgele.
- Çalışmayan kodu “tamamlandı” olarak raporlama.
- Otomatik TEİAŞ bağlantısı bulunamazsa bunu açıkça bildir.
- Netztransparenz 2026 otomatik indirilemiyorsa eski veya uydurma veri kullanma.
- Gerçek veri bulunamayan günleri boş bırak.
- Test sonuçlarını komut çıktılarıyla doğrula.
- GitHub’a push işlemini kullanıcı açıkça istemedikçe yapma.
- GitHub Pages ayarlarını ve gerekli repo izinlerini README içinde tarif et.
- Kullanıcıdan yalnızca gerçekten gerekli olan GitHub repo URL’si veya Pages etkinleştirme işlemi gibi bilgiler eksikse talep et.

24. SON RAPOR

İşlem sonunda şu bilgileri içeren bir rapor hazırla:

- değiştirilen dosyalar
- oluşturulan dosyalar
- TEİAŞ veri keşif yöntemi
- bulunan 2026 TEİAŞ gün sayısı
- eksik TEİAŞ günleri
- Netztransparenz otomatik indirme sonucu
- manuel Netztransparenz kullanım komutu
- toplam veri boyutu
- Pages build boyutu
- GitHub Actions workflow açıklaması
- test sonuçları
- bilinen sınırlamalar
- sonraki faz önerileri
- GitHub Pages’i etkinleştirmek için kullanıcının yapacağı adımlar

Öncelik sırası:

1. Veri doğruluğu
2. Çalışan mevcut özelliklerin korunması
3. Zaman damgası ve saat dilimi doğruluğu
4. GitHub repo ve Pages boyutunun kontrolü
5. Otomasyon güvenilirliği
6. Tarayıcı performansı
7. Kullanıcı arayüzü
8. Gelecek nesne depolama uyumluluğu