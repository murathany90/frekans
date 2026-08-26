---
title: "TEİAŞ PFK Performans Testini Okuma Rehberi"
slug: "teias-pfk-performans-testi"
category: "Test ve Doğrulama"
reading_time: "12 dk"
language: tr
publication_date: 2026-08-26
status: publish-ready
---

# TEİAŞ PFK Performans Testini Okuma Rehberi

**Alt başlık:** Rezerv, hassasiyet ve doğrulama testlerinde ölçülen şey aslında nedir?

PFK performans testlerinin mantığını, test verisinin nasıl okunacağını ve yanlış yorumlanan tolerans/tepki kavramlarını sade bir mühendislik diliyle anlatır.

![Makale başlık görseli](images/hero_cover.jpg)

> **Ana mesaj:** PFK testinde “hedef güce ulaştı” demek yeterli değildir; gecikme, yükselme hızı, tolerans ve sürdürülebilirlik aynı zaman çizgisinde birlikte okunmalıdır.


## Testin amacı sertifika almaktan daha fazlasıdır

Primer Frekans Kontrolü - PFK (primary frequency control / primer frekans kontrolü) performans testi, bir üretim veya depolama biriminin frekans sapması karşısında beklenen aktif güç tepkisini gerçekten üretip üretemediğini doğrular. Test yalnızca “güç arttı mı?” sorusunu değil; ne kadar gecikmeyle başladığını, hedefe ne hızla ulaştığını ve tepkiyi ne kadar kararlı sürdürebildiğini de inceler.

Bu nedenle iyi bir test raporu; frekans sinyali, aktif güç, güç referansı ve kontrol sistemine ait ilgili yardımcı sinyalleri aynı zaman ekseninde göstermelidir.


![Testin amacı sertifika almaktan daha fazlasıdır](images/fig01_pfk_step_response.png)


## Rezerv testi: adım sinyalinden dinamik cevaba

Bir PFK testi, frekans basamaklarıyla yük alma ve yük atma yönlerinin sınandığı klasik bir yaklaşım kullanabilir. Bu testte ilk bakılan gösterge response delay (tepki gecikmesi), ardından partial/full activation (kısmi/tam etkinleştirme) ve sustainment (sürdürülebilirlik) davranışıdır.

TEİAŞ’ın 03.07.2026 tarihli depolama prosedürü PFK için 200 mHz sapmada rezervin %50’sinin en geç 15 s, tamamının en geç 30 s içinde etkinleşmesini; depolama için tepki gecikmesinin 2 s’yi aşmamasını ve çıkışın en az 15 dakika sürdürülebilmesini şart koşar. Konvansiyonel ünitelerde güncel Ek-17 metni ve TEİAŞ test formatı esas alınmalıdır.


![Rezerv testi: adım sinyalinden dinamik cevaba](images/fig02_deadband_droop.png)


## Hassasiyet ve ölü bant

Deadband (ölü bant), kontrolörün nominal frekans çevresindeki çok küçük sapmalara bilinçli olarak tepki vermediği aralıktır. Hassasiyet testinin amacı küçük frekans değişimlerinin ölçüm ve kontrol zinciri tarafından görülüp görülmediğini anlamaktır.

Ölü bant çok geniş olduğunda ünite küçük ama uzun süreli frekans sapmalarına geç tepki verir. Çok dar veya sıfır ölü bant ise mekanik ekipmanlarda gereksiz hareket ve kontrol gürültüsünü artırabilir. Bu nedenle test ayarı ile işletme ayarının aynı kavram olmadığı özellikle belirtilmelidir.


## Tolerans bandını yanlış okumamak

Tolerans bandı, tek bir örneğin hedef çizgiden ne kadar saptığından çok, cevabın kabul edilen dinamik zarf içinde ne kadar süre kaldığını değerlendirmek için kullanılır. Bazı teknik prosedürlerde ±%1 kurulu güç gibi ifadeler yer alabilse de tolerans tanımı güncel hizmet türüne ve tesis tipine göre değişebilir.

Örneğin TEİAŞ’ın 2026 depolama prosedüründe 10 mHz üzerindeki PFK sapmalarında tolerans, frekansın yönüne göre rezerv yükümlülüğünün +%20/-10 veya -%20/+10 sınırlarıyla asimetrik biçimde tanımlanmıştır. Bu nedenle web makalesi sabit bir toleransı “tüm PFK testlerinin evrensel kuralı” gibi sunmamalıdır.


## Kayıt ve veri kalitesi

Test sonucunun güvenilirliği yalnızca santralin performansına değil, ölçüm zincirinin zaman eşlemesine, örnekleme hızına, kalibrasyonuna ve sinyal ölçeklendirmesine de bağlıdır. Milisaniye mertebesindeki zaman kaymaları, özellikle tepki başlangıcı ve hızlı kaynaklarda önemli değerlendirme hataları yaratabilir.

GridFreq gibi bir analiz katmanı için önerilen yaklaşım, ham veriyi saklamak; türetilmiş sonuçları (gecikme, rezerv yüzdesi, tolerans içinde kalma süresi) yeniden hesaplanabilir metrikler olarak üretmektir.



## Ölçüm zinciri test sonucunu nasıl etkiler?

PFK testinin güvenilirliği, kontrolör kadar ölçüm zincirine de bağlıdır. Frekans referansı, aktif güç ölçümü, güç komutu ve olay işaretinin aynı zaman tabanına bağlanması gerekir. Zaman damgası kayması, özellikle hızlı depolama kaynaklarında tepki gecikmesini olduğundan büyük ya da küçük gösterebilir. Yetersiz örnekleme, kısa süreli doygunlukları ve ilk rampa biçimini gizleyebilir; ölçekleme veya kalibrasyon hatası ise rezerv yüzdesini yanlış hesaplatır.

![PFK değerlendirmesinde frekans, güç ve zaman damgalarının birlikte okunması](images/ppt_context.png)

## Test mantığını adım adım okumak

Test, önce başlangıç işletme noktasını kaydeder. Ünitenin aktif gücü, kullanılabilir yukarı/aşağı rezervi, şarj durumu ve kontrol modu bilinmeden sonuç yorumlanamaz. Ardından test öncesi kararlı durum doğrulanır; güçte sürüklenme veya frekansta oynaklık varsa sonraki farkın ne kadarı test komutundan kaynaklandı belirsizleşir.

Üçüncü adımda tanımlı frekans referansı ya da simülasyonu uygulanır. Sapmanın büyüklüğü, yönü, rampası ve geçerlilik süresi kayıt altına alınır. Denetleyicinin tepki gecikmesi, sapmanın algılandığı an ile anlamlı aktif güç değişiminin başladığı an arasındaki süre olarak değerlendirilir. Sonra kısmi aktivasyonun izlediği rampa, tam aktivasyona ulaşma zamanı ve güçteki olası aşım incelenir. Rezervin belirlenen güç seviyesinde yeterince uzun kalması, yani sürdürülebilirlik, son MW değerinden ayrı bir kriterdir.

Test bitiminde frekans referansı ve güç komutu başlangıç koşullarına kontrollü biçimde döndürülür. Geri dönüş sırasında oluşan sıçrama, rampa sınırı veya yeni bir sapma ayrıca değerlendirilmelidir. Son karar; tüm zaman serisi, ilgili tolerans zarfı, ham kayıt bütünlüğü ve test prosedürünün tesis tipine özgü şartları birlikte görülerek verilir.

## Kavramların uygulamadaki anlamı

**Rezerv kapasitesi**, birimin sözleşilen yönde sağlayabildiği kullanılabilir aktif güç marjıdır; kurulu güçle otomatik olarak aynı değildir. **Aktif güç değişimi**, ölçülen başlangıç gücüne göre oluşan net farktır. **Droop (hız eğimi)**, frekans sapması ile beklenen güç değişimi arasındaki denetim ilişkisini tanımlar. **Deadband (ölü bant)** ise küçük sapmalarda denetleyicinin kasıtlı olarak tepki vermediği aralıktır.

**Tepki gecikmesi**, denetim zincirinin ölçme, filtreleme ve ilk güç değişimini başlatma süresidir. **Aktivasyon süresi**, tanımlı kısmi veya tam rezerv seviyesine ulaşma zamanını; **sürdürme süresi** ise bu seviyenin gereken süre boyunca korunmasını anlatır. **Tolerans bandı**, hedef eğrinin etrafında kabul edilen dinamik zarfı ifade eder. Toleransın sayısal sınırları tesis tipine, test türüne ve yürürlükteki prosedüre bağlıdır; ±%1 gibi tek bir değer tüm PFK testleri için evrensel kabul edilemez.

Depolama tesisleri için güncel teknik çerçevede tanımlanan gecikme, aktivasyon ve sürdürülebilirlik ölçütleri; bu kaynakların güç elektroniği ve enerji kısıtları dikkate alınarak okunmalıdır. Aynı sayısal koşulların konvansiyonel üretim ünitesine doğrudan taşınması doğru değildir.

## Test grafiğini değerlendirirken sık yapılan hatalar

Yalnızca son MW değerine bakmak, erken tepkiyi, aşımı ve sürdürülebilirliği görünmez kılar. Başlangıç gücü ile kullanılabilir rezerv hesaba katılmazsa, örneğin fiziksel sınırda çalışan bir ünitenin gerçek katkısı yanlış yorumlanır. Frekans referansının gerçekten uygulandığı doğrulanmadan yapılan değerlendirme, kontrolörün değil test düzeneğinin davranışını ölçebilir.

Veri boşluğunu fiziksel tepki, farklı zaman eksenlerini aynı olay anı veya filtre gecikmesini birim gecikmesi sanmak da yaygın hatalardır. Bu nedenle frekans ve güç serileri önce hizalanmalı; örnekleme aralığı, ölçüm noktası ve eksik kayıtlar rapora açıkça yansıtılmalıdır. GridFreq, eğrinin biçimini, eksik örnekleri ve karşılaştırılabilir zaman pencerelerini incelemeyi destekleyebilir; uygunluk kararı ise onaylı test kaydı ve geçerli prosedürle verilmelidir.

Bir PFK testinin mühendislik değeri, tek bir eşik geçildiğinde değil, denetimin öngörülebilir, ölçülebilir ve tekrar üretilebilir biçimde çalıştığı gösterildiğinde ortaya çıkar.

## Test koşullarını değiştirirken karşılaştırılabilirliği korumak

Aynı ünitenin farklı günlerdeki testleri bile doğrudan eşdeğer olmayabilir. Başlangıç yükü, ortam koşulları, batarya sıcaklığı ve SOC’si, yardımcı yükler, denetim modu ve kullanılan frekans profili değişirse tepki eğrisi de değişebilir. Bu bilgiler test kaydına eklendiğinde, görülen farkın ekipman bozulmasından mı yoksa farklı işletme koşulundan mı kaynaklandığı daha sağlıklı ayrılır.

Tekrarlanan testler, yalnızca ortalama sonucu değil dağılımı da göstermelidir. Beklenmedik gecikme, bir defalık veri kaybı veya tekrarlayan doygunluk eğilimi ayrı risklerdir. Bu yaklaşım, uygunluk kontrolünü statik bir sertifika anı olmaktan çıkarır; denetim performansının yaşam döngüsü boyunca izlenebildiği mühendislik faaliyetine dönüştürür.
