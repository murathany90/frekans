# Mevcut Durum Analizi

`frekans_rapor_v1.html` çalışan tek dosyalı bir tarayıcı uygulamasıdır. Dört sekme korunmuştur: veri yükleme, frekans grafiği, alanlar arası osilasyon ve ayarlar.

## Uygulama Katmanları

- CSV parser Web Worker içinde çalışır ve büyük dosyalarda ana UI thread'ini kilitlemez.
- TEİAŞ günlük CSV satırları tipik olarak `;;;;HH:MM:SS;second;frequency;DD.MM.YYYY;` biçimindedir.
- Netztransparenz aylık CSV için `DATE;TIME;FREQUENCY_[HZ]` biçimi desteklenir.
- Gün içi veri `Float32Array(86400)` olarak tutulur.
- Grafikler ECharts 5.5.1 ile çizilir.
- Excel çıktısı SheetJS 0.18.5 ile, PDF çıktısı jsPDF 2.5.1 ve AutoTable 3.8.2 ile üretilir.

## Analiz Davranışı

Günlük görünüm dakika ortalamalarıyla çizilir. Saat başlığı seçimi 3.600 saniyelik detaya, 15 dakikalık kart seçimi 900 saniyelik detaya iner. Osilasyon analizi Web Worker içinde band-pass FIR filtre ve kayan pencere mantığıyla çalışır.

## Zaman Eşleştirme

Arayüzde UTC otomatik, aynı yerel saat ve manuel fark modu vardır. Python veri hattı IANA saat dilimleriyle `Europe/Istanbul` ve `Europe/Berlin` gün uzunluklarını hesaplar.

## Korunan Özellikler

- Manuel TEİAŞ CSV yükleme
- Manuel Netztransparenz CSV yükleme
- Kaynak seçilebilir osilasyon analizi
- Seçilmeyen kaynağın osilasyon grafiğinde varsayılan pasif kalması
- Excel ve PDF raporu
- Ayarlar ve kalite eşikleri

Yedek dosya: `backups/frekans_rapor_v1_before_github_pages.html`
