# Manual Steps

Bu dosya yalnızca kullanıcının gerçekten yapması gereken işleri listeler.

## 1. Wrangler Login Yenileme

Bu ortamda Wrangler oturumu süresi dolmuş görünüyor. Etkileşimli bir terminalde:

```powershell
cd C:\yazilim_projeler\zfrekans_rapor_worktrees\feat-gridradar-live-frequency\live-frequency-worker
npx wrangler login
```

Açılan Cloudflare tarayıcı onayını tamamlayın. Token veya Cloudflare API tokenını sohbet mesajı olarak göndermeyin.

## 2. GridRadar Token Secret Girişi

Codex şu komutu başlattığında:

```powershell
npx wrangler secret put GRIDRADAR_TOKEN
```

GridRadar API tokenınızı açılan gizli terminal girişine yapıştırıp Enter'a basın. Tokenı sohbet mesajı olarak göndermeyin.

## 3. Cloudflare Onayı

Cloudflare ilk Worker deploy sırasında tarayıcıda zorunlu hesap veya Workers onayı isterse, açılan Cloudflare ekranında onayı tamamlayın.

## 4. PR Merge

Branch protection veya GitHub izinleri nedeniyle PR otomatik merge edilemezse, GitHub üzerinde PR'ı siz merge edin.

DNS, özel alan adı, GitHub API tokenı, D1, KV veya R2 kurulumu bu ilk sürüm için zorunlu değildir.
