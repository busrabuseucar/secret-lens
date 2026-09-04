# SecretLens

Küçük kaynak dosyalarında olası gizli değerleri bulan, sonuçları **tamamen maskeli** döndüren TypeScript öğrenme projesi. Tarayıcı demosu ve Node.js CLI aynı tarama motorunu kullanır.

**Geliştiren:** Büşra Buse Uçar · AI desteğiyle geliştirilmiştir. Kod, testler ve tasarım AI yardımı içerir; kişisel katkı ve öğrenme süreci bu kapsamda değerlendirilmelidir.

**Herkese açık demo:** [SecretLens'i aç](https://secret-lens-buse.sleek-brush-8818.chatgpt.site)  
**Kaynak kod:** [busrabuseucar/secret-lens](https://github.com/busrabuseucar/secret-lens) · **CI:** [GitHub Actions](https://github.com/busrabuseucar/secret-lens/actions/workflows/ci.yml)

## Çalıştırma

Node.js 24+ ve kaynak ZIP hazırlamak için Python 3 gerekir. Depoyu klonla:

```bash
git clone https://github.com/busrabuseucar/secret-lens.git
cd secret-lens
npm ci
npm run check
npm run build
npm test
npm run source
node scripts/check-assets.mjs
npm start
```

Yerel demo: `http://127.0.0.1:8080`. `file://` yerine HTTP sunucusu kullan; modül tabanlı Web Worker buna ihtiyaç duyar. Kaynak indirme bağlantısı için `npm run source` çalıştırılmış olmalı.

## 60 saniyelik demo

1. **Düzeltmeden önce** örneği ile başla: iki sentetik dosyada **5 bulgu**, bunların **3'ü öncelikli**.
2. Bir bulgunun gerekçesini ve önerilen sonraki adımı aç.
3. **Düzelttikten sonra** örneğine geç: değerler ortam değişkenlerinden okunur; bu kurallarla **0 bulgu** çıkar. Bu, güvenlik garantisi değildir.
4. Kod yapıştır veya UTF-8 metin dosyaları seç; **İçeriği tara** düğmesine bas.
5. **Maskeli JSON indir** ile raporu al. Filtre yalnızca ekrandaki listeyi değiştirir; rapor taramanın tüm bulgularını içerir.

Örneklerdeki GitHub biçimi programatik üretilmiş sentetik bir değerdir. AWS kimliği, AWS'nin dokümantasyon örneğidir. Özel anahtar örneği yalnızca başlıktır. Hiçbir örnek kimlik bilgisi bir sağlayıcıya gönderilmez veya geçerlilik kontrolünden geçirilmez.

## CLI ve çıkış kodları

```bash
node cli.mjs --demo
node cli.mjs --demo-fixed
node cli.mjs config.txt settings.json
node cli.mjs -- config.txt > masked-report.json
```

| Kod | Anlam |
| --- | --- |
| 0 | Tarama tamamlandı; bu kurallarla bulgu yok. |
| 1 | Tarama tamamlandı; en az bir bulgu var. |
| 2 | Girdi/okuma hatası veya 500 bulgu sınırı nedeniyle eksik tarama. |

CLI normal dosyaları kabul eder; klasörleri ve sembolik bağlantıları reddeder. Eksik taramada JSON üretilir ve `truncated: true` olur. Girdi hatalarında stdout boş kalır, genel hata stderr'e yazılır. Dosya yolu ve içerik hataya eklenmez. CLI dosyaları değiştirmez.

## Beş kural

| Kimlik | Eşleşme | Seviye |
| --- | --- | --- |
| `github-token` | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` + 36 alfasayısal karakter | Öncelikli |
| `aws-access-id` | `AKIA`/`ASIA` + 16 büyük harf/rakam | İncele; kimlik tek başına secret access key değildir |
| `private-key` | Desteklenen PEM özel anahtar başlangıcı | Öncelikli; tam/geçerli anahtar doğrulanmaz |
| `credential-url` | Desteklenen protokollerde `user:password@` | Öncelikli |
| `secret-assignment` | Parola/API anahtarı/secret adlı değişkene tek satırlı sabit atama | İncele |

Genel atama kuralı 4–512 karakterli değerleri dikkate alır. Basit `process.env`, `os.getenv`, `import.meta.env` referansları ve açık `${NAME}`, `<NAME>`, `YOUR_NAME`, `CHANGEME`, `REPLACE_ME` yer tutucuları atlanır. Yorum satırları da taranır; sıradan `example123` gibi değerler otomatik olarak güvenli kabul edilmez. Özel bir kuralın yakaladığı değere ayrıca genel atama bulgusu eklenmez.

## Gizlilik ve sınırlar

- Tarama **cihazda**, Web Worker içinde çalışır. Uygulama dosya içeriğini yüklemez; token doğrulama, ağ üzerinden depo tarama, analitik ve kalıcı tarama geçmişi yoktur. Siteyi açmak ve statik dosyaları indirmek normal ağ istekleridir.
- Sonuç nesnesi ham eşleşme, kod parçası, token parçası veya dosya adı taşımaz. Arayüz dosya adlarını ayrı yerel listeden gösterir. Yapıştırılan kod yalnızca kullanıcı giriş alanında ham olarak görünür.
- JSON raporu açık alan listesiyle oluşturulur; dosyalar `dosya-01` gibi adlandırılır. Satır/sütun, kural, boyut ve dosya sayısı gibi metaveriler kalır. Raporu paylaşmadan önce bunların uygunluğunu da değerlendir.
- Dosyalar bellekte işlenir. Temizle düğmesi alanları boşaltır ve çalışan worker'ı sonlandırır; JavaScript belleği için kriptografik silme garantisi yoktur.
- En fazla 20 dosya; dosya başına 512 KiB, toplam 2 MiB. UTF-8 dışı veya NUL içeren dosyalar reddedilir. Toplam 50.000 satır; satır başına 16.384 UTF-16 kod birimi. Son satır boşsa o da sayılır.
- İlk 500 bulgu tutulur. 501. bulguya ulaşılırsa tarama durur; sonuç açıkça **eksik** işaretlenir. `processedFiles` kısmen taranan son dosyayı da içerir; `bytes` ve `lines` tüm geçerli girdilerin boyutudur.
- Tarayıcıda 8 saniyelik worker zaman aşımı vardır. Yeni içerik veya örnek seçimi eski taramayı geçersiz kılar; eski sonuç yeni girdiye yazılmaz.
- Fine-grained GitHub PAT, JWT, sağlayıcıların tüm token biçimleri, kodlanmış/çok satırlı/split değerler, Git geçmişi, arşivler ve ikili dosyalar kapsam dışıdır. Statik sezgisel kurallar AST çözümlemesi yapmaz. Yanlış pozitif ve negatifler beklenir.
- “Bulgu yok” sonucu güvenlik sertifikası değildir. Gerçek bir gizli değer ifşa edilmişse koddan kaldırmak tek başına yeterli değildir; ilgili sağlayıcıda iptal/değişim gerekir.

## Yapı

```text
src/scanner.ts   Ortak kurallar, sınırlar, maskeli rapor
src/worker.ts    Tarayıcı iş parçacığı sınırı
src/app.ts       Dosya/metin akışı ve güvenli DOM metni
src/sample.ts    Sentetik önce/sonra örnekleri
cli.mjs         Aynı motoru kullanan yerel CLI
tests/          Motor, gerçek CLI ve worker sınırı testleri
docs/           Öğrenme planı ve CV taslağı
```

Çalışma zamanında üçüncü taraf bağımlılık yok; derleme için TypeScript 5.9.3 kullanılır. Yerel doğrulamada **30 test geçti**: 21 motor, 7 gerçek CLI ve 2 worker sınırı testi. CI, tür kontrolü, derleme, testler, kaynak ZIP'i ve statik dosya bağlantılarını doğrulayacak şekilde yapılandırılmıştır. [GitHub'daki çalışma sonuçlarını incele](https://github.com/busrabuseucar/secret-lens/actions/workflows/ci.yml). Tarayıcı görsel/uçtan uca testi bu doğrulamalara dahil değildir.

## Öğrenme ve CV

- [Adım adım öğrenme ve hata düzeltme alıştırması](docs/LEARNING.md)
- [CV metni ve mülakat hazırlığı](docs/CV.md)

## Dayanaklar

Bu proje bağımsız ve sınırlı bir eğitim uygulamasıdır; aşağıdaki ürünlerle eşdeğer kapsam iddiası yoktur.

- [GitHub token biçimlerinin açıklaması](https://github.blog/engineering/platform-security/behind-githubs-new-authentication-token-formats/)
- [GitHub secret scanning tarafından desteklenen desenler](https://docs.github.com/code-security/reference/secret-security/supported-secret-scanning-patterns)
- [AWS erişim anahtarı kimliği ve gizli anahtar ayrımı](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)
- [AWS AKIA/ASIA kimlik önekleri](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetAccessKeyInfo.html)
- [OWASP Secrets Management: iptal ve döndürme](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

MIT lisansı.
