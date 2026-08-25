---
title: "Yenilenebilir Enerji Artarken Şebeke Ataleti Neden Gündeme Geliyor?"
slug: "yenilenebilir-enerji-dusuk-atalet"
category: "Enerji Dönüşümü"
reading_time: "12 dk"
language: tr
publication_date: 2026-08-26
status: publish-ready
---

# Yenilenebilir Enerji Artarken Şebeke Ataleti Neden Gündeme Geliyor?

**Alt başlık:** Düşük atalet, RoCoF, sönümleme ve esneklik çözümlerini senaryo üzerinden anlamak

Rüzgâr ve güneş entegrasyonunun “yenilenebilir oranı arttı = sistem kararsız” gibi basit bir eşitlik olmadığını; kritik olanın senkron kaynak bileşimi, şebeke gücü ve kontrol yeteneği olduğunu açıklar.

![Makale başlık görseli](images/hero_cover.jpg)

> **Ana mesaj:** Yenilenebilir oranı bir sonuç değil girdidir. Güvenliği belirleyen, o anda şebekede kalan senkron enerji, rezerv hızı, şebeke gücü ve evirici kontrol yeteneğidir.


## Atalet neden azalabilir?

Geleneksel senkron jeneratörler şebekeye doğrudan bağlı dönen kütleleriyle doğal rotational inertia (döner atalet) sağlar. Güneş santralleri ve birçok modern rüzgâr türbini ise inverter (evirici) üzerinden bağlandığı için mekanik enerjileri şebeke frekansına doğrudan bağlı değildir.

Bu yüzden yenilenebilir üretim arttığında aynı anda çok sayıda senkron ünite devreden çıkarılıyorsa sistemdeki doğal kinetik enerji azalabilir. Sonuç, aynı büyüklükteki üretim kaybında daha yüksek RoCoF ve daha erken/derin frekans nadiri olabilir.


![Atalet neden azalabilir?](images/fig01_inertia_scenarios.png)


## Yenilenebilir yüzdesi tek başına kararlılık sınırı değildir

Ekli DIgSILENT PowerFactory senaryosu %15, %20 ve %30 yenilenebilir penetrasyonlarını karşılaştırıyor ve daha yüksek penetrasyonda daha ağır salınımlar gösteriyor. Bu sonuç, kullanılan model, hangi senkron jeneratörlerin devreden çıkarıldığı, yük seviyesi, ağ topolojisi, AVR/PSS ayarları ve yenilenebilir kontrol modelleri için geçerlidir.

Bu nedenle “Türkiye %20’nin üzerinde kararsız olur” gibi bir genelleme teknik olarak doğru değildir. Gerçek işletme sınırı anlık inertia (atalet), short-circuit strength (kısa devre gücü), reserve availability (rezerv mevcudiyeti), transfer seviyeleri ve inverter kontrol özelliklerinin birleşimidir.


![Yenilenebilir yüzdesi tek başına kararlılık sınırı değildir](images/fig02_stability_portfolio.png)


## Düşük ataletin görünen belirtileri

Düşük atalet koşullarında ilk değişen ölçüt genellikle RoCoF’tur. Fakat sistem dayanıklılığını yalnızca RoCoF belirlemez. Primer rezervin ne kadar hızlı geldiği, yüklerin frekans duyarlılığı ve enterkonneksiyon desteği nadir noktasını doğrudan etkiler.

Aynı zamanda inverter ağırlıklı sistemlerde voltage control (gerilim kontrolü), weak-grid interactions (zayıf şebeke etkileşimleri) ve control-system oscillations (kontrol sistemi salınımları) ayrı bir kararlılık konusu hâline gelir.


## Çözüm seti: tek teknoloji değil portföy

Battery Energy Storage System - BESS/BEDS (batarya enerji depolama sistemi), hızlı aktif güç tepkisi sağlayarak frekans nadirini iyileştirebilir. Synchronous condenser (senkron kompansatör) kısa devre gücü ve fiziksel atalet; grid-forming inverter (şebeke oluşturan evirici) ise hızlı frekans ve gerilim desteği sağlayabilir.

Bunlara ek olarak konvansiyonel ünitelerin minimum yüklerinin düşürülmesi, daha hızlı rampalar, HVDC desteği, bölgesel rezerv paylaşımı ve dinamik güvenlik kısıtlarının piyasa/işletme planlamasına eklenmesi gerekir.


## GridFreq ile hangi göstergeler izlenebilir?

Frekansın yalnızca günlük ortalamasına bakmak düşük atalet sorununu göstermez. Olay bazlı maksimum RoCoF, nadir dağılımı, toparlanma süresi, spektral salınım modları ve Türkiye-Kıta Avrupası fark serisi birlikte izlenmelidir.

Zaman içinde aynı büyüklükteki olayların daha yüksek RoCoF üretmeye başlaması, sistem koşullarındaki değişim için güçlü bir erken uyarı göstergesi olabilir; yine de olay büyüklüğü ve işletme noktasıyla normalize edilmeden doğrudan “atalet azaldı” sonucuna gidilmemelidir.



## PowerPoint içeriğiyle genişletilmiş okuma: ağır şebekeden hafif şebekeye

Sunumlarda “ağır şebeke” ve “hafif şebeke” ayrımı çok öğretici bir dille anlatılıyor. Yüksek tüketim saatlerinde çok sayıda senkron makinenin devrede olduğu ağır şebeke, aynı arıza karşısında frekansı daha yavaş kaybeder. Gece saatlerinde veya yüksek rüzgâr/güneş üretiminde senkron makine sayısı azalırsa daha hafif bir şebeke oluşur ve aynı bozuntu daha hızlı bir frekans düşüşü yaratabilir.

Bu yaklaşım, yenilenebilir oranına tek başına değil, o anda sistemde bulunan **senkron enerji**, **rezerv hızı** ve **kontrol teknolojisi** ile birlikte bakmak gerektiğini hatırlatır. Dolayısıyla düşük atalet, yalnızca “yenilenebilir arttı” cümlesiyle açıklanabilecek bir durum değildir.

![Ağır ve hafif şebeke karşılaştırması](images/ppt_context.png)

## Kütleye karşı hız: yanlış ikilem

Sunumlardaki önemli mesajlardan biri de “mekanik atalet mi, dijital hız mı?” sorusunun çoğu durumda yanlış kurulduğudur. Doğru yaklaşım, yeterli fiziksel/dijital tamponu ve yeterince hızlı kontrolü birlikte tasarlamaktır. Bu yüzden makaledeki çözüm portföyü, tek teknolojiye değil hibrit yaklaşıma dayandırılmıştır.


## Kaynaklar ve editoryal not

Bu metin, kullanıcı tarafından sağlanan GridFreq teknik dokümanları temel alınarak hazırlanmıştır. Simülasyon sonuçları model/senaryo bağımlı olarak ifade edilmiştir; mevzuatla ilgili kritik noktalar güncel TEİAŞ/ENTSO-E kaynaklarıyla karşılaştırılmıştır.

- Ekli kaynak: `gridfreq-renewable-penetration-report.pdf`

- Ekli kaynak: `gridfreq-technical-manual.pdf`


> GridFreq bağımsız bir analiz platformudur; metin resmî sistem işletmecisi görüşü değildir.
