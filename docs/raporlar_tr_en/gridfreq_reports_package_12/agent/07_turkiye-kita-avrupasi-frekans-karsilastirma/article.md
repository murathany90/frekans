---
title: "Türkiye ve Kıta Avrupası Frekansını Birlikte Okumak"
slug: "turkiye-kita-avrupasi-frekans-karsilastirma"
category: "Karşılaştırmalı Analiz"
reading_time: "12 dk"
language: tr
publication_date: 2026-08-26
status: publish-ready
---

# Türkiye ve Kıta Avrupası Frekansını Birlikte Okumak

**Alt başlık:** Çapraz korelasyon, koherens ve ortak/diferansiyel mod ile iki seri ne anlatır?

Aynı 50 Hz senkron alanındaki iki frekans serisinin neden birebir aynı görünmediğini ve farkın nasıl mühendislik bilgisine dönüştürülebileceğini anlatır.

![Makale başlık görseli](images/hero_cover.jpg)

> **Ana mesaj:** İki frekans serisinin farkı “ölçüm hatası” olmak zorunda değildir; doğru zaman eşlemesiyle yerel ve bölgeler arası dinamikler için güçlü bir gözlem penceresine dönüşebilir.


## Aynı senkron alan, aynı ölçüm değil

Türkiye ile Kıta Avrupası senkron olarak aynı nominal 50 Hz frekansı paylaşır. Ancak iki farklı ölçüm noktasının anlık frekans serileri birebir aynı olmak zorunda değildir. Elektromekanik dalgaların yayılması, yerel üretim-yük dengesi, ölçüm cihazı filtresi ve zaman damgası farkları küçük ayrışmalar oluşturabilir.

Bu nedenle iki seri karşılaştırılırken ilk şart aynı zaman tabanı, aynı örnekleme aralığı ve güvenilir clock synchronization (saat senkronizasyonu) sağlamaktır.


![Aynı senkron alan, aynı ölçüm değil](images/fig01_two_series.png)


## Çapraz korelasyon: benzerlik hangi gecikmede en yüksek?

Cross-correlation (çapraz korelasyon), serilerden birini zaman ekseninde ileri-geri kaydırarak benzerliğin nasıl değiştiğini ölçer. En yüksek korelasyonun oluştuğu gecikme, iki serideki ortak olayların hangi zaman kaymasıyla en iyi hizalandığını gösterir.

Bu gecikme doğrudan “elektriksel yayılma süresi” olarak yorumlanmamalıdır; ölçüm sistemlerinin filtreleri ve veri kaynaklarının yayın gecikmeleri de sonucu etkileyebilir. Gerçek fiziksel çıkarım için ölçüm zinciri gecikmelerinin ayrıca bilinmesi gerekir.


![Çapraz korelasyon: benzerlik hangi gecikmede en yüksek?](images/fig02_coherence.png)


## Koherens: ilişki hangi salınım frekansında güçlü?

Magnitude-Squared Coherence (karesel koherens), iki sinyalin belirli salınım frekanslarında ne kadar birlikte hareket ettiğini 0 ile 1 arasında gösterir. Örneğin 0.2 Hz civarında yüksek koherens, her iki ölçüm noktasında ortak bir düşük frekanslı mod bulunduğuna işaret edebilir.

Cross-spectrum phase (çapraz spektrum fazı) ise aynı modun iki noktadaki faz ilişkisini gösterir. Birden çok ölçüm noktası ve güvenilir saat eşlemesi varsa bölgeler arası salınım şekillerinin incelenmesinde değerli bir araçtır.


## Ortak mod ve diferansiyel mod

Common mode (ortak mod), iki serinin birlikte hareket eden kısmını; differential mode (diferansiyel mod) ise aralarındaki göreli hareketi vurgular. Ortak mod, geniş senkron alanı etkileyen büyük üretim-tüketim dengesizliklerini daha görünür hâle getirebilir.

Diferansiyel mod ise Türkiye’nin Kıta Avrupası referansına göre göreli davranışını, inter-area oscillation (bölgeler arası salınım) ve lokal etkileri incelemek için yararlıdır. Ancak iki noktadan tek başına olayın kaynağını kesin olarak belirlemek çoğu zaman mümkün değildir.


## Pratik bir analiz sırası

Önce veri kalitesini ve zaman damgalarını doğrulayın. Ardından fark serisini ve basit korelasyonu inceleyin. Bir olay veya periyodik davranış varsa Welch PSD ile her iki serinin spektrumunu çıkarın; son aşamada koherens ve faza geçin.

Bu sıra, ileri analizleri veri kalitesi problemi üzerinde çalıştırma riskini azaltır ve görülen faz farklarının gerçekten şebekeden mi yoksa veri boru hattından mı kaynaklandığını ayırmaya yardımcı olur.



## Aynı fiziksel an ile aynı yerel saat aynı şey değildir

Karşılaştırmanın ilk kararı zaman eşleme amacıdır. UTC hizalaması, iki seride aynı fiziksel anda gerçekleşen elektriksel davranışı karşılaştırır. Bir üretim kaybının veya geniş alanlı bozuntunun iki ölçümde nasıl göründüğünü incelemek için doğru başlangıç budur. Yerel saat hizalaması ise benzer günlük tüketim, üretim veya piyasa davranışlarını karşılaştırmaya yardımcı olabilir; aynı fiziksel anı temsil etmeyebilir.

Bu ayrım yaz-kış saati geçişlerinde özellikle önemlidir. Yerel tarih ve saat aynı görünse bile UTC karşılığı farklı olabilir. Örnekleme aralığı, zaman damgası kaynağı, yayın gecikmesi ve yeniden örnekleme adımları kayıt altına alınmadan yapılan bir karşılaştırma, gerçek şebeke farkını veri boru hattı farkıyla karıştırabilir.

![Türkiye ve Kıta Avrupası serilerinde zaman eşleme ve karşılaştırma mantığı](images/ppt_context.png)

## Çapraz korelasyonun söylediği ve söylemediği

Çapraz korelasyon, iki serinin benzerliğini farklı lag (gecikme) değerlerinde ölçer. En yüksek değerin bulunduğu kaydırma, seçilen pencere ve ön işlem altında ortak yapıların en iyi nasıl hizalandığını anlatır. Bu sonuç; ölçüm filtresi, saat ofseti, örnekleme çözünürlüğü, eksik değer işleme ve günlük periyodiklikten etkilenir.

GridFreq’in 1 saniye örneklemeli verisinde bulunan gecikme, milisaniyelik elektromekanik yayılım süresi olarak yorumlanamaz. Böyle bir fiziksel değerlendirme; iyi senkronize edilmiş yüksek çözünürlüklü ölçümler, ölçüm zinciri gecikmelerinin bilinmesi ve birden fazla coğrafi nokta gerektirir. Çapraz korelasyon daha uygun biçimde, hangi zaman aralıklarının ayrıntılı araştırma gerektirdiğini gösteren bir ön tanı aracıdır.

## Koherens ve fazı birlikte okumak

Koherens, iki sinyalin belirli bir frekans bileşenini ne ölçüde birlikte taşıdığını gösterir. Yüksek koherens, o bantta ortak davranış olabileceğine işaret eder; tek başına nedensellik, olay kaynağı veya elektriksel bağlantının yönü anlamına gelmez. Ortak bir dış etken, eşzamanlı denetim davranışı veya benzer veri işleme adımı da koherens üretebilir.

Faz yorumu ancak ilgili bantta koherens yeterince yüksek ve kestirim kararlıysa anlam kazanır. Koherensin zayıf olduğu yerde faz açısı, gürültünün veya kestirim belirsizliğinin sonucu olabilir. Bu nedenle fazı tek başına gecikmeye dönüştürmek, özellikle geniş ve düşük güvenli bantlarda yanıltıcıdır.

## Ortak mod ve diferansiyel mod neyi ayırmaya çalışır?

Ortak mod, iki serinin birlikte hareket eden bileşenini vurgular; geniş senkron alana yayılan yavaş değişimleri incelemek için yararlı olabilir. Diferansiyel mod ise serilerin göreli farkını büyütür ve ölçüm, yerel güç dengesi veya bölgesel davranış farklarını görünür kılar. Bu ayrım, iki eğrinin neden aynı anda hem benzer hem de farklı görünebildiğini anlamaya yardım eder.

İki seriden olayın kesin kaynağını belirlemek çoğu durumda mümkün değildir. Bunun için üretim, hat akışı, gerilim, koruma olayları ve mümkünse daha yüksek çözünürlüklü çok noktalı ölçümler gerekir. GridFreq; ortak ve fark serilerini, korelasyon ve koherens sonuçlarını aynı araştırma akışına koyarak doğru soruların sorulmasına yardımcı olur.

## Sağlam bir karşılaştırma sırası

Önce her iki kaynakta eksik örnek, yinelenen zaman damgası ve örnekleme farkı denetlenmelidir. Sonra seçilen UTC veya yerel saat yaklaşımı açıkça belirtilmeli; ham seriler, fark serisi ve basit korelasyon birlikte görülmelidir. Periyodik bir aday varsa kaynakların spektrumları ve uygun bantta koherens incelenir. Bu sıra, görsel benzerliği fiziksel sonuç sanmadan önce zaman tabanını ve veri kalitesini sınamayı sağlar.
