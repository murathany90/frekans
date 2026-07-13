# Veri Kalitesi Metodolojisi

Her günlük dosya için kalite puanı 0-100 arasında hesaplanır.

Temel girdiler:

- Beklenen örnek sayısı
- Geçerli frekans örneği
- Eksik saniye
- Yinelenen saniye
- Parse edilemeyen satır
- Geçersiz frekans değeri
- Kaynağın HTML hata sayfası gibi CSV dışı içerik döndürmesi

Sınıflar:

- `complete`: puan 95-100 ve tüm beklenen örnekler geçerli
- `partial`: puan 80-94
- `critical`: puan 0-79 ama doğrulanabilir örnek var
- `invalid`: doğrulanabilir örnek yok

`invalid` dosyalar disk üzerinde kalite incelemesi için kalabilir, ancak `manifest.json` aktif `availableDates` listesine alınmaz. `scripts/validate_frequency.py` bu kuralı doğrular.
