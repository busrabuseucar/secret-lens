# SecretLens'i anlayarak sahiplen

Amaç yalnızca çalışan bir demoya sahip olmak değil; kuralların neyi kaçırdığını, maskelemenin sınırlarını ve testlerin hangi davranışı koruduğunu açıklayabilmek.

## 1. Demoyu dene — 10 dakika

1. Önce örneğinde 5 bulgu ve 3 öncelikli sonuç gör.
2. AWS kimliğinin neden diğerlerinden farklı seviyede olduğunu oku.
3. Sonra örneğinde neden 0 bulgu çıktığını açıkla: sabit değer kaldırılmıştır; gerçek ortamın doğru yapılandırıldığı doğrulanmamıştır.
4. JSON raporunu aç. Ham token, komşu satır ve gerçek dosya adı bulunmadığını kontrol et.

## 2. Veri akışını takip et — 15 dakika

`app.ts` dosya boyutlarını kontrol eder ve UTF-8 metni okur. Worker'a gönderilen metni `scanner.ts` inceler. Motor, yalnızca konum ve kural bilgisini döndürür. Arayüz dosya adını kendi yerel listesinden alır. `exportReport` açık alan listesiyle rapor üretir.

Kendine sor: Eşleşmenin ilk ve son dört karakterini göstermek neden tam maskelemeden farklıdır? Dosya adında müşteri adı olsa JSON'a taşınır mı? Bir kullanıcı yeni dosya seçerken eski tarama biterse ne olur?

## 3. Küçük bir hata düzeltme alıştırması — 20 dakika

Mevcut genel atama kuralı dört karakterden kısa değerleri atlar. `password="abc"` bu yüzden bulunmaz. Gerçek bir sistemde kısa bir parola da hassas olabilir. Bunu kuralların yanlış negatif üretebilmesine örnek olarak kullan.

1. Yeni bir dal aç: `git switch -c exercise/short-password`.
2. `tests/scanner.test.mjs` dosyasına `password="abc"` için bir bulgu bekleyen test ekle.
3. `npm run build && npm test` çalıştır. Eklediğin testin kırmızı olduğunu gör.
4. `src/scanner.ts` içindeki minimum uzunluk koşulunu değiştir. Bu genişletmenin yanlış eşleşmeleri nasıl artırabileceğini düşün.
5. Tekrar derle ve test et. `password="<PASSWORD>"` ve `password=process.env.PASSWORD` için hâlâ bulgu olmadığını doğrula.
6. README'deki 4–512 sınırını yeni davranışa göre güncelle. Değişikliği ve nedenini açıklayan bir commit oluştur.

Alıştırma henüz uygulanmadı. Ana daldaki testler mevcut minimum uzunluğu kullanır; değişiklikten sonra kendi regresyon testini de koru.

## 4. Mülakat anlatımı — 5 dakika

Şunları kendi kelimelerinle anlat:

- Regex eşleşmesi ile bir anahtarın aktif olduğunu doğrulamak arasındaki fark.
- Bulguda, raporda ve kullanıcı giriş alanında ham verinin nerede bulunduğu.
- Girdi hatası ile “0 bulgu” arasındaki ayrım.
- 500 bulgu sınırına ulaşıldığında neden sonuç “tamamlandı ve temiz” sayılamaz?
- Sızan anahtarı koddan silmenin neden iptal etmenin yerini tutmadığı.

Geliştirme AI desteğiyle yapıldı. CV ve görüşmelerde özellikle kendi incelediğin, değiştirdiğin ve açıklayabildiğin bölümleri anlat.
