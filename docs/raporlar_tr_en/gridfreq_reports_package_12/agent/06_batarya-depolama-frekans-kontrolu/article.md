---
title: "Batarya Depolama Frekans Kontrolünde Ne Kadar Hızlı, Ne Kadar Uzun?"
slug: "batarya-depolama-frekans-kontrolu"
category: "Depolama"
reading_time: "13 dk"
language: tr
publication_date: 2026-08-26
status: publish-ready
---

# Batarya Depolama Frekans Kontrolünde Ne Kadar Hızlı, Ne Kadar Uzun?

**Alt başlık:** BEDS/BESS için güç, enerji, SOC ve 2026 TEİAŞ teknik kriterlerini birlikte okumak

Bataryanın “çok hızlı” olmasının tek başına yeterli olmadığını; MW tepki, MWh enerji kapasitesi, SOC sınırları ve yeniden depolama stratejisinin birlikte tasarlanması gerektiğini açıklar.

![Makale başlık görseli](images/hero_cover.jpg)

> **Ana mesaj:** Tepkinin büyüklüğünü MW, sürdürülebilirliğini MWh ve SOC; ne kadar hızlı gerçekleşeceğini ise ölçüm–kontrol–inverter zincirinin gecikmesi ve rampa kabiliyeti belirler.


## Güç ile enerji aynı şey değildir

Bir batarya 100 MW güç verebilir fakat bu, 100 MW’ı ne kadar süre sürdürebileceğini söylemez. Power (güç, MW) anlık tepki kapasitesini; energy (enerji, MWh) ise bu tepkinin süreyle çarpılmış enerji bütçesini temsil eder.

Frekans hizmetlerinde hızlı cevap için güç elektroniği kapasitesi, uzun süreli rezerv içinse kullanılabilir enerji ve State of Charge - SOC (şarj durumu) birlikte belirleyicidir.


![Güç ile enerji aynı şey değildir](images/fig01_bess_power_energy.png)


## TEİAŞ 2026 PFK çerçevesinde depolama

TEİAŞ’ın 03 Temmuz 2026 tarihli güncel prosedürüne göre PFK’ya katılacak depolama ünite/tesisleri için iletim sistemine bağlı olma ve en az 30 MW depolama kurulu gücü gibi koşullar tanımlanmıştır. 200 mHz’lik frekans sapmasında rezervin %50’sinin en geç 15 saniyede, tamamının en geç 30 saniyede etkinleştirilmesi; tepki gecikmesinin 2 saniyeyi aşmaması ve çıkışın en az 15 dakika sürdürülebilmesi istenir.

Aynı doküman, her bir saat için reserve energy capacity / reserve power capacity (rezerv enerji kapasitesi / rezerv güç kapasitesi) oranının en az 1.25 olmasını ve PFK’nın azami ±10 mHz ölü bantla sağlanabilmesini ister.


![TEİAŞ 2026 PFK çerçevesinde depolama](images/fig02_soc_reserve.png)


## SOC neden bir kontrol değişkenidir?

SOC çok düşükse batarya pozitif rezerv (şebekeye güç verme) için enerjisiz kalabilir; çok yüksekse negatif rezerv (şebekeden güç çekme) için şarj alanı kalmaz. Bu nedenle çift yönlü frekans hizmetinde orta SOC bölgesi operasyonel esneklik sağlar.

2026 TEİAŞ prosedürü enerji yeterliliği izlenirken işletme doluluk alt sınırını %5, üst sınırını %95 kabul eden ve hesaplanan sınırlara ilave güvenlik marjı uygulayan bir yaklaşım tarif eder. Bu, “bataryayı hep %50’de tutmak gerekir” gibi tek bir sabit reçeteden daha esnek bir enerji yönetimi gerektirir.


## Hızlı frekans kontrolü ve atalet desteği

Bataryalar klasik PFK’dan daha hızlı davranabilir. TEİAŞ 2026 prosedürü Fast Frequency Control (hızlı frekans kontrolü) ile Inertia Support Service (atalet destek hizmeti) kavramlarını ayrıca tanımlar. Atalet desteğinde Phase Jump (faz açısı sıçraması) ve RoCoF (frekans değişim hızı) tepkileri özellikle anılır.

Bu hizmetlerin kontrol tasarımı klasik droop (hız eğimi) denetiminden farklı olabilir. Aşırı yüksek kazanç, ölçüm gürültüsünü büyütebilir ve SOC’yi hızlı tüketebilir; bu nedenle güç sınırı, ramp rate (rampa hızı), filtre ve enerji toparlama mantığı birlikte tasarlanmalıdır.


## Ekonomi ve ömür

Batarya frekans hizmeti verirken çok sayıda küçük şarj-deşarj döngüsü yaşar. Bu döngüler cycle aging (döngüsel yaşlanma), yüksek SOC’de uzun bekleme ise calendar aging (takvim yaşlanması) üzerinde etkili olabilir.

Optimum kontrol yalnızca en yüksek yan hizmet gelirini değil; hücre sıcaklığını, SOC aralığını, derin deşarjı, verimi ve uzun vadeli kapasite kaybını da hesaba katmalıdır. Kaynak teknik rehber, deadband (ölü bant), depth of discharge - DOD (deşarj derinliği) ve SOC hedefinin çok kriterli optimizasyonla birlikte seçilmesini önerir.



## Bataryanın hızı nereden gelir?

MW, bataryanın anlık aktif güç kapasitesini tanımlar; tepkinin başlangıç hızını tanımlamaz. Hız; frekans ölçümü, filtreleme, denetleyici kararı, gerekli ise haberleşme ve inverterin akım/rampa kabiliyeti boyunca oluşan gecikmelerin toplamıdır. Çok kısa yanıt süreleri mümkün olabilir, ancak bunlar teknoloji, denetim tasarımı, ölçüm kalitesi ve bağlı olduğu şebekenin koşullarına bağlıdır.

MWh ise enerji bütçesidir. Aynı 100 MW güç, farklı MWh kapasitelerinde çok farklı sürelerde sürdürülebilir. SOC, bu bütçenin olay anında hangi yönde erişilebilir olduğunu gösterir. Frekans düştüğünde güç verme yönünde, frekans yükseldiğinde şarj/güç çekme yönünde ayrı baş boşlukları gerekir. Bu üç kavramı birbirine karıştırmak, özellikle iki yönlü rezervin gerçekte ne kadar kullanılabilir olduğunu gizler.

![Batarya frekans hizmetinde güç, enerji ve denetim zaman ölçeğinin birlikte değerlendirilmesi](images/ppt_context.png)

## Pozitif ve negatif rezerv neden aynı SOC problemini yaratmaz?

Düşük SOC, bataryanın şebekeye ek güç verme kabiliyetini sınırlar; hücrelerde kullanılabilir enerji kalmamış olabilir. Yüksek SOC ise güç çekme veya şarj etme yönünde alanı sınırlar. Bu nedenle orta SOC hedefi, çift yönlü hizmet için yararlı bir başlangıç noktasıdır; ancak tek bir sabit yüzde bütün batarya kimyaları, sıcaklık koşulları ve rezerv sözleşmeleri için optimum değildir.

Denetleyici, gün içi planlanan hizmet, beklenen olay olasılığı, verim kayıpları ve hücre sınırlarına göre pozitif ve negatif marjları ayrı izlemelidir. İnverterin MW limiti yüksek olsa bile SOC veya sıcaklık limiti nedeniyle bu limitin tamamı her an kullanılamayabilir. Kullanılabilir rezerv, isim levhası değerinden değil bu anlık sınırların kesişiminden doğar.

## Olay bittikten sonra ne olur?

Frekans olayı sonrasında bataryanın hedef SOC’ye veya baz güç düzeyine dönmesi gerekir. Bu **SOC toparlama** işlemi, olay sırasında sağlanan gücün tersini uygularsa yeni bir güç dengesizliği ve rebound etkisi oluşturabilir. Bu nedenle geri dönüş, yeterli rampa sınırı ve sistemdeki diğer rezervlerle koordine edilmelidir. İlk olaya hızlı ve doğru yanıt veren bir batarya, kontrolsüz toparlanma nedeniyle sonraki dakikalarda yeni bir sorun yaratabilir.

Sürdürülebilirlik değerlendirmesi bu yüzden yalnızca ilk saniyelerdeki güç eğrisini değil, olay sonu enerji durumunu ve yeniden hazır olma süresini de içerir. Sık çağrılan bir hizmette çevrim derinliği, sıcaklık, verim ve yardımcı tüketimler kullanılabilir kapasiteyi zamanla değiştirebilir.

## Güç elektroniği ile enerji yönetimini birlikte tasarlamak

İnverter güç limiti, akım sınırı ve rampa kabiliyeti ilk tepkide belirleyicidir. Enerji limiti ve SOC ise desteğin ne kadar süre devam edeceğini belirler. Yüksek sıcaklık, soğutma gereksinimi, verim kaybı, cycle aging (döngüsel yaşlanma) ve calendar aging (takvim yaşlanması) uzun vadeli işletme zarfını daraltabilir. Bu sınırlar, çok hızlı bir kısa süreli desteğin her zaman yüksek değerli ve güvenli olduğu anlamına gelmediğini gösterir.

Bataryalar klasik senkron atalet üretmez; ancak uygun tasarlanmış hızlı aktif güç desteğiyle frekans nadirini iyileştirmeye katkı sağlayabilir. Hizmetin performansı, yalnızca etkileyici başlangıç rampasıyla değil, ölçüm gürültüsüne dayanıklılık, MW limiti, enerji yeterliliği, iki yönlü SOC marjı ve kontrollü toparlanma ile ölçülmelidir. GridFreq, frekans eğrisinin bu hizmetlerle uyumlu aday davranışlarını görünür kılar; bir batarya tesisinin uygunluk kararı ise tesis telemetrisi ve geçerli teknik prosedürle yapılır.

## Hizmet tasarımında gerçekçi performans zarfı

Frekans hizmeti için ilan edilen kapasite, bataryanın her sıcaklıkta ve her SOC’de sağlayabildiği azami anlık güç değildir. Kullanılabilir zarf; hücre sıcaklığı, dönüştürücü limiti, yardımcı tüketimler, verim, eşzamanlı piyasa yükümlülükleri ve koruma ayarlarıyla daralabilir. Bu nedenle güç, enerji ve süre taahhüdü aynı işletme senaryosunda birlikte doğrulanmalıdır.

İyi bir tasarım, bataryayı yalnızca en büyük olaya göre boyutlamaz. Küçük fakat sık çağrılarda yaşlanma ve SOC sürüklenmesini, büyük olaylarda ise enerji ve rampa sınırını hesaba katar. Böylece hızlı dijital destek, kısa süreli etkileyici bir tepki olmaktan çıkar ve tekrar çağrılabilir bir sistem hizmetine dönüşür.
