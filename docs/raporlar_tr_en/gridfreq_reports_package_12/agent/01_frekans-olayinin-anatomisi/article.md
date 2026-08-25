---
title: "Bir Frekans Olayının Anatomisi"
slug: "frekans-olayinin-anatomisi"
category: "Şebeke Dinamikleri"
reading_time: "10 dk"
language: tr
publication_date: 2026-08-26
status: publish-ready
---

# Bir Frekans Olayının Anatomisi

**Alt başlık:** RoCoF, frekans nadiri, toparlanma ve kontrol rezervlerini bir olay eğrisi üzerinden okumak

Büyük bir üretim kaybı sonrasında frekans eğrisinin neden önce hızla düştüğünü, en düşük noktaya nasıl ulaştığını ve hangi kontrol katmanlarıyla toparlandığını formül yüküne boğmadan açıklar.

![Makale başlık görseli](images/hero_cover.jpg)

> **Ana mesaj:** Tek bir sayı yerine olayın zaman çizgisini okuyun: RoCoF ilk savunmayı, nadir güvenlik marjını, toparlanma ise rezerv koordinasyonunu anlatır.


## Frekans neden değişir?

Elektrik şebekesinde aktif güç üretimi ile tüketim her an birbirine çok yakın olmak zorundadır. Büyük bir üretim ünitesi devreden çıktığında denge bozulur ve senkron jeneratörlerin rotorlarında depolanan kinetik enerji açığı kısa süreliğine karşılamaya başlar. Rotorların yavaşlaması, sistem frekansının düşmesi olarak gözlenir.

Bu ilk tepkiye inertia response (atalet yanıtı) denir. Atalet bir kum torbası gibi arızayı ortadan kaldırmaz; yalnızca frekansın ne kadar hızlı değişeceğini sınırlar. Bu nedenle aynı MW büyüklüğündeki iki üretim kaybı, farklı atalet koşullarında çok farklı frekans eğrileri oluşturabilir.


![Frekans neden değişir?](images/fig01_frequency_event.png)


## Bir olay eğrisindeki dört kritik bölge

İlk saniyelerde Rate of Change of Frequency - RoCoF (frekans değişim hızı) izlenir. RoCoF ne kadar büyükse frekans o kadar hızlı uzaklaşıyor demektir. Ardından frequency nadir (frekansın en düşük noktası) gelir. Nadir, sistemin koruma eşiklerine ne kadar yaklaştığını gösteren en görünür sonuçtur.

Nadir sonrasında Primary Frequency Control / FCR (primer frekans kontrolü / frekans tutma rezervi) devreye girerek düşüşü durdurur. Sonraki aşamada Frequency Restoration Reserve - FRR (frekans restorasyon rezervi) ve Otomatik Üretim Kontrolü - AGC (otomatik üretim kontrolü) frekansı nominal değere yaklaştırır ve ilk rezerv katmanını yeniden kullanılabilir hâle getirir.


![Bir olay eğrisindeki dört kritik bölge](images/fig02_rocof.png)


## RoCoF bize ne söyler?

RoCoF tek başına “sistemde şu kadar atalet vardır” demek için yeterli değildir; olay büyüklüğü, ölçüm penceresi, filtreleme ve yüklerin frekans duyarlılığı da sonucu etkiler. Yine de olayın ilk kısmında, bilinen bir güç kaybı ile birlikte kullanıldığında sistem ataleti hakkında güçlü bir gösterge sağlar.

Basit ilişki şöyledir: RoCoF yaklaşık olarak güç dengesizliği ile doğru, toplam kinetik enerji ile ters orantılıdır. Başka bir ifadeyle aynı 1 GW kayıp, daha düşük ataletli bir sistemde daha yüksek Hz/s değişimi üretir.


## Olay analizi yaparken kaçırılmaması gerekenler

Başlangıç frekansı, nadir, nadire ulaşma süresi, maksimum RoCoF, geçici denge frekansı ve toparlanma süresi birlikte değerlendirilmelidir. Yalnızca minimum frekansın raporlanması, kontrolün neden başarılı veya yetersiz olduğuna dair çok az bilgi verir.

Ekli GridFreq raporunda 1059 MW büyüklüğünde bir olay profili kullanılmıştır. Kamuya açık Fingrid 2024 raporu yıl içinde 300 mHz’den büyük 11 frekans bozuntusu bulunduğunu ve çoğunun nükleer santral arızalarıyla ilişkili olduğunu doğrular. Buna karşın ekli rapordaki tüm tekil zaman/değer ayrıntıları kamuya açık kayıtlarda aynı biçimde doğrulanamadığından bu makalede eğri “örnek olay profili” olarak ele alınmıştır.



## PowerPoint içeriğiyle genişletilmiş okuma: 5 saniyelik kritik pencere

Sunum materyallerinde özellikle vurgulanan nokta, büyük bir arızadan sonraki ilk birkaç saniyenin sistem güvenliği açısından belirleyici olduğudur. **0–2 saniye** aralığında görülen ilk düşüş, büyük ölçüde atalet (inertia) etkisiyle yavaşlatılır. **2–10 saniye** aralığında ise Primary Frequency Response - PFR (birincil frekans tepkisi) veya PFK daha görünür hâle gelir ve frekans eğrisi “uçuruma” doğru değil, yeniden dengeye doğru yönelmeye başlar.

Bu bakış, olay analizini yalnızca “en düşük frekans kaç oldu?” sorusundan çıkarıp “ilk savunma hattı yeterli miydi, kontrol yeterince hızlı mı devreye girdi, UFLS (Under Frequency Load Shedding / düşük frekansta yük atma) sınırına ne kadar yaklaşıldı?” gibi daha anlamlı sorulara taşır. Dolayısıyla bir olay raporunda nadir kadar nadire ulaşma süresi ve ilk 5 saniyedeki eğim de mühendislik açısından çok değerlidir.

![Sunumdan kritik pencere görseli](images/ppt_context.png)

## Olay eğrisini okurken kullanılan sade zihinsel model

Sunumlarda kullanılan anlatım, atalet ile PFK’yı iki aşamalı bir kurtarma operasyonu gibi ele alır. Atalet bize **zaman kazandırır**; PFK ise bu kazanılan zamanı kullanarak sisteme **aktif güç tepkisi** pompalar. Bu sade model, şebeke dinamiklerini uzman olmayan okuyucu için de anlaşılır kılar.

Pratikte bu yaklaşım, GridFreq üzerindeki olay analiz ekranında RoCoF, nadir, toparlanma ve kararlı durum etiketlerinin neden birlikte gösterilmesi gerektiğini de açıklar. Çünkü gerçek karar desteği, tekil metrikte değil, olayın zamansal anatomisindedir.


## Kaynaklar ve editoryal not

Bu metin, kullanıcı tarafından sağlanan GridFreq teknik dokümanları temel alınarak hazırlanmıştır. Simülasyon sonuçları model/senaryo bağımlı olarak ifade edilmiştir; mevzuatla ilgili kritik noktalar güncel TEİAŞ/ENTSO-E kaynaklarıyla karşılaştırılmıştır.

- Ekli kaynak: `gridfreq-frequency-event-report.pdf`

- Ekli kaynak: `gridfreq-technical-manual.pdf`

- Dış doğrulama: TEİAŞ 03.07.2026 depolama teknik kriterleri ve test prosedürleri.

- Dış doğrulama: ENTSO-E/Fingrid sistem işletme ve frekans kalite yayınları.


> GridFreq bağımsız bir analiz platformudur; metin resmî sistem işletmecisi görüşü değildir.
