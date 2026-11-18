# Hostinger-də Meridian-ın aktivləşdirilməsi

## 1. Tətbiqi əlavə edin

Hostinger panelində Websites → Create site/Add website → Web App/Node.js seçin. Domeni seçdikdən sonra Upload your files vasitəsilə Meridian_Hostinger_READY.zip faylını yükləyin.

Node.js tətbiqini işlədən hostinq planı tələb olunur. Faylları yalnız public_html qovluğuna köçürmək server prosesini başlatmır.

## 2. Build parametrlərini yazın

| Parametr | Dəyər |
| --- | --- |
| Framework preset | Other |
| Node version | 24.x |
| Root directory | . |
| Package manager | npm |
| Build command | npm run build |
| Output directory | dist |
| Entry file | index.js |
| Start command, varsa | npm start |

ZIP əlavə üst qovluq olmadan hazırlanıb. index.js və package.json birbaşa kökdədir. Output directory daxilində də ayrıca index.js var.

## 3. Daimi məlumat qovluğunu hazırlayın

Bu buraxılış SQLite bazası ilə işləyir. Şirkətlər, hesablar, tapşırıqlar və sessiyalar meridian.sqlite faylında saxlanır.

Hostinger-də tətbiqin yazma icazəsi olan, deploy buraxılışlarından kənarda saxlanan daimi qovluq seçin. Panelinizdəki faktiki istifadəçi və domenlə mümkün yol nümunəsi aşağıdadır.

`/home/u123456789/domains/example.com/meridian-data`

Bu yalnız nümunədir. Hostinger File Manager və hesabınıza aid qovluq quruluşu əsasında yolu dəqiqləşdirin. Qovluq public_html daxilində yerləşməməlidir. nodejs və hbuilds/versions daxilindəki buraxılış qovluqlarından da istifadə etməyin. Paneliniz belə daimi qovluğa yazma imkanı vermirsə, bu SQLite buraxılışı üçün hostinq uyğunlaşdırılması və ya MySQL keçidi lazımdır.

DATA_DIR bir dəfə təyin edildikdən sonra bütün redeploy əməliyyatlarında eyni qalmalıdır. Tətbiq ilk açılışda qovluğu və cədvəlləri avtomatik yaradır. Mövcud məlumatlar silinmir. Production rejimində proqram DATA_DIR-in tam yol olmasını və cari deploy qovluğundan kənarda yerləşməsini yoxlayır. Hostinqin həmin qovluğu qoruyub saxlamasını paneldə ayrıca dəqiqləşdirin.

## 4. Environment Variables əlavə edin

| Dəyişən | Nə yazılmalıdır |
| --- | --- |
| NODE_ENV | production |
| APP_URL | Domenin tam HTTPS ünvanı, məsələn https://example.com |
| ADMIN_EMAIL | Platforma administratorunun e-poçtu |
| ADMIN_PASSWORD | Öz təyin etdiyiniz 12–128 simvolluq şifrə |
| DATA_DIR | Əvvəlki addımdakı daimi qovluğun tam yolu |
| COOKIE_SECURE | true |

APP_URL brauzerdə açacağınız əsas domenə uyğun gəlməlidir. www.example.com və example.com fərqli mənbələrdir. İkinci domeni əsas domenə yönləndirin. Müvəqqəti domendən əsas domenə keçəndə APP_URL-i yeniləyin.

Hostinger-in təqdim etdiyi PORT dəyəri avtomatik istifadə edilir. Paneldə hazır PORT varsa dəyişməyin. PORT təqdim edilmədikdə server 3000 portunda açılır. Server hostinqdə 0.0.0.0 ünvanında dinləyir.

Administrator yalnız boş bazanın ilk açılışında yaradılır. Sonrakı redeploy-lar onun şifrəsini yenidən yazmır. İlk işəsalmadan sonra ADMIN_PASSWORD dəyişənini silmək olar.

.env.example nümunədir. Hostinger-də dəyişənləri panelə daxil edin. Arxivdə şəxsi şifrələr və real .env yoxdur.

## 5. Deploy edin və yoxlayın

Deploy düyməsinə basın. Build jurnalında “Build hazırdır”, tətbiq jurnalında “Meridian” mesajını görməlisiniz.

1. Domeninizdə /api/health açın. Cavab {"status":"ok"} olmalıdır.
2. Əsas səhifədə öz ADMIN_EMAIL və ADMIN_PASSWORD məlumatlarınızla daxil olun.
3. Paket yaradın və şirkəti əsas administratoru ilə birlikdə əlavə edin.
4. Şirkət administratoru ilə daxil olub layihə, əməkdaş və tapşırıq yaradın.

Production rejimində demo düymələri göstərilmir. Giriş üçün HTTPS aktiv olmalıdır.

## 6. Yenilənmə və ehtiyat surət

Yeni ZIP ilə redeploy edəndə DATA_DIR və digər mühit dəyişənlərini saxlayın. Təkrar build yalnız dist qovluğunu yenidən yaradır. Bazaya build mərhələsində qoşulmur.

SQLite üçün bir server instansı istifadə edin. Ehtiyat nüsxəni bazanın fəaliyyəti dayandırıldıqdan sonra bütöv DATA_DIR qovluğundan götürün. Bərpa üçün həmin qovluğu geri yerləşdirin və DATA_DIR-i ona yönəldin. Mövcud SQLite bazasını bu paketə keçirmək üçün də server dayandırılarkən bütöv məlumat qovluğunu daşıyın.

## Problem olarsa

| Əlamət | Yoxlanacaq hissə |
| --- | --- |
| 503 | Tətbiq jurnalı, Node versiyası, Entry file, DATA_DIR yazma icazəsi, ilk administrator dəyişənləri |
| “DATA_DIR ... tam yol” | Production üçün daimi qovluğun tam yolunu yazın |
| “EACCES” | Seçilmiş qovluğa hostinq istifadəçisinin yazma icazəsi |
| “Mənbə qəbul edilmir” | APP_URL ilə brauzerdəki domenin eyniliyi |
| Daxil olduqdan sonra yenidən giriş səhifəsi | HTTPS və brauzerin cookie qəbul etməsi |
| Redepoy sonrası boş baza | DATA_DIR-in əvvəlki daimi qovluğa göstərməsi |
| node:sqlite xətası | Node.js 24.x seçilməsi |

Bu paket lokal olaraq build və HTTP testlərindən keçirilib. İstifadəçinin Hostinger hesabında real deploy və disk icazələri yoxlanmayıb.

Rəsmi təlimatlar
- https://www.hostinger.com/support/how-to-deploy-apps-built-with-codex-on-hostinger/
- https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- https://www.hostinger.com/support/how-to-redeploy-a-node-js-application/
