
# GridFreq Platform Mimarisi: Sıfır-Sunucu Yaklaşımıyla Şebeke Analizi

**Alt başlık:** Statik web, otomatik veri toplama ve tarayıcı içi analiz nasıl birlikte çalışıyor?

GridFreq’in dikkat çekici taraflarından biri, ağır kurumsal veri platformlarına benzemeden yüksek çözünürlüklü frekans analizini web üzerinde sunabilmesidir. Bu başarı, klasik bir veritabanı ağırlıklı arka uç yerine; otomasyon, sıkıştırma ve tarayıcı içi hesaplamaya dayalı bir mimariden gelir.

![Makale başlık görseli](images/hero_cover.jpg)

> **Ana mesaj:** GridFreq’in mimarisi, düşük işletme maliyeti ile yüksek analitik çevikliği aynı anda hedefleyen bir “statik ama akıllı” tasarımdır.

## Veri kaynakları nasıl birleştiriliyor?

Platform sunumunda TEİAŞ, Netztransparenz ve canlı telemetri kaynağı olarak GridRadar benzeri kaynakların farklı gecikmeler ve farklı kullanım amaçlarıyla işlendiği gösteriliyor. Bazı veri setleri tarihsel analiz için günlük paketler hâlinde alınırken, bazıları daha kısa gecikmeli özet görünüm sağlamak için tamponlanıyor.

Bu ayrım önemlidir; çünkü tek bir veri kaynağı tüm ihtiyaçları karşılamaz. Tarihsel bütünlük, canlı görünürlük ve karşılaştırmalı referans amacı için farklı tedarik stratejileri gerekebilir.

![Kaynak matrisi](images/ppt_sources.png)

## Otomasyon omurgası

Platformun arka planında GitHub Actions ile çalışan bir otomasyon hattı bulunur. Bu hat, zamanlanmış görevlerle kaynaklara erişir, ham veriyi indirir, zaman damgalarını doğrular, UTC ekseninde hizalar ve istemci için daha verimli formatlara dönüştürür.

Bu yöntem, büyük bir sürekli sunucu altyapısına gerek bırakmadan günlük veri üretimini sürdürür. Ayrıca veri akışı kodla tarif edildiği için süreç şeffaf ve tekrar üretilebilir kalır.

## Neden ikili sıkıştırma ve istemci tarafı işleme?

Sunumlarda günlük 86.400 saniyelik verinin int16 tabanlı binary (ikili) biçimde sıkıştırılması gösteriliyor. Bu yaklaşım, indirme boyutunu düşürürken anlamlı hassasiyeti korumayı hedefler. Böylece kullanıcı tarayıcıda hızlı çizim, filtreleme ve temel analiz işlemlerini gerçekleştirebilir.

İstemci tarafı işleme, ölçeklenebilirlik açısından da avantajlıdır. Her kullanıcı kendi tarayıcısında bazı hesaplamaları yaptığı için merkezi sunucu yükü azalır; buna karşılık arayüzün akıcı kalması için Web Worker gibi teknikler kullanılır.

![Mimari akış](images/ppt_architecture.png)

## Canlı telemetri nasıl güvenli sunuluyor?

Canlı telemetri için en kritik meselelerden biri API anahtarlarının istemciye açık edilmemesidir. Sunumda bunun için Cloudflare Worker ve tampon bellek yaklaşımı anlatılıyor. Ara katman, canlı veriyi güvenli şekilde toplayıp istemciye özetlenmiş ve kontrollü erişim sağlar.

Bu çözüm, tamamen statik bir sitenin gerektiğinde yarı-canlı veri deneyimi sunabileceğini gösterir. Böylece kullanıcı hem tarihsel hem yakın gerçek zamanlı görünümü aynı platform içinde kullanabilir.

![Canlı veri mimarisi](images/ppt_live.png)

## Sonuç

GridFreq’in platform mimarisi, enerji analitiğinde “büyük sistem gerekir” varsayımına pratik bir alternatif sunuyor. Otomasyon, sıkıştırma, tarayıcı içi işleme ve güvenli aracı katman yaklaşımı birlikte kullanıldığında, bağımsız ama güçlü bir frekans izleme ortamı kurulabiliyor.

## Kaynaklar ve editoryal not

- Kaynak: `GridFreq_Analysis_Platform.pptx`
- Kaynak: `GridFreq_Analysis_Laboratory.pptx`
