import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demo = process.argv.includes('--demo');
const production = process.env.NODE_ENV === 'production';
if (demo && production) throw Error('Demo üçün NODE_ENV=development seçin.');
const configuredData = process.env.DATA_DIR;
if (production && (!configuredData || !isAbsolute(configuredData))) {
  throw Error('DATA_DIR üçün daimi qovluğun tam yolunu təyin edin.');
}
const data = demo ? resolve(base, 'demo-data') : resolve(base, configuredData || 'data');
if (production && (data === base || data.startsWith(base + sep))) {
  throw Error('DATA_DIR deploy qovluğundan kənarda olmalıdır.');
}
const appOrigin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : null;
mkdirSync(data, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(resolve(data,'meridian.sqlite'));
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS plans(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,seats INTEGER NOT NULL, monthly REAL NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS companies(id INTEGER PRIMARY KEY,name TEXT NOT NULL,plan INTEGER NOT NULL REFERENCES plans,cap INTEGER);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,hash TEXT NOT NULL,role TEXT NOT NULL,company INTEGER REFERENCES companies,active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS projects(id INTEGER PRIMARY KEY,name TEXT NOT NULL,company INTEGER NOT NULL REFERENCES companies);
CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY,title TEXT NOT NULL,details TEXT NOT NULL,project INTEGER NOT NULL REFERENCES projects,owner INTEGER REFERENCES users,status TEXT NOT NULL,priority TEXT NOT NULL,due TEXT NOT NULL,version INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY,task INTEGER REFERENCES tasks ON DELETE CASCADE,author INTEGER REFERENCES users,body TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user INTEGER REFERENCES users,expires INTEGER NOT NULL);`);
const one=(sql,...p)=>db.prepare(sql).get(...p);
const all=(sql,...p)=>db.prepare(sql).all(...p);
const run=(sql,...p)=>db.prepare(sql).run(...p);
const insert=(sql,...p)=>Number(run(sql,...p).lastInsertRowid);
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function tx(fn){db.exec('BEGIN IMMEDIATE');try{const out=fn();db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}
function str(v,max=120){if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail('Mətni və onun uzunluğunu yoxlayın.');return v.trim();}
function limit(v){const n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>100000)fail('Limit 1–100000 arasında olmalıdır.');return n;}
function email(v){const e=str(v,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))fail('E-poçt ünvanını yoxlayın.');return e;}
function password(v){if(typeof v!=='string'||v.length<12||v.length>128)fail('Şifrə 12–128 simvol olmalıdır.');return v;}
function hash(v){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password(v),salt,64).toString('hex');}
function user(name,mail,pass,role,company){return insert('INSERT INTO users(name,email,hash,role,company) VALUES(?,?,?,?,?)',str(name),email(mail),hash(pass),role,company);}
function choose(v,items){if(!items.includes(v))fail('Seçim yanlışdır.');return v;}
const statuses=['todo','doing','review','done'], priorities=['low','normal','high'];
if(!one('SELECT id FROM users LIMIT 1'))tx(()=>{
  if(!demo&&(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD))throw Error('İlk açılış üçün ADMIN_EMAIL və ADMIN_PASSWORD dəyişənlərini təyin edin.');
  const plan=insert('INSERT INTO plans(name,seats) VALUES(?,?)','Business',12);
  user('Platforma administratoru',demo?'platform@meridian.test':process.env.ADMIN_EMAIL,demo?'MeridianDemo2026':process.env.ADMIN_PASSWORD,'platform',null);
  if(!demo)return;
  const c=insert('INSERT INTO companies(name,plan) VALUES(?,?)','Atelier Studio',plan);
  const a=user('Leyla Məmmədova','leyla@meridian.test','MeridianDemo2026','admin',c);
  const b=user('Murad Əliyev','murad@meridian.test','MeridianDemo2026','member',c);
  const d=user('Aysel Quliyeva','aysel@meridian.test','MeridianDemo2026','member',c);
  const p=['Brend strategiyası','Rəqəmsal məhsul','Əməliyyat planı'].map(n=>insert('INSERT INTO projects(name,company) VALUES(?,?)',n,c));
  ['Brend kitabçasının hazırlanması','Müştəri müsahibələrinin planı','Ana səhifənin dizaynı','Komanda büdcəsinin təsdiqi','Mobil prototipin sınağı','Tərəfdaş təqdimatının icmalı','İstifadəçi axınlarının xəritəsi','Rüblük hədəflərin təhlili','Vizual üslubun təsdiqi'].forEach((t,i)=>{
    const date=new Date();date.setUTCDate(date.getUTCDate()+i-2);
    insert('INSERT INTO tasks(title,details,project,owner,status,priority,due) VALUES(?,?,?,?,?,?,?)',t,'Nəticəni komanda ilə paylaşın və yekun rəyi qeyd edin.',p[[0,0,1,2,1,0,1,2,0][i]],[a,b,d][i%3],statuses[[0,0,1,2,1,2,3,0,3][i]],priorities[(i+2)%3],date.toISOString().slice(0,10));
  });
});
const publicUser='id,name,email,role,company,active';
const companySQL='SELECT c.*,p.name AS package,coalesce(c.cap,p.seats) AS seats,(SELECT count(*) FROM users u WHERE u.company=c.id AND active=1) AS used FROM companies c JOIN plans p ON p.id=c.plan';
function company(id){return one(companySQL+' WHERE c.id=?',id)||fail('Şirkət tapılmadı.',404);}
function task(id,c){return one('SELECT t.* FROM tasks t JOIN projects p ON t.project=p.id WHERE t.id=? AND p.company=?',id,c)||fail('Tapşırıq tapılmadı.',404);}
function staff(u){if(u.role!=='admin')fail('Şirkət administratorunun icazəsi tələb olunur.',403);}
function platform(u){if(u.role!=='platform')fail('Platforma administratorunun icazəsi tələb olunur.',403);}
function state(u){
  if(u.role==='platform')return {me:u,plans:all('SELECT * FROM plans ORDER BY id'),companies:all(companySQL+' ORDER BY c.id'),users:all('SELECT '+publicUser+' FROM users WHERE company IS NOT NULL')};
  const c=u.company;
  return {me:u,company:company(c),users:all('SELECT '+publicUser+' FROM users WHERE company=?',c),projects:all('SELECT * FROM projects WHERE company=?',c),tasks:all('SELECT t.* FROM tasks t JOIN projects p ON p.id=t.project WHERE p.company=? ORDER BY t.id',c),comments:all('SELECT m.* FROM comments m JOIN tasks t ON t.id=m.task JOIN projects p ON p.id=t.project WHERE p.company=? ORDER BY m.id',c)};
}
function change(action,b,u){
  switch(action){
    case 'plan':{
      platform(u);const seats=limit(b.seats);
      const monthly=Number(b.monthly??0);if(!Number.isFinite(monthly)||monthly<0||monthly>1000000)fail('Aylıq qiyməti yoxlayın.');
      if(b.id){if(!one('SELECT id FROM plans WHERE id=?',b.id))fail('Paket tapılmadı.');
        if(all(companySQL+' WHERE c.plan=? AND c.cap IS NULL',b.id).some(c=>c.used>seats))fail('Paket limiti şirkətdəki aktiv istifadəçi sayından azdır.');
        run('UPDATE plans SET name=?,seats=?,monthly=? WHERE id=?',str(b.name),seats,monthly,b.id);
      }else insert('INSERT INTO plans(name,seats,monthly) VALUES(?,?,?)',str(b.name),seats,monthly);break;
    }
    case 'company':{
      platform(u);const p=one('SELECT * FROM plans WHERE id=?',Number(b.plan));if(!p)fail('Paket seçin.');
      const cap=b.cap==null||b.cap===''?null:limit(b.cap);
      if(b.id){if(company(b.id).used>(cap??p.seats))fail('Limit aktiv istifadəçilərin sayından azdır.');
        run('UPDATE companies SET name=?,plan=?,cap=? WHERE id=?',str(b.name),p.id,cap,b.id);
      }else{const id=insert('INSERT INTO companies(name,plan,cap) VALUES(?,?,?)',str(b.name),p.id,cap);
        user(b.adminName,b.email,b.password,'admin',id);}
      break;
    }
    case 'user':{
      if(u.role!=='platform')staff(u);
      const c=company(u.role==='platform'?Number(b.company):u.company);
      const old=b.id&&one('SELECT * FROM users WHERE id=? AND company=?',b.id,c.id);
      if(b.id&&!old)fail('İstifadəçi tapılmadı.',404);
      const active=b.active===false?0:1,role=choose(b.role,['admin','member']);
      if((!old||!old.active)&&active&&c.used>=c.seats)fail('Şirkətin istifadəçi limiti dolub.',409);
      if(old){
        if(old.id===u.id&&(!active||role!=='admin'))fail('Öz administrator girişinizi dəyişə bilməzsiniz.');
        if(old.active&&old.role==='admin'&&(!active||role!=='admin')&&!one("SELECT id FROM users WHERE role='admin' AND active=1 AND company=? AND id<>?",c.id,old.id))fail('Şirkətdə aktiv administrator qalmalıdır.');
        run('UPDATE users SET name=?,email=?,role=?,active=? WHERE id=?',str(b.name),email(b.email),role,active,old.id);
        if(b.password)run('UPDATE users SET hash=? WHERE id=?',hash(b.password),old.id);
        if(!active||b.password||role!==old.role)run('DELETE FROM sessions WHERE user=?',old.id);
      }else user(b.name,b.email,b.password,role,c.id);
      break;
    }
    case 'project':staff(u);insert('INSERT INTO projects(name,company) VALUES(?,?)',str(b.name),u.company);break;
    case 'task':{
      staff(u);
      if(!one('SELECT id FROM projects WHERE id=? AND company=?',Number(b.project),u.company))fail('Layihə seçin.');
      const owner=b.owner?Number(b.owner):null;
      if(owner&&!one('SELECT id FROM users WHERE id=? AND company=? AND active=1',owner,u.company))fail('Aktiv əməkdaş seçin.');
      const due=b.due||'';if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||isNaN(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due))fail('Tarixi yoxlayın.');
      const args=[str(b.title,200),b.details?str(b.details,5000):'',Number(b.project),owner,choose(b.status,statuses),choose(b.priority,priorities),due];
      if(b.id){task(b.id,u.company);if(!run('UPDATE tasks SET title=?,details=?,project=?,owner=?,status=?,priority=?,due=?,version=version+1 WHERE id=? AND version=?',...args,b.id,b.version).changes)fail('Tapşırıq dəyişib. Yeniləyib təkrar açın.',409);}
      else insert('INSERT INTO tasks(title,details,project,owner,status,priority,due) VALUES(?,?,?,?,?,?,?)',...args);
      break;
    }
    case 'status':case 'comment':case 'deleteTask':{
      if(!u.company)fail('Şirkət hesabı tələb olunur.',403);
      const t=task(b.id,u.company);
      if(action==='comment'){insert('INSERT INTO comments(task,author,body) VALUES(?,?,?)',t.id,u.id,str(b.body,3000));break;}
      if(action==='deleteTask')staff(u);
      else if(u.role!=='admin'&&t.owner!==u.id)fail('Yalnız sizə təyin edilən tapşırığı keçirə bilərsiniz.',403);
      if(t.version!==b.version)fail('Tapşırıq dəyişib. Yeniləyib təkrar açın.',409);
      if(action==='deleteTask')run('DELETE FROM tasks WHERE id=?',t.id);
      else run('UPDATE tasks SET status=?,version=version+1 WHERE id=?',choose(b.status,statuses),t.id);
      break;
    }
    default:fail('Ünvan tapılmadı.',404);
  }
}
const attempts=new Map();
const digest=s=>createHash('sha256').update(s).digest('hex');
const web=resolve(base,'public');
const server = http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
  try{
    if(!path.startsWith('/api/')){
      const file=resolve(web,'.'+decodeURIComponent(path==='/'?'/index.html':path));
      if(!file.startsWith(web+sep)||!existsSync(file))fail('Tapılmadı.',404);
      res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream');return res.end(readFileSync(file));
    }
    if(path==='/api/health' && req.method==='GET') {
      one('SELECT 1 AS ready');
      return json(200,{status:'ok'});
    }
    if(path==='/api/info'&&req.method==='GET')return json(200,{demo});
    let b={};
    if(req.method==='POST'){
      if(req.headers.origin && (appOrigin ? req.headers.origin !== appOrigin : new URL(req.headers.origin).host !== req.headers.host))fail('Mənbə qəbul edilmir.',403);
      if(!req.headers['content-type']?.startsWith('application/json'))fail('JSON tələb olunur.',415);
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32768)fail('Sorğu çox böyükdür.',413);chunks.push(chunk);}
      try{b=JSON.parse(Buffer.concat(chunks));if(!b||typeof b!=='object'||Array.isArray(b))throw Error();}catch{fail('Sorğu formatı yanlışdır.');}
    }
    const cookie='; Path=/; HttpOnly; SameSite=Lax'+(!demo&&(process.env.COOKIE_SECURE==='true'||production)?'; Secure':'');
    if(path==='/api/login'&&req.method==='POST'){
      const mail = email(b.email);
      const key = digest(mail), now=Date.now();
      for (const [entry, value] of attempts) if (value.until <= now) attempts.delete(entry);
      const a=attempts.get(key);if(a&&a.until>now&&a.count>=20)fail('Bir neçə dəqiqədən sonra təkrar daxil olun.',429);
      const account=one('SELECT * FROM users WHERE email=? AND active=1',mail);
      const [salt,expected]=(account?.hash||('0:'+ '00'.repeat(64))).split(':');
      if(typeof b.password!=='string'||b.password.length>128||!timingSafeEqual(scryptSync(b.password,salt,64),Buffer.from(expected,'hex'))||!account){
        attempts.set(key,a&&a.until>now?{...a,count:a.count+1}:{until:now+300000,count:1});fail('E-poçt və ya şifrə yanlışdır.',401);}
      attempts.delete(key);const token=randomBytes(32).toString('hex');
      run('DELETE FROM sessions WHERE expires<=?',now);run('INSERT INTO sessions VALUES(?,?,?)',digest(token),account.id,now+43200000);
      res.setHeader('Set-Cookie','sid='+token+cookie+'; Max-Age=43200');return json(200,{ok:true});
    }
    const token=digest(req.headers.cookie?.match(/(?:^|;\s*)sid=([a-f0-9]{64})(?:;|$)/)?.[1]||'');
    const u=one('SELECT '+publicUser+' FROM users WHERE active=1 AND id=(SELECT user FROM sessions WHERE token=? AND expires>?)',token,Date.now());
    if(!u)fail('Hesabınıza daxil olun.',401);
    if(path==='/api/state'&&req.method==='GET')return json(200,state(u));
    if(req.method!=='POST')fail('Üsul qəbul edilmir.',405);
    if(path==='/api/logout'){run('DELETE FROM sessions WHERE token=?',token);res.setHeader('Set-Cookie','sid='+cookie+'; Max-Age=0');return json(200,{ok:true});}
    tx(()=>change(path.slice(5),b,u));return json(200,{ok:true});
  }catch(e){const unique=e.message.includes('UNIQUE constraint');if(!e.status&&!unique)console.error(e.message);json(e.status||(unique?409:500),{error:unique?'Bu e-poçt və ya paket adı artıq istifadə olunur.':e.status?e.message:'Server xətası.'});}
});
server.on('error', error => {
  console.error('Server açıla bilmədi:', error.message);
  db.close();
  process.exitCode = 1;
});
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
server.listen(Number(process.env.PORT||3000),demo?'127.0.0.1':process.env.HOST||'0.0.0.0',()=>console.log('Meridian • http://localhost:'+server.address().port));
