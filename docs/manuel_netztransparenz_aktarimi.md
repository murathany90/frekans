# Manuel Netztransparenz Aktarımı

2026 için güvenilir otomatik indirme bağlantısı doğrulanmadığı için aylık CSV yerel olarak içe aktarılır.

## Akış

1. Resmi Netztransparenz sayfasından aylık CSV dosyasını indirin.
2. Dosyayı `incoming/netztransparenz/2026/` altına koyun.
3. Import komutunu çalıştırın:

```powershell
python scripts/import_netztransparenz.py --input "incoming\netztransparenz\2026\Frequenz_20260601_20260630.csv"
```

4. Üretilen optimize dosyalar `data/netztransparenz/2026/MM/` altına yazılır.
5. Ham aylık CSV commit edilmez; yalnızca `data/` altındaki optimize çıktılar commit edilir.

Script ayraç türünü, ondalık virgül/nokta farkını ve `DATE/TIME/FREQUENCY`, `Datum/Zeit/Frequenz` benzeri başlıkları toleranslı algılar.
