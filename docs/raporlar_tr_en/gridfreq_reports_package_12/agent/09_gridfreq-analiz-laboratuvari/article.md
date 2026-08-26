# GridFreq Analiz Laboratuvarı: Zaman Uzayından Frekans Uzayına

**Alt başlık:** Tek bir frekans eğrisinden olay, kalite ve salınım adaylarını nasıl incelemeli?

GridFreq Analiz Laboratuvarı, frekans serisini yalnızca çizilecek bir zaman dizisi olarak değil; olay davranışı, veri güvenilirliği ve düşük frekanslı periyodik yapı hakkında sorular sorulabilecek bir mühendislik sinyali olarak ele alır. Amaç, tek bir düğmeyle kesin hüküm vermek değil; farklı yöntemlerin hangi soruya cevap verdiğini aynı araştırma akışında görünür kılmaktır.

![Makale başlık görseli](images/hero_cover.jpg)

> **Ana mesaj:** Güvenilir analiz, doğru yöntemi seçmekten önce doğru soruyu, doğru zaman penceresini ve verinin sınırlarını tanımlamayı gerektirir.

## Hangi mühendislik sorusuna hangi analiz yöntemi cevap verir?

Ani bir üretim kaybı veya yük değişimi adayında ilk araç zaman serisidir. Başlangıç frekansı, minimum/maksimum değer, frekans nadiri, toparlanma biçimi ve Rate of Change of Frequency - RoCoF (frekans değişim hızı) birlikte incelenir. Bu görünüm, olayın ne zaman başladığını ve hangi zaman penceresinin ayrıntılı işletme kaydıyla karşılaştırılması gerektiğini gösterir.

Tekrarlayan davranış için Welch Power Spectral Density - PSD (güç spektral yoğunluğu) kullanılır. PSD, seçilen zaman aralığında hangi düşük frekans bileşenlerinin belirgin olduğunu araştırır. Zamanla değişen periyodiklikte spektrogram, enerji yoğunluğunun ne zaman ortaya çıktığını gösterir. İki seri arasındaki ilişki için çapraz korelasyon farklı gecikmelerdeki benzerliği; koherens ise belirli frekanslarda birlikte davranışı inceler. Faz, ancak koherens yeterince yüksek olduğunda anlamlı bir tamamlayıcı ölçüttür.

![Zaman alanı, frekans alanı ve karşılaştırmalı analiz araçlarının ilişkisi](images/ppt_algorithm_map.png)

## Veri güvenilirliği analizden ayrı değildir

Completeness (tamlık), eksik kayıt, yinelenen zaman damgası, frozen/spike adayları ve örnekleme düzeni her yöntemin güvenilirliğini etkiler. Özellikle RoCoF türev tabanlı olduğu için tek bir zaman kayması veya spike fiziksel olmayan büyük bir tepe üretebilir. PSD ve koherens için de örnekleme hızı, boşlukların nasıl ele alındığı ve analiz bandı sonucu belirler.

Bu nedenle laboratuvarın doğru çalışma sırası; önce veri kaynağını ve zaman aralığını tanımlamak, sonra kalite bayraklarını incelemek, ardından zaman veya frekans alanı yöntemini seçmektir. 1 saniye örneklemeli tarihsel veri için Nyquist sınırı yaklaşık 0,5 Hz’tir; bunun üzerindeki fiziksel bileşenlerin güvenilir analizi daha yüksek hızlı ölçüm gerektirir.

## GridFreq neyi yapar, neyi tek başına yapamaz?

GridFreq; aday olayları, anomali örüntülerini ve düşük frekanslı salınım yapılarını görünür kılar; tarihsel aralıkları karşılaştırmaya ve ön tanı oluşturmaya yardım eder. Bu, inceleme süresini doğru aralığa yöneltmek açısından değerlidir. Buna karşılık platform, yalnızca frekans serisinden kesici işleminin hangi noktada gerçekleştiğini, üretim kaybının kesin kaynağını veya olayın kök nedenini tek başına belirleyemez.

Gerçek root cause analysis (kök neden analizi) için üretim kayıtları, hat akışları, gerilim ölçümleri, kesici ve koruma kayıtları, PMU, SCADA, disturbance recorder ve işletme olay kayıtları gerekebilir. Frekans eğrisinde aynı biçimi yaratan farklı fiziksel nedenler bulunabilir. Bu sınırlamayı açık tutmak, platformun bilimsel güvenilirliğinin temelidir.

## Yeniden üretilebilir araştırma akışı

Her analizde kaynak, zaman dilimi, örnekleme çözünürlüğü, seçilen yöntem, parametreler ve kalite durumu birlikte kaydedilmelidir. Bir PSD tepesinin segment uzunluğu ve penceresi belirtilmeden, bir RoCoF değerinin filtre ve zaman aralığı belirtilmeden karşılaştırılması zayıf kanıt üretir. Aynı veri ve aynı parametrelerle aynı sonuca ulaşılabilmesi; karşılaştırma, hata ayıklama ve metodolojik eleştiri için gereklidir.

![Veri toplama, doğrulama, normalizasyon ve istemci analizi arasındaki akış](images/ppt_pipeline.png)

Tarihsel verinin otomatik toplama, doğrulama, UTC normalizasyonu ve uygun biçimde paketlenme aşamalarından geçmesi; tarayıcıdaki analizin daha hızlı ve izlenebilir olmasına katkı sağlar. Bununla birlikte veri paketinin güncelliği, kaynak gecikmesi ve cihaz performansı sonuç yorumunun parçasıdır. Büyük zaman aralıklarında hesaplama süresi, tarayıcı belleği ve görselleştirme çözünürlüğü sınır oluşturabilir.

## Mühendislik sonucu

Analiz Laboratuvarı en iyi, yöntem seçimini otomatikleştiren bir kara kutu olarak değil; mühendislik muhakemesini yapılandıran bir çalışma ortamı olarak kullanılır. Ani olayda zaman alanı, periyodik davranışta PSD ve spektrogram, iki seri ilişkisinde korelasyon ile koherens ve her aşamada veri kalitesi birlikte ele alındığında frekans eğrisi daha anlamlı hâle gelir. Sonuç, kesin kök neden değil; daha ayrıntılı işletme verisiyle sınanabilecek şeffaf bir ön tanıdır.

## Örnek bir inceleme akışı

Bir günün frekans eğrisinde ani bir düşüş görüldüğünde önce zaman damgaları ve eksik örnekler denetlenir. Ardından başlangıç frekansı, ilk eğim, minimum değer ve toparlanma bölgesi aynı pencerede ölçülür. Benzer bir biçim farklı günlerde tekrar ediyorsa, olay büyüklüğü ve işletme koşulları erişilebildiği ölçüde karşılaştırılır. Bu aşama, adayın fiziksel olay mı yoksa veri sorunu mu olabileceğini ayırmaya yardım eder.

Uzun süreli tekrar aranıyorsa analiz penceresi, örnekleme hızı ve Nyquist sınırı belirtildikten sonra PSD’ye geçilir. Belirgin bir düşük frekanslı yapı bulunursa spektrogram, bunun kalıcı mı yoksa belirli bir zamana bağlı mı olduğunu sınar. İki kaynak aynı araştırmaya katılıyorsa UTC hizalaması, çapraz korelasyon ve yalnızca güvenilir bantta koherens eklenir. Her adımda sonuçtan çok kanıt zinciri önemlidir: veri kalitesi zayıfsa sonraki hesap daha karmaşık olsa bile daha güvenilir olmaz.
