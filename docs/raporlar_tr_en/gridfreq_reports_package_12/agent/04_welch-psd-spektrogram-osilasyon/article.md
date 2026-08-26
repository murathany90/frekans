---
title: "Şebeke Salınımlarını Görünür Kılmak"
slug: "welch-psd-spektrogram-osilasyon"
category: "Sinyal İşleme"
reading_time: "13 dk"
language: tr
publication_date: 2026-08-26
status: publish-ready
---

# Şebeke Salınımlarını Görünür Kılmak

**Alt başlık:** Welch PSD ve spektrogram ile frekans verisindeki gizli periyodik davranışları okumak

Frekans grafiğinde çıplak gözle görülmeyen salınımların güç spektral yoğunluğu ve zaman-frekans analiziyle nasıl ayrıştırıldığını sezgisel olarak anlatır.

![Makale başlık görseli](images/hero_cover.jpg)

> **Ana mesaj:** PSD “hangi salınım var?”, spektrogram “ne zaman güçlendi?” sorusunu yanıtlar. İkisini birlikte kullanmak tek başına FFT kullanmaktan daha açıklayıcıdır.


## Zaman grafiği neden bazen yetmez?

Bir günlük frekans eğrisine bakıldığında onlarca küçük dalgalanma üst üste görünür. Oysa bazı dalgalanmalar rastgele gürültü, bazıları düzenli kontrol davranışı, bazıları ise elektromekanik oscillation (salınım) olabilir. Bir sinyalin “hangi periyotlarda tekrar ettiğini” görmek için frekans alanına geçmek gerekir.

Power Spectral Density - PSD (güç spektral yoğunluğu), sinyal enerjisinin hangi salınım frekanslarında yoğunlaştığını gösterir. Buradaki frekans, 50 Hz şebeke frekansı değil; 50 Hz değerinin etrafındaki yavaş dalgalanmanın kendi salınım frekansıdır.


![Zaman grafiği neden bazen yetmez?](images/fig01_welch_psd.png)


## Welch yöntemi neden tercih edilir?

Tek seferlik Fast Fourier Transform - FFT (hızlı Fourier dönüşümü), özellikle gürültülü zaman serilerinde çok pürüzlü bir spektrum üretebilir. Welch yöntemi veriyi kısa ve örtüşen parçalara ayırır, her parçanın spektrumunu hesaplar ve sonuçları ortalar. Böylece rastgele gürültü azalırken tekrarlayan spektral tepeler belirginleşir.

Buradaki ana mühendislik ödünleşimi resolution versus variance (çözünürlük-varyans dengesi) olarak özetlenebilir. Uzun segment daha iyi frekans çözünürlüğü verir; daha çok ve kısa segment ise daha pürüzsüz fakat daha düşük çözünürlüklü bir sonuç oluşturur.


![Welch yöntemi neden tercih edilir?](images/fig02_spectrogram.png)


## Pencereleme ve spektral sızıntı

Analiz penceresi bir salınım periyodunun tam katı değilse enerji komşu frekans kutularına yayılır. Buna spectral leakage (spektral sızıntı) denir. Hann veya Hamming gibi window function (pencere fonksiyonu) seçenekleri uçları yumuşatarak sızıntıyı azaltır.

Dikdörtgen pencere en dar ana loba sahip olsa da yan lobları güçlüdür. Bu yüzden zayıf bir modu güçlü bir komşu bileşenin yanında arıyorsanız Hann/Hamming çoğu zaman daha güvenli bir ilk tercihtir.


## Spektrogram: “ne zaman?” sorusunun cevabı

Welch PSD tüm analiz aralığının ortalama spektral imzasını verir; ancak salınım yalnızca 20 dakika sürdüyse bu süre bilgisi kaybolabilir. Short-Time Fourier Transform - STFT (kısa zamanlı Fourier dönüşümü) tabanlı spektrogram, aynı spektrumu kayan pencerelerle zamana böler.

Grafikte yatay eksen zaman, dikey eksen salınım frekansı, renk/yoğunluk ise spektral güçtür. Böylece bir modun günün hangi saatinde başladığı, güçlendiği ve söndüğü görülebilir.


## Örnekleme hızı hangi salınımları görmemize izin verir?

Spektral yorumun ilk sınırı veri çözünürlüğüdür. GridFreq’in temel tarihsel frekans serileri 1 saniye örnekleme frekansıyla işlenir; bu durumda örnekleme frekansı 1 Hz, Nyquist sınırı 0,5 Hz’tir. Dolayısıyla yaklaşık 0,5 Hz üzerindeki gerçek sinyal bileşenleri bu seriyle güvenilir biçimde incelenemez. Nyquist sınırına çok yaklaşan sonuçlar da filtre, yeniden örnekleme ve sınırlı veri uzunluğuna karşı hassastır.

Bu sınır, 0,8–2 Hz gibi daha yüksek frekanslı yerel elektromekanik modların 1 saniyelik veriden teşhis edilebileceği anlamına gelmez. Bu tür çalışmalar için PMU, disturbance recorder veya daha yüksek hızlı SCADA/ölçüm kaynakları gerekir. Düşük örneklemeli seride görünen bir tepe, daha yüksek frekanslı fiziksel davranışın aliasing etkisiyle farklı bir banda taşınmış görünümü de olabilir. Bu nedenle analiz bandı, kaynak verinin örnekleme hızına göre açıkça sınırlandırılmalıdır.

## Welch PSD’nin arkasındaki mühendislik mantığı

Welch yöntemi, kayıt uzunluğunu üst üste binebilen segmentlere ayırır. Her segmentte ortalamadan arındırma ve bir pencere uygulanır; ardından güç spektrumu hesaplanır ve segment sonuçları ortalanır. Segmentleme, tek bir kısa zaman aralığının rastlantısal davranışına aşırı bağımlılığı azaltır. Örtüşme, aynı veri boyunca daha çok gözlem kullanarak kestirimin kararlılığını artırabilir; ancak birbirinden bağımsız yeni bilgi üretmez.

Pencereleme, sonlu bir kayıt parçasının başı ve sonu arasındaki süreksizliği azaltır. Spektral sızıntı, fiziksel olarak yeni bir mod değil, sonlu gözlem penceresinin enerjiyi komşu frekans kutularına dağıtmasıdır. Ortalama alma varyansı düşürür ve tekrar eden bileşenleri daha görünür kılar; bunun karşılığında segment uzunluğu kısaldıkça frekans çözünürlüğü azalır. Bu nedenle segment boyu, örtüşme ve pencere seçimi raporlanmadan iki PSD eğrisinin doğrudan karşılaştırılması doğru değildir.

![Zaman alanı, spektral analiz ve karşılaştırmalı inceleme arasındaki ilişki](images/ppt_context.png)

## Spektrogramın eklediği zaman bağlamı

PSD, analiz aralığı boyunca **hangi frekanslarda enerji bulunduğu** sorusuna cevap verir. Spektrogram ise aynı hesabı kayan pencerelerde yaparak **bu enerji ne zaman ortaya çıktı** sorusuna yaklaşır. Bir tepenin sadece belirli bir olaydan sonra görünmesi, düzenli olarak günün aynı saatinde yinelenmesi veya tüm gün boyunca kalması farklı mühendislik yorumları gerektirir.

Pencere süresi burada da ödünleşim yaratır. Uzun pencere frekans çözünürlüğünü artırırken kısa süreli değişimlerin zamanını bulanıklaştırır; kısa pencere ise değişimin zamanını daha iyi gösterir fakat frekansları daha kaba ayırır. Renk ölçeği ve normalizasyon seçimi de zayıf yapıların görünürlüğünü etkilediği için sonuçla birlikte saklanmalıdır.

## Bir PSD tepesini hemen “salınım modu” kabul etmemek

Spektral tepe tek başına kararsızlık veya fiziksel mod kanıtı değildir. Veri boşlukları, örnek tutarsızlığı, yeniden örnekleme, filtre artefaktı ve ölçüm sistemindeki periyodik davranışlar tepe üretebilir. Saatlik ya da dakikalık piyasa, yük ve denetim döngüleri de frekans serisinde tekrar eden bileşenler oluşturabilir. Aday davranışın sürekliliği, farklı kaynaklarda tutarlılığı, olayla zaman ilişkisi ve mümkünse daha yüksek çözünürlüklü ölçümlerle uyumu birlikte aranmalıdır.

GridFreq, zaman alanındaki olay adaylarıyla PSD ve spektrogram bulgularını yan yana getirmeyi destekler. Bu yaklaşım, hangi zaman aralıklarının ayrıntılı ölçüm kaydıyla incelenmesi gerektiğini görünür kılar. Platformtaki 1 saniyelik tarihsel seriden yüksek frekanslı yerel mod, milisaniyelik etkileşim veya kesin kök neden çıkarıldığı iddia edilmemelidir.

## Analizi doğru soruyla başlatmak

Ani bir değişim için zaman serisi, minimum/maksimum ve RoCoF; tekrarlayan düşük frekanslı davranış için PSD; zamanla değişen periyodiklik için spektrogram; iki seri arasındaki ortaklık için koherens uygundur. Araçlar aynı olguyu farklı açılardan gösterir. Güvenilir bir sonuç, tek bir parlak tepeye değil, veri kalitesi ve fiziksel bağlamla uyumlu birden çok göstergeye dayanır.

## Parametreleri değiştirmek sonucu neden değiştirir?

Analiz penceresinin başlangıç ve bitişi, ortalamadan arındırma yöntemi, segment uzunluğu, örtüşme, pencere fonksiyonu ve güç ölçeği PSD’nin görünümünü değiştirebilir. Bu değişim tek başına hataya işaret etmez; kestirimin hangi soruya göre ayarlandığını gösterir. Kısa süreli aday davranış aranıyorsa zaman yerelleştirmesi, uzun dönemli istatistik aranıyorsa frekans çözünürlüğü daha ağır basabilir.

Karşılaştırmalı incelemede aynı parametrelerin iki seri için korunması önemlidir. Aksi hâlde iki tepe arasındaki farkın şebeke davranışından mı yoksa hesap ayarından mı doğduğu belirsizleşir. Özellikle 1 saniyelik serilerde analiz bandı Nyquist sınırının güvenli alt bölgesiyle sınırlanmalı; daha yüksek modlar için sonuç üretmek yerine uygun ölçüm kaynağı istenmelidir.
