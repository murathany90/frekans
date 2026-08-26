---
title: "Frekans Kontrolünün Üç Savunma Hattı"
slug: "frekans-kontrolunun-uc-savunma-hatti"
category: "Yan Hizmetler"
reading_time: "11 dk"
language: tr
publication_date: 2026-08-26
status: publish-ready
---

# Frekans Kontrolünün Üç Savunma Hattı

**Alt başlık:** PFK/FCR, SFK/aFRR ve mFRR hangi sırayla, hangi amaçla çalışır?

Primer, sekonder ve manuel frekans rezervlerinin birbirinin alternatifi değil, farklı zaman ölçeklerinde çalışan tamamlayıcı katmanlar olduğunu açıklar.

![Makale başlık görseli](images/hero_cover.jpg)

> **Ana mesaj:** Kontrol katmanlarını “kim daha hızlı?” sorusuyla değil, “hangi problemi hangi zaman ölçeğinde çözüyor?” sorusuyla okuyun.


## Neden tek bir kontrol katmanı yetmez?

Bir şebeke arızası milisaniyeler içinde başlar fakat ekonomik ve güvenli yeni işletme noktasına dönmek dakikalar alabilir. Bu nedenle frekans kontrolü tek bir regülatöre bırakılmaz. Kontrol mimarisi, en hızlı fiziksel tepkiden operatör ve piyasa kararlarına kadar katmanlara ayrılır.

İlk katman olayı tutar, ikinci katman frekansı ve bölgesel dengeyi geri getirir, üçüncü katman ise kullanılan rezervleri yeniler ve sistemin bir sonraki arızaya hazır olmasını sağlar.


![Neden tek bir kontrol katmanı yetmez?](images/fig01_control_layers.png)


## PFK / FCR: düşüşü durdurma katmanı

Primary Frequency Control - PFK/FCR (primer frekans kontrolü / frekans tutma rezervi) yerel ve otomatik çalışır. Jeneratör hız regülatörü veya uygun bir güç elektroniği kontrolörü frekans sapmasını algılar ve aktif güç çıkışını değiştirir.

PFK’nın temel hedefi 50.00 Hz’e dönmek değildir. Asıl görev frekansın daha fazla uzaklaşmasını engellemek ve sistemi yeni bir geçici denge noktasında tutmaktır. Bu ayrım önemlidir; primer kontrolün “başarılı” olduğu bir olayın sonunda frekans hâlâ nominalden farklı olabilir.


![PFK / FCR: düşüşü durdurma katmanı](images/fig02_layer_purpose.png)


## SFK / aFRR: nominale dönüş ve bölgesel denge

Automatic Frequency Restoration Reserve - aFRR (otomatik frekans restorasyon rezervi), Türkiye terminolojisinde Sekonder Frekans Kontrolü - SFK ile ilişkilidir. Merkezi AGC (otomatik üretim kontrolü) sistemi, frekans ve enterkonneksiyon program sapmalarını değerlendirerek katılımcı ünitelere yeni aktif güç hedefleri gönderir.

Bu katman primer rezervi serbest bırakır. Böylece FCR sürekli dolu tutulan bir “ilk yardım çantası” gibi bir sonraki büyük bozuntu için yeniden hazır hâle gelir.


## mFRR ve işletme optimizasyonu

Manually Activated Frequency Restoration Reserve - mFRR (manuel etkinleştirilen frekans restorasyon rezervi) daha uzun zaman ölçeğinde devreye alınır. Amaç, otomatik rezervleri değiştirmek, sistem yedeklerini yeniden dağıtmak ve işletmeyi güvenlik kısıtları altında daha ekonomik bir noktaya taşımaktır.

Avrupa terminolojisinde FCR, aFRR, mFRR ve gerektiğinde Replacement Reserve - RR (yerine koyma rezervi) birbiriyle tanımlı bir süreç içinde çalışır. Terminoloji ülkeden ülkeye değişebileceği için “primer-sekonder-tersiyer” ifadelerini modern Avrupa rezerv adlarıyla birebir eşitlemek yerine işlev ve zaman ölçeği üzerinden karşılaştırmak daha güvenlidir.


## FFR ve yeni nesil katmanlar

Fast Frequency Response - FFR (hızlı frekans tepkisi), düşük ataletli sistemlerde klasik regülatör tepkisinden daha erken devreye girebilen güç elektroniği tabanlı bir destektir. Bataryalar, HVDC bağlantıları ve grid-forming inverter (şebeke oluşturan evirici) kontrol stratejileri bu alanda öne çıkar.

TEİAŞ’ın Temmuz 2026 tarihli depolama teknik kriterleri ayrıca “hızlı frekans kontrol hizmeti” ile “atalet destek hizmeti” kavramlarını tanımlamıştır. Bu durum Türkiye’de depolamanın frekans güvenliğindeki rolünün yalnızca klasik PFK ile sınırlı kalmadığını gösterir.



## Kontrol katmanlarını işlev ve zaman ölçeğiyle okumak

Rezerv mimarisinin amacı üç ayrı soruya cevap vermektir: frekans sapmasının büyümesi nasıl durdurulacak, nominal frekans ve kontrol alanı dengesi nasıl geri kazanılacak, kullanılan kapasite nasıl yenilenecek? PFK/FCR ilk soruya odaklanır. Yerel frekans ölçümüyle otomatik çalışan denetleyici, frekans düştüğünde aktif gücü artırır veya frekans yükseldiğinde azaltır. Bu denetim, sistemi ilk aşamada stabilize eder; nominal frekansa tek başına ve her koşulda tam dönüş sağlamak zorunda değildir.

SFK/aFRR ikinci görevi üstlenir. AGC, kontrol alanının frekans ve enterkonneksiyon program sapmasını izler; katılımcı kaynaklara güncellenmiş güç hedefleri gönderir. Böylece frekans restorasyonu yapılırken primer rezervin sürekli kullanımda kalması önlenir. Aynı kısa devre eğimi, aynı kontrol kazancı veya aynı aktivasyon süresi bütün sistemlerde geçerli değildir. Hizmet tasarımı ve şebeke kodu, bu işlevin hangi kaynakla ve hangi performans gerekliliğiyle sağlanacağını belirler.

![Frekans kontrol katmanlarının amaç ve zaman ölçeği ilişkisi](images/ppt_context.png)

## Yerel kontrol ile merkezi kontrol arasındaki fark

Governor ya da inverter denetleyicisi, ölçtüğü yerel frekans sapmasına doğrudan yanıt verir. Bu davranış haberleşme veya merkezi optimizasyon beklemeden çalışabilir; bu yüzden ilk stabilizasyon için değerlidir. Ancak yerel denetleyici, kontrol alanındaki tüm üretim-tüketim dengesini, sınır ötesi program sapmasını veya rezerv tahsisini tek başına göremez.

AGC ise daha geniş bir resmi kullanır. Ölçümleri, planlı enterkonneksiyon değişimlerini ve katılımcı birimlerin kullanılabilirliğini birlikte değerlendirerek hedef dağıtır. Merkezi denetim daha yavaş olabilir; buna karşılık frekansı nominale yaklaştırma, alan kontrol hatasını azaltma ve rezervleri koordine etme işlevi taşır. Yerel ve merkezi denetim rakip değildir: biri bozuntunun ilk etkisini sınırlar, diğeri sistemi sürdürülebilir işletme noktasına götürür.

## mFRR, RR ve rezerv yenilemesi

mFRR, daha uzun zaman ölçeğinde operatör kararı veya tanımlı aktivasyon süreçleriyle devreye alınır. Otomatik rezervlerin yerini almak, uzun süren dengesizlikleri yönetmek ve yeniden sevk kararlarına zaman kazandırmak için kullanılır. Replacement Reserve - RR ise uygulanabildiği mimarilerde daha uzun süreli kapasite yenilemesine katkı sağlar. Bu adların ülkeler arasında aynı iş akışını zorunlu olarak temsil etmediği unutulmamalıdır; PFK/FCR, SFK/aFRR ve mFRR etiketlerini birebir eş anlamlı kabul etmek yerine ilgili prosedürdeki amaç, aktivasyon biçimi ve süreklilik şartı incelenmelidir.

## Hızlı frekans tepkisi klasik primer kontrolden neden farklı olabilir?

Fast Frequency Response - FFR (hızlı frekans tepkisi), çoğunlukla batarya, HVDC veya inverter tabanlı kaynakların çok kısa zamanda güç değiştirebilmesinden yararlanır. Klasik governor tepkisi ile aynı sistem yararına hizmet edebilir; yine de fiziksel mekanizması ve işletme sınırları farklıdır. FFR’nin ulaştığı güç, inverterin akım ve MW limitiyle; sürdürülebileceği süre ise kullanılabilir enerji, şarj durumu ve hizmet kuralıyla sınırlıdır.

Çok hızlı olmak tek başına yeterli değildir. Ölçüm filtresi yanlış ayarlanırsa gürültü tetikleme yaratabilir; haberleşmeli şemalarda gecikme eklenebilir; güç geri çekilirken oluşan rebound etkisi yeni bir dengesizlik doğurabilir. Bu nedenle FFR, klasik primer kontrolün otomatik ikamesi olarak değil, uygun koordinasyon ve enerji yönetimi gerektiren tamamlayıcı bir hizmet olarak değerlendirilmelidir.

## GridFreq üzerinde ne aranmalı?

Frekans serisi, farklı katmanların etkisini doğrudan etiketlemez; fakat ilk eğim, nadir, plato ve restorasyon bölgesi hakkında ipuçları verir. GridFreq’te bu biçimi karşılaştırmak, rezervlerin zaman ölçeğiyle uyumlu görünüp görünmediği konusunda ön tanı sağlar. Kesin performans değerlendirmesi için güç komutları, birim telemetrisi, AGC kayıtları ve yürürlükteki hizmet ölçütleri aynı zaman ekseninde incelenmelidir.

İyi tasarlanmış bir kontrol hiyerarşisi, yalnızca en hızlı kaynağı seçmez. Her katmanın neyi koruduğunu, ne zaman devreye girdiğini, ne kadar süre enerji sağlayabildiğini ve ayrıldıktan sonra hangi rezervin yerini dolduracağını açıkça tanımlar.

## Rezerv yeterliliği neden sadece MW toplamı değildir?

Rezerv portföyü değerlendirilirken toplam sözleşme MW’ı başlangıç noktasıdır; kullanılabilirlik ise daha geniş bir sorudur. Kaynağın mevcut çalışma noktası, yukarı ve aşağı yön baş boşluğu, rampa kabiliyeti, enerji süresi, iletim kısıtı ve aynı anda yaşanabilecek başka bir olay bu toplamı değiştirebilir. Birden çok kaynak aynı büyüklükte güce sahip olsa da etkinleşme sıraları ve sürdürülebilirlikleri farklı olabilir.

Bu nedenle işletme planında yeterlilik, olay büyüklüğü ile eşleşen güç kadar rezervin yerini kimin, hangi sürede ve hangi ağ koşulunda dolduracağını da içerir. Frekans kontrol hiyerarşisi, bu ardışıklığı görünür kıldığı için yalnızca yan hizmet sınıflandırması değil, sistem güvenliği tasarımıdır.
