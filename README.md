# Meridian · Hostinger buraxılışı 1.1

Hostinger üçün hazırlanan tam frontend və backend. Quraşdırma üçün HOSTINGER_QURASDIRMA.md faylını açın.

| Parametr | Dəyər |
| --- | --- |
| Framework preset | Other |
| Node.js | 24.x |
| Root directory | . |
| Package manager | npm |
| Build command | npm run build |
| Output directory | dist |
| Entry file | index.js |
| Start command, göstərilərsə | npm start |

Arxivin kökündəki index.js .env faylını yükləyir və server/app.js faylını başladır. Build dist qovluğunda ayrıca işləyə bilən index.js, package.json, server və public fayllarını yaradır. Həm kök giriş faylı, həm də dist/index.js işləyir. Hostinger panelində Entry file üçün index.js yazın.

Frontend public qovluğundadır. Server eyni domen üzərindən interfeysi və /api ünvanlarını xidmətə açır. Yoxlama ünvanı /api/health-dir.

Paketdə Vue 3, Node.js və SQLite var. npm asılılığı yoxdur, package-lock.json daxildir. Dizayn, şirkətlər, rollar, paketlər, limitlər, tapşırıqlar və hesabatlar əvvəlki buraxılışdakı kimi işləyir.

Lokal demo üçün Node.js 22.13+ quraşdırıb npm run demo əmrini icra edin və http://localhost:3000 ünvanını açın. .env faylı varsa NODE_ENV=development seçin. Demo ayrıca demo-data qovluğundan istifadə edir.

npm test şirkət ayrılığını, səlahiyyətləri, paralel limit yoxlamasını, build çıxışından açılışı, HTTPS proxy üçün Origin yoxlamasını və eyni baza ilə fərqli deploy qovluğundan yenidən açılışı yoxlayır.

Araşdırma ARASDIRMA.md, üçüncü tərəf lisenziyaları licenses qovluğundadır.
