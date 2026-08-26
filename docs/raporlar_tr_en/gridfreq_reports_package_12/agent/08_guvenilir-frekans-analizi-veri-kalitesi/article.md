---
title: "Güvenilir Frekans Analizinin Temeli: Veri Kalitesi"
slug: "guvenilir-frekans-analizi-veri-kalitesi"
category: "Veri Mühendisliği"
reading_time: "11 dk"
language: tr
publication_date: 2026-08-26
status: publish-ready
---

# Güvenilir Frekans Analizinin Temeli: Veri Kalitesi

**Alt başlık:** Eksik örnek, donmuş değer, zaman damgası ve filtre seçimi sonuçları nasıl değiştirir?

Gelişmiş RoCoF, PSD veya olay analizi öncesinde veri kalitesinin neden bir “ön işlem” değil, analizin parçası olduğunu açıklar.

![Makale başlık görseli](images/hero_cover.jpg)

> **Ana mesaj:** Veri kalitesi analizin giriş kapısı değil, güven skorudur. Ham veriyi koruyun; olağandışı değeri silmek yerine önce etiketleyin.


## En gelişmiş algoritma kötü veriyi düzeltemez

Frekans analizi saniyelik veya daha hızlı serilerle çalışır. GPS saat kaybı, ağ kesintisi, sensör donması ve veri kaynağındaki yeniden örnekleme gibi problemler küçük görünse de türev ve spektrum hesaplarında büyük hatalar yaratabilir.

Özellikle RoCoF gibi derivative (türev) tabanlı metrikler tek bir sıçramayı büyük bir fiziksel olay gibi büyütebilir. Bu nedenle veri kalitesi sonucu “analizden önce bir kez kontrol edilen” değil, her raporda görünür olan bir metrik olmalıdır.


![En gelişmiş algoritma kötü veriyi düzeltemez](images/fig01_quality_flags.png)


## Zaman damgası ve örnek aralığı

Örneklerin sıralı, benzersiz ve beklenen zaman aralığında olması gerekir. Yerel saat kullanılıyorsa yaz-kış saati geçişleri 23 veya 25 saatlik günler oluşturabilir; en güvenli analiz tabanı çoğu durumda UTC (eşgüdümlü evrensel zaman) kullanmak ve yerel saati yalnızca gösterimde uygulamaktır.

İki farklı frekans kaynağı karşılaştırılacaksa milisaniye/saniye düzeyindeki saat farkı çapraz korelasyon ve faz analizini doğrudan etkiler.


![Zaman damgası ve örnek aralığı](images/fig02_rocof_methods.png)


## Donmuş değer ile kararlı şebekeyi ayırmak

Aynı frekans değerinin uzun süre art arda gelmesi “çok kararlı şebeke” anlamına gelebilir gibi görünse de pratikte ölçüm veya iletişim donmasının işareti olabilir. Duplicate-run (yinelenen değer dizisi) kontrolü bu yüzden önemlidir.

Ancak sabit bir 15 saniye eşiğini her cihaz ve veri kaynağı için evrensel kabul etmek doğru değildir. Ölçüm çözünürlüğü 1 mHz olan bir kaynağın aynı değeri tekrar etme olasılığı, 0.1 mHz çözünürlüklü bir kaynaktan farklıdır. Eşik kaynak bazlı kalibre edilmelidir.


## Frekans aralığı kontrolü: “imkânsız” ile “acil durum” aynı şey değildir

Operasyonel kalite kontrolünde 49-51 Hz dışındaki değerler geçersiz olarak işaretlenebilir. Bu, normal gün veri temizliği için pratik olabilir ancak fiziksel olarak 49 Hz altı veya 51 Hz üstü değerler ağır sistem olaylarında mümkündür.

Daha güvenli yaklaşım hard reject (kesin silme) yerine iki kademeli kontroldür: cihazın fiziksel ölçüm aralığının dışındaki değerleri geçersiz saymak; 49-51 Hz gibi operasyonel bandın dışındakileri ise “olağandışı / olay adayı” olarak işaretleyip ham veriyi korumak.


## RoCoF ve filtre seçimi

Central difference (merkezî fark) en basit RoCoF yöntemidir fakat gürültüye hassastır. Moving average filtered derivative (hareketli ortalama filtreli türev) gürültüyü azaltır fakat tepeleri yumuşatabilir. Sliding linear regression (kayan doğrusal regresyon) daha kararlı bir eğim tahmini verir fakat pencere uzunluğu arttıkça hızlı olayları geciktirebilir.

Bu yüzden raporda yalnızca “maksimum RoCoF” değil; kullanılan örnekleme aralığı, filtre/pencere uzunluğu ve hesaplama yöntemi de verilmelidir. Aynı veri farklı filtrelerle farklı tepe değerleri üretebilir.


## Veri kalitesi bayrakları nasıl düşünülmeli?

Kalite bayrağı, veriyi otomatik olarak yok sayan bir hüküm değil, analitik kararın girdisidir. **VALID**, zaman ve değer kontrollerini geçen örneği; **MISSING**, beklenen anda hiç kayıt bulunmadığını belirtir. **DUPLICATE**, aynı zaman damgasının birden çok kez gelmesi veya açıkça yinelenen kayıt yapısıdır. **FROZEN**, ölçümün olağandışı süre boyunca değişmeden kalması şüphesini taşır. **SPIKE**, komşu örneklerle uyumsuz ani sıçramayı; **OPERATIONAL OUTLIER**, normal işletme bandının dışındaki fakat fiziksel olarak mümkün olabilecek değeri; **PHYSICAL INVALID** ise ölçüm sisteminin güvenilir aralığıyla bağdaşmayan değeri temsil eder.

Bu sınıflar birbirine karıştırılmamalıdır. Bir örnek operasyon bandının dışındaysa, ciddi bir olayın ilk işareti olabilir; fiziksel olarak geçersiz olduğu kanıtlanmış değildir. Buna karşılık zaman damgası bozuk bir kayıt, frekans değeri makul görünse bile türev ve eşleme hesaplarını bozabilir.

## 49–51 Hz bandını analitik bağlamında okumak

49–51 Hz gibi bir bandın operasyonel kalite kontrolünde ve aykırı değer işaretlemede kullanılması pratiktir. Ancak ağır frekans olaylarının ham veriden otomatik silinmesi, tam da incelenmesi gereken fiziksel davranışın kaybolmasına yol açabilir. Analitik olarak daha güvenli yaklaşım, ham ölçümü korumak; normal çalışma bandı dışındaki kaydı bayraklamak; değerlendirme ve görselleştirmede bu bayrağı görünür kılmaktır.

Mevcut uygulama davranışı, belirli değer aralıklarını kalite hesabında geçersiz olarak işaretleyebilir. Bu metindeki önerilen analitik yaklaşım ise bu işaretin, olay araştırmasında ham kaydın geri döndürülemez biçimde silinmesi anlamına gelmemesidir. Hangi değerlerin fiziksel olarak imkânsız sayılacağı; ölçüm cihazının aralığı, kalibrasyonu ve bağımsız kayıtlarla değerlendirilmelidir.

![Eksik, yinelenen ve aykırı kayıtların analiz güvenilirliğine etkisi](images/ppt_context.png)

## Donmuş değer kararlı şebeke kanıtı değildir

Tam olarak 50.000 Hz gibi tekrar eden kayıtlar, tek başına donmuş sensörü kanıtlamaz. Kaynağın çözünürlüğü, kayıt süresi, çevredeki örneklerin davranışı, başka bir ölçüm noktası ve olay bağlamı birlikte incelenmelidir. Kısa bir tekrar dizisi kuantizasyonun doğal sonucu olabilir; uzun ve kusursuz tekrar ise telemetri veya veri işleme sorununa işaret edebilir. Bu nedenle FROZEN bayrağı bir araştırma çağrısıdır, kesin tanı değildir.

## RoCoF neden kalite hatalarına çok hassastır?

RoCoF türev tabanlıdır; zaman aralığındaki küçük hata bile eğimi değiştirir. Zaman damgası kayması, eksik örneğin yanlış doldurulması, tekil spike, ölçüm gürültüsü ve filtre seçimi maksimum RoCoF’u önemli ölçüde etkileyebilir. Merkezî fark, hareketli ortalama veya kayan regresyon kullanılması yalnızca algoritma tercihi değildir; her biri gürültü bastırma ile hızlı değişimi koruma arasında farklı bir denge kurar.

Bu nedenle bir RoCoF sonucu; örnekleme aralığı, kullanılan pencere, filtre, eksik veri politikası ve bayraklanan kayıt sayısından bağımsız raporlanmamalıdır. GridFreq bu bağlamı görünür kılmaya ve aday sorunlu aralıkları ayırmaya yardımcı olur; ölçüm zincirindeki kesin arıza tanısı için kaynağın ham telemetrisi ve cihaz bilgisi gerekir.

Veri kalitesine yapılan yatırım, daha karmaşık bir algoritmadan önce gelir. Güvenilir analiz, olağandışı kaydı saklayan, neden şüpheli olduğunu açıkça belirten ve sonucu bu belirsizlikle birlikte yorumlayan analizdir.
