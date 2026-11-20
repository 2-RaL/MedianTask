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
CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY,title TEXT NOT NULL,details TEXT NOT NULL,project INTEGER NOT NULL REFERENCES projects,owner INTEGER REFERENCES users,status TEXT NOT NULL,priority TEXT NOT NULL,due TEXT NOT NULL,group_id INTEGER,created_by INTEGER REFERENCES users,version INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY,task INTEGER REFERENCES tasks ON DELETE CASCADE,author INTEGER REFERENCES users,body TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY,user INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,title TEXT NOT NULL DEFAULT '',content TEXT NOT NULL,date TEXT,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS note_shares(note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(note_id, user_id));
CREATE TABLE IF NOT EXISTS groups(id INTEGER PRIMARY KEY,company INTEGER NOT NULL REFERENCES companies ON DELETE CASCADE,name TEXT NOT NULL,lead INTEGER REFERENCES users ON DELETE SET NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS group_members(group_id INTEGER NOT NULL REFERENCES groups ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,PRIMARY KEY(group_id, user_id));
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user INTEGER REFERENCES users,expires INTEGER NOT NULL);`);
try{db.exec('ALTER TABLE tasks ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL;');}catch{}
try{db.exec('ALTER TABLE tasks ADD COLUMN created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;');}catch{}
try{db.exec('ALTER TABLE tasks ADD COLUMN supervisor INTEGER REFERENCES users(id) ON DELETE SET NULL;');}catch{}
try{db.exec('ALTER TABLE tasks ADD COLUMN created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;');}catch{}
try{db.exec('ALTER TABLE users ADD COLUMN avatar TEXT;');}catch{}
try{db.exec('CREATE TABLE IF NOT EXISTS note_shares(note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(note_id, user_id));');}catch{}
try{db.exec('CREATE TABLE IF NOT EXISTS task_history(id INTEGER PRIMARY KEY, task INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, actor INTEGER REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, details TEXT, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);');}catch{}
const one=(sql,...p)=>db.prepare(sql).get(...p);
const all=(sql,...p)=>db.prepare(sql).all(...p);
const run=(sql,...p)=>db.prepare(sql).run(...p);
const insert=(sql,...p)=>Number(run(sql,...p).lastInsertRowid);
function logTaskHistory(taskId, actorId, action, details=''){
  try {
    run('INSERT INTO task_history(task,actor,action,details) VALUES(?,?,?,?)', taskId, actorId, action, details);
  } catch(e) {}
}
const statusNamesAz={todo:'Planlaşdırılıb',doing:'İcradadır',review:'Yoxlamada',done:'Tamamlanıb'};
const priorityNamesAz={low:'Aşağı',normal:'Orta',high:'Yüksək'};
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function tx(fn){db.exec('BEGIN IMMEDIATE');try{const out=fn();db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}
function str(v,max=120){if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail('Mətni və onun uzunluğunu yoxlayın.');return v.trim();}
function limit(v){const n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>100000)fail('Limit 1–100000 arasında olmalıdır.');return n;}
function email(v){const e=str(v,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))fail('E-poçt ünvanını yoxlayın.');return e;}
function password(v){if(typeof v!=='string'||v.length<12||v.length>128)fail('Şifrə 12–128 simvol olmalıdır.');return v;}
function hash(v){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password(v),salt,64).toString('hex');}
function user(name,mail,pass,role,company){return insert('INSERT INTO users(name,email,hash,role,company) VALUES(?,?,?,?,?)',str(name),email(mail),hash(pass),role,company);}
function choose(v,items){if(!items.includes(v))fail('Seçim yanlışdır.');return v;}
function importUsers(b,u){
  if(u.role!=='platform')staff(u);
  const target=company(u.role==='platform'?Number(b.company):u.company);
  if(!Array.isArray(b.rows)||b.rows.length<1||b.rows.length>25)fail('Bir faylda 1–25 istifadəçi olmalıdır.');
  if(target.used+b.rows.length>target.seats)fail('Şirkətdə bu idxal üçün kifayət qədər boş yer yoxdur.',409);

  const seen=new Set();
  const accounts=b.rows.map((row,index)=>{
    const line=Number.isSafeInteger(row?.line)&&row.line>=2&&row.line<=1048576?row.line:index+2;
    try {
      if(!row||typeof row!=='object')fail('İstifadəçi məlumatları yanlışdır.');
      const name=str(row.name);
      const mail=email(row.email);
      const pass=password(row.password);
      const role=choose(row.role??'member',['admin','member']);
      if(seen.has(mail)||one('SELECT id FROM users WHERE email=?',mail))fail('Bu e-poçt ünvanı artıq istifadə olunur.',409);
      seen.add(mail);
      return {name,mail,pass,role};
    } catch(error) {
      if(!error.status)throw error;
      fail(`Excel sətiri ${line}. ${error.message}`,error.status);
    }
  });
  for(const account of accounts)user(account.name,account.mail,account.pass,account.role,target.id);
  return accounts.length;
}
const statuses=['todo','doing','review','done'], priorities=['low','normal','high'];
if(!one('SELECT id FROM users LIMIT 1'))tx(()=>{
  // Accept the legacy spelling used by the initial Hostinger deployment.
  const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIIN_EMAIL;
  if(!demo&&(!adminEmail||!process.env.ADMIN_PASSWORD))throw Error('İlk açılış üçün ADMIN_EMAIL və ADMIN_PASSWORD dəyişənlərini təyin edin.');
  const plan=insert('INSERT INTO plans(name,seats) VALUES(?,?)','Business',12);
  user('Platforma administratoru',demo?'platform@meridian.test':adminEmail,demo?'MeridianDemo2026':process.env.ADMIN_PASSWORD,'platform',null);
  if(!demo)return;
  const c=insert('INSERT INTO companies(name,plan) VALUES(?,?)','Atelier Studio',plan);
  const a=user('Leyla Məmmədova','leyla@meridian.test','MeridianDemo2026','admin',c);
  const b=user('Murad Əliyev','murad@meridian.test','MeridianDemo2026','member',c);
  const d=user('Aysel Quliyeva','aysel@meridian.test','MeridianDemo2026','member',c);
  user('Super Admin','r.tural.94@gmail.com','Admin123456789*','platform',null);
  const cAtm=insert('INSERT INTO companies(name,plan) VALUES(?,?)','ATM',plan);
  const aAtm=user('Şirkət Admini','info@atm.gov.az','ATM123456789*','admin',cAtm);
  const uAtm=user('Tural Rüstəmov','tural.rustamov@atm.gov.az','ATM123456789*','member',cAtm);
  const pAtm=insert('INSERT INTO projects(name,company) VALUES(?,?)','ATM Layihəsi',cAtm);
  const gAtm=insert('INSERT INTO groups(company,name,lead) VALUES(?,?,?)',cAtm,'İnformasiya Texnologiyaları Şöbəsi',uAtm);
  insert('INSERT INTO group_members(group_id,user_id) VALUES(?,?)',gAtm,uAtm);
  insert('INSERT INTO group_members(group_id,user_id) VALUES(?,?)',gAtm,aAtm);
  insert('INSERT INTO tasks(title,details,project,owner,status,priority,due,group_id) VALUES(?,?,?,?,?,?,?,?)','İlkin tapşırıq','Sistemə xoş gəlmisiniz.',pAtm,uAtm,'doing','high',new Date().toISOString().slice(0,10),gAtm);
  const p=['Brend strategiyası','Rəqəmsal məhsul','Əməliyyat planı'].map(n=>insert('INSERT INTO projects(name,company) VALUES(?,?)',n,c));
  ['Brend kitabçasının hazırlanması','Müştəri müsahibələrinin planı','Ana səhifənin dizaynı','Komanda büdcəsinin təsdiqi','Mobil prototipin sınağı','Tərəfdaş təqdimatının icmalı','İstifadəçi axınlarının xəritəsi','Rüblük hədəflərin təhlili','Vizual üslubun təsdiqi'].forEach((t,i)=>{
    const date=new Date();date.setUTCDate(date.getUTCDate()+i-2);
    insert('INSERT INTO tasks(title,details,project,owner,status,priority,due) VALUES(?,?,?,?,?,?,?)',t,'Nəticəni komanda ilə paylaşın və yekun rəyi qeyd edin.',p[[0,0,1,2,1,0,1,2,0][i]],[a,b,d][i%3],statuses[[0,0,1,2,1,2,3,0,3][i]],priorities[(i+2)%3],date.toISOString().slice(0,10));
  });
});
const publicUser='id,name,email,role,company,active,avatar';
const companySQL='SELECT c.*,p.name AS package,coalesce(c.cap,p.seats) AS seats,(SELECT count(*) FROM users u WHERE u.company=c.id AND active=1) AS used FROM companies c JOIN plans p ON p.id=c.plan';
function company(id){return one(companySQL+' WHERE c.id=?',id)||fail('Şirkət tapılmadı.',404);}
function task(id,c,u){
  if(u?.role==='platform')return one('SELECT t.*, p.company AS company_id FROM tasks t JOIN projects p ON t.project=p.id WHERE t.id=?',id)||fail('Tapşırıq tapılmadı.',404);
  const t=one('SELECT t.*, p.company AS company_id FROM tasks t JOIN projects p ON t.project=p.id WHERE t.id=? AND p.company=?',id,c)||fail('Tapşırıq tapılmadı.',404);
  if(u&&u.role!=='admin'&&u.role!=='platform'){
    const isLead=t.group_id&&one('SELECT 1 FROM groups WHERE id=? AND lead=?',t.group_id,u.id);
    if(t.owner!==u.id&&t.created_by!==u.id&&t.supervisor!==u.id&&!isLead)fail('Yalnız sizə təyin edilən, nəzarət etdiyiniz və ya yaratdığınız tapşırıqlara icazəniz var.',403);
  }
  return t;
}
function staff(u){if(u.role!=='admin')fail('Şirkət administratorunun icazəsi tələb olunur.',403);}
function platform(u){if(u.role!=='platform')fail('Platforma administratorunun icazəsi tələb olunur.',403);}
function getNotesForUser(userId){
  const rows=all(`
    SELECT n.*, u.name AS author_name,
      (SELECT json_group_array(s.user_id) FROM note_shares s WHERE s.note_id=n.id) AS shared_with
    FROM notes n
    LEFT JOIN users u ON u.id=n.user
    WHERE n.user=? OR n.id IN (SELECT note_id FROM note_shares WHERE user_id=?)
    ORDER BY n.id DESC
  `,userId,userId);
  return rows.map(r=>({
    ...r,
    shared_with:JSON.parse(r.shared_with||'[]').filter(x=>Number.isSafeInteger(x)&&x>0)
  }));
}
function state(u){
  const notes=getNotesForUser(u.id);
  if(u.role==='platform'){
    const groups=all(`SELECT g.*, u.name AS lead_name, c.name AS company_name, (SELECT json_group_array(user_id) FROM group_members WHERE group_id=g.id) AS member_ids FROM groups g LEFT JOIN users u ON u.id=g.lead LEFT JOIN companies c ON c.id=g.company ORDER BY g.id`).map(g=>({
      ...g,
      member_ids:JSON.parse(g.member_ids||'[]')
    }));
    const tasks=all('SELECT t.*, g.name AS group_name, p.company AS company_id, c.name AS company_name FROM tasks t JOIN projects p ON p.id=t.project LEFT JOIN companies c ON c.id=p.company LEFT JOIN groups g ON g.id=t.group_id ORDER BY t.id');
    const projects=all('SELECT p.*, c.name AS company_name FROM projects p JOIN companies c ON c.id=p.company ORDER BY p.id');
    const comments=all('SELECT m.* FROM comments m JOIN tasks t ON t.id=m.task ORDER BY m.id');
    const history=all('SELECT h.*, u.name AS actor_name FROM task_history h LEFT JOIN users u ON u.id=h.actor ORDER BY h.id ASC');
    return {
      me:u,
      company:null,
      plans:all('SELECT * FROM plans ORDER BY id'),
      companies:all(companySQL+' ORDER BY c.id'),
      users:all('SELECT '+publicUser+' FROM users ORDER BY id'),
      groups,
      projects,
      tasks,
      comments,
      history,
      notes
    };
  }
  const c=u.company;
  const groups=all(`SELECT g.*, u.name AS lead_name, (SELECT json_group_array(user_id) FROM group_members WHERE group_id=g.id) AS member_ids FROM groups g LEFT JOIN users u ON u.id=g.lead WHERE g.company=? ORDER BY g.id`, c).map(g=>({
    ...g,
    member_ids:JSON.parse(g.member_ids||'[]')
  }));
  const tasks=(u.role==='admin')
    ? all('SELECT t.*, g.name AS group_name, p.company AS company_id FROM tasks t JOIN projects p ON p.id=t.project LEFT JOIN groups g ON g.id=t.group_id WHERE p.company=? ORDER BY t.id', c)
    : all('SELECT t.*, g.name AS group_name, p.company AS company_id FROM tasks t JOIN projects p ON p.id=t.project LEFT JOIN groups g ON g.id=t.group_id WHERE p.company=? AND (t.owner=? OR t.created_by=? OR t.supervisor=? OR (t.group_id IS NOT NULL AND t.group_id IN (SELECT id FROM groups WHERE lead=?))) ORDER BY t.id', c, u.id, u.id, u.id, u.id);
  const comments=(u.role==='admin')
    ? all('SELECT m.* FROM comments m JOIN tasks t ON t.id=m.task JOIN projects p ON p.id=t.project WHERE p.company=? ORDER BY m.id', c)
    : all('SELECT m.* FROM comments m JOIN tasks t ON t.id=m.task JOIN projects p ON p.id=t.project WHERE p.company=? AND (t.owner=? OR t.created_by=? OR t.supervisor=? OR (t.group_id IS NOT NULL AND t.group_id IN (SELECT id FROM groups WHERE lead=?))) ORDER BY m.id', c, u.id, u.id, u.id, u.id);
  const history=(u.role==='admin')
    ? all('SELECT h.*, u.name AS actor_name FROM task_history h JOIN tasks t ON t.id=h.task JOIN projects p ON p.id=t.project LEFT JOIN users u ON u.id=h.actor WHERE p.company=? ORDER BY h.id ASC', c)
    : all('SELECT h.*, u.name AS actor_name FROM task_history h JOIN tasks t ON t.id=h.task JOIN projects p ON p.id=t.project LEFT JOIN users u ON u.id=h.actor WHERE p.company=? AND (t.owner=? OR t.created_by=? OR t.supervisor=? OR (t.group_id IS NOT NULL AND t.group_id IN (SELECT id FROM groups WHERE lead=?))) ORDER BY h.id ASC', c, u.id, u.id, u.id, u.id);
  return {me:u,company:company(c),users:all('SELECT '+publicUser+' FROM users WHERE company=?',c),groups,projects:all('SELECT * FROM projects WHERE company=?',c),tasks,comments,history,notes};
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
      const isSuper=u.role==='platform';
      const old=b.id?(one('SELECT * FROM users WHERE id=?',b.id)||fail('İstifadəçi tapılmadı.',404)):null;
      if(!isSuper&&old&&old.company!==u.company)fail('Yalnız öz şirkətinizin istifadəçilərini idarə edə bilərsiniz.',403);
      const allowedRoles=isSuper?['platform','admin','member']:['admin','member'];
      const role=choose(b.role,allowedRoles);
      const active=b.active===false?0:1;
      let targetCompany=null;
      if(role!=='platform'){
        const compId=isSuper?Number(b.company):u.company;
        if(!compId)fail('Şirkət seçin.');
        targetCompany=company(compId);
        const isNewToCompany=(!old||old.company!==targetCompany.id||!old.active)&&active;
        if(isNewToCompany&&targetCompany.used>=targetCompany.seats)fail('Şirkətin istifadəçi limiti dolub.',409);
      }
      if(old){
        if(old.id===u.id&&(!active||role!==u.role))fail('Öz administrator hesabınızın rolunu və ya aktivliyini dəyişə bilməzsiniz.');
        if(!isSuper&&old.company&&old.active&&old.role==='admin'&&(!active||role!=='admin')&&!one("SELECT id FROM users WHERE role='admin' AND active=1 AND company=? AND id<>?",old.company,old.id))fail('Şirkətdə aktiv administrator qalmalıdır.');
        const compVal=targetCompany?targetCompany.id:null;
        run('UPDATE users SET name=?,email=?,role=?,company=?,active=? WHERE id=?',str(b.name),email(b.email),role,compVal,active,old.id);
        if(b.password)run('UPDATE users SET hash=? WHERE id=?',hash(b.password),old.id);
        if(old.company&&compVal!==old.company)run('UPDATE tasks SET owner=NULL WHERE owner=? AND project IN (SELECT id FROM projects WHERE company=?)',old.id,old.company);
        if(!active||b.password||role!==old.role||compVal!==old.company)run('DELETE FROM sessions WHERE user=?',old.id);
      }else{
        const compVal=targetCompany?targetCompany.id:null;
        user(b.name,b.email,b.password,role,compVal);
      }
      break;
    }
    case 'deleteUser':{
      platform(u);
      const target=one('SELECT * FROM users WHERE id=?',b.id)||fail('İstifadəçi tapılmadı.',404);
      if(target.id===u.id)fail('Öz super administrator hesabınızı silə bilməzsiniz.');
      if(target.role==='platform'&&!one("SELECT id FROM users WHERE role='platform' AND id<>?",target.id))fail('Sistemdə ən azı bir super administrator qalmalıdır.');
      run('UPDATE tasks SET owner=NULL WHERE owner=?',target.id);
      run('UPDATE comments SET author=NULL WHERE author=?',target.id);
      run('UPDATE groups SET lead=NULL WHERE lead=?',target.id);
      run('DELETE FROM group_members WHERE user_id=?',target.id);
      run('DELETE FROM note_shares WHERE user_id=? OR note_id IN (SELECT id FROM notes WHERE user=?)',target.id,target.id);
      run('DELETE FROM notes WHERE user=?',target.id);
      run('DELETE FROM sessions WHERE user=?',target.id);
      run('DELETE FROM users WHERE id=?',target.id);
      break;
    }
    case 'profile':{
      const newName=str(b.name,120);
      const newEmail=email(b.email);
      if(one('SELECT id FROM users WHERE email=? AND id<>?',newEmail,u.id)){
        fail('Bu e-poçt ünvanı artıq istifadə olunur.',409);
      }
      let avatarVal=u.avatar||null;
      if(b.avatar!==undefined){
        if(!b.avatar){
          avatarVal=null;
        }else if(typeof b.avatar==='string'){
          if(!b.avatar.startsWith('data:image/')){
            fail('Yalnız şəkil formatı qəbul olunur.');
          }
          if(b.avatar.length>1.5*1024*1024){
            fail('Profil şəklinin həcmi çox böyükdür (maksimum 1 MB).');
          }
          avatarVal=b.avatar;
        }
      }
      run('UPDATE users SET name=?, email=?, avatar=? WHERE id=?',newName,newEmail,avatarVal,u.id);
      if(b.password){
        run('UPDATE users SET hash=? WHERE id=?',hash(b.password),u.id);
      }
      u.name=newName;
      u.email=newEmail;
      u.avatar=avatarVal;
      break;
    }
    case 'group':{
      const isSuper=u.role==='platform';
      if(!isSuper)staff(u);
      let targetCompanyId=isSuper?Number(b.company):u.company;
      if(b.id){
        const ex=one('SELECT company FROM groups WHERE id=?',Number(b.id));
        if(ex)targetCompanyId=ex.company;
      }
      if(!targetCompanyId||!one('SELECT id FROM companies WHERE id=?',targetCompanyId))fail('Şirkət seçin.');
      const name=str(b.name,120);
      let lead=b.lead?Number(b.lead):null;
      if(lead&&!one('SELECT id FROM users WHERE id=? AND company=? AND active=1',lead,targetCompanyId)){
        fail('Aktiv şöbə rəhbəri seçin.');
      }
      let members=Array.isArray(b.members)?[...new Set(b.members.map(Number))]:[];
      for(const mId of members){
        if(!one('SELECT id FROM users WHERE id=? AND company=? AND active=1',mId,targetCompanyId)){
          fail('Şöbə üzvləri aktiv əməkdaşlar olmalıdır.');
        }
      }
      if(lead&&!members.includes(lead)){
        members.push(lead);
      }

      let groupId=b.id?Number(b.id):null;
      if(groupId){
        const existing=one('SELECT id FROM groups WHERE id=? AND company=?',groupId,targetCompanyId);
        if(!existing)fail('Şöbə tapılmadı.',404);
        run('UPDATE groups SET name=?, lead=? WHERE id=?',name,lead,groupId);
        run('DELETE FROM group_members WHERE group_id=?',groupId);
      }else{
        groupId=insert('INSERT INTO groups(company, name, lead) VALUES(?,?,?)',targetCompanyId,name,lead);
      }

      for(const mId of members){
        run('INSERT OR IGNORE INTO group_members(group_id, user_id) VALUES(?,?)',groupId,mId);
      }
      break;
    }
    case 'deleteGroup':{
      const isSuper=u.role==='platform';
      if(!isSuper)staff(u);
      const target=isSuper
        ? one('SELECT id FROM groups WHERE id=?',Number(b.id))
        : one('SELECT id FROM groups WHERE id=? AND company=?',Number(b.id),u.company);
      if(!target)fail('Şöbə tapılmadı.',404);
      run('UPDATE tasks SET group_id=NULL WHERE group_id=?',target.id);
      run('DELETE FROM group_members WHERE group_id=?',target.id);
      run('DELETE FROM groups WHERE id=?',target.id);
      break;
    }
    case 'project':{
      const name=str(b.name,120);
      if(b.id){
        const pId=Number(b.id);
        const p=one('SELECT * FROM projects WHERE id=?',pId)||fail('Layihə tapılmadı.',404);
        if(u.role!=='platform'){
          staff(u);
          if(p.company!==u.company)fail('Yalnız öz şirkətinizin layihələrini redaktə edə bilərsiniz.',403);
        }
        let targetCompany=p.company;
        if(u.role==='platform'&&b.company){
          const cId=Number(b.company);
          if(!one('SELECT id FROM companies WHERE id=?',cId))fail('Şirkət seçin.');
          targetCompany=cId;
        }
        run('UPDATE projects SET name=?, company=? WHERE id=?',name,targetCompany,pId);
      }else{
        if(u.role==='platform'){
          const cId=Number(b.company);
          if(!cId||!one('SELECT id FROM companies WHERE id=?',cId))fail('Şirkət seçin.');
          insert('INSERT INTO projects(name,company) VALUES(?,?)',name,cId);
        }else{
          staff(u);
          insert('INSERT INTO projects(name,company) VALUES(?,?)',name,u.company);
        }
      }
      break;
    }
    case 'task':{
      const isEditing=!!b.id;
      let t=null;
      if(isEditing){
        t=task(b.id,u.company,u);
        const isLead=t.group_id&&one('SELECT 1 FROM groups WHERE id=? AND lead=?',t.group_id,u.id);
        if(u.role!=='platform'&&u.role!=='admin'&&!isLead&&t.owner!==u.id&&t.created_by!==u.id)fail('Şirkət administratorunun və ya tapşırıq sahibinin icazəsi tələb olunur.',403);
      }else{
        if(u.role!=='platform'&&!u.company)fail('Şirkət hesabı tələb olunur.',403);
      }
      let proj=b.project?one('SELECT * FROM projects WHERE id=?',Number(b.project)):null;
      if(!proj&&u.role==='platform'&&b.company){
        const compId=Number(b.company);
        let p=one('SELECT * FROM projects WHERE company=? ORDER BY id LIMIT 1',compId);
        if(!p&&one('SELECT id FROM companies WHERE id=?',compId)){
          const newPId=insert('INSERT INTO projects(name,company) VALUES(?,?)','Əsas Layihə',compId);
          p=one('SELECT * FROM projects WHERE id=?',newPId);
        }
        proj=p;
      }
      if(!proj||(u.role!=='platform'&&proj.company!==u.company))fail('Layihə seçin.');
      const targetCompany=proj.company;
      const due=b.due||'';if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||isNaN(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due))fail('Tarixi yoxlayın.');
      const status=choose(b.status||'todo',statuses);
      const priority=choose(b.priority||'normal',priorities);
      const title=str(b.title,200);
      const details=b.details?str(b.details,5000):'';
      const project=proj.id;
      
      let groupId=b.group?Number(b.group):null;
      if(groupId&&!isEditing){
        const grp=one('SELECT * FROM groups WHERE id=? AND company=?',groupId,targetCompany);
        if(!grp)fail('Şöbə tapılmadı.');
        if(!grp.lead||!one('SELECT id FROM users WHERE id=? AND company=? AND active=1',grp.lead,targetCompany)){
          fail('Seçilən şöbə üçün aktiv rəhbər təyin edilməyib.');
        }
      }

      if(isEditing){
        const owner=b.owner?Number(b.owner):(Array.isArray(b.owners)&&b.owners[0]?Number(b.owners[0]):null);
        if(!owner||!one('SELECT id FROM users WHERE id=? AND company=? AND active=1',owner,targetCompany))fail('Aktiv məsul şəxs seçin.');
        if(u.role!=='platform'&&u.role!=='admin'&&t.group_id){
          if(!one('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?',t.group_id,owner))fail('Seçilən əməkdaş bu şöbənin üzvü olmalıdır.');
        }
        const finalGroupId=(b.group!==undefined)?(b.group?Number(b.group):null):t.group_id;
        const finalSupervisor=(b.supervisor!==undefined)?(b.supervisor?Number(b.supervisor):null):t.supervisor;
        if(finalSupervisor&&!one('SELECT id FROM users WHERE id=? AND company=? AND active=1',finalSupervisor,targetCompany)){
          fail('Aktiv nəzarətçi seçin.');
        }
        if(!run('UPDATE tasks SET title=?,details=?,project=?,owner=?,status=?,priority=?,due=?,group_id=?,supervisor=?,version=version+1 WHERE id=? AND version=?',title,details,project,owner,status,priority,due,finalGroupId,finalSupervisor,b.id,b.version).changes)fail('Tapşırıq dəyişib. Yeniləyib təkrar açın.',409);

        if(t.owner!==owner){
          const oldO=one('SELECT name FROM users WHERE id=?',t.owner);
          const newO=one('SELECT name FROM users WHERE id=?',owner);
          logTaskHistory(t.id, u.id, 'reassigned', `Məsul şəxs dəyişdirildi: ${oldO?.name||'Təyin edilməyib'} ➔ ${newO?.name||'Təyin edilməyib'}`);
        }
        if(t.supervisor!==finalSupervisor){
          const oldS=t.supervisor?one('SELECT name FROM users WHERE id=?',t.supervisor):null;
          const newS=finalSupervisor?one('SELECT name FROM users WHERE id=?',finalSupervisor):null;
          logTaskHistory(t.id, u.id, 'supervisor', `Tapşırığa nəzarətçi dəyişdirildi: ${oldS?.name||'Təyin edilməyib'} ➔ ${newS?.name||'Təyin edilməyib'}`);
        }
        if(t.status!==status){
          logTaskHistory(t.id, u.id, 'status', `Mərhələ dəyişdirildi: ${statusNamesAz[t.status]||t.status} ➔ ${statusNamesAz[status]||status}`);
        }
        if(t.priority!==priority){
          logTaskHistory(t.id, u.id, 'priority', `Prioritet dəyişdirildi: ${priorityNamesAz[t.priority]||t.priority} ➔ ${priorityNamesAz[priority]||priority}`);
        }
        if(t.title!==title||t.details!==details||t.due!==due||t.project!==project){
          let changeDetails=[];
          if(t.title!==title)changeDetails.push(`Ad: "${title}"`);
          if(t.due!==due)changeDetails.push(`Son tarix: ${due||'Tarixsiz'}`);
          if(t.project!==project){
            const prj=one('SELECT name FROM projects WHERE id=?',project);
            changeDetails.push(`Layihə: ${prj?.name||project}`);
          }
          if(t.details!==details)changeDetails.push(`Təsvir yeniləndi`);
          logTaskHistory(t.id, u.id, 'edited', `Parametrlər yeniləndi: ${changeDetails.join(', ')}`);
        }
      }else{
        let owners=[];
        if(b.target==='leader'){
          const leadUser=one("SELECT id FROM users WHERE company=? AND role='admin' AND active=1 ORDER BY id LIMIT 1",targetCompany);
          if(!leadUser)fail('Qurum üzrə aktiv rəhbər tapılmadı.');
          owners=[leadUser.id];
        }else if(groupId){
          const grp=one('SELECT lead FROM groups WHERE id=?',groupId);
          owners=[grp.lead];
        }else if(Array.isArray(b.owners)){
          owners=b.owners.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0);
        }else if(b.owner){
          owners=[Number(b.owner)];
        }
        owners=[...new Set(owners)];
        if(!owners.length)fail('Tapşırıq üçün ən azı bir məsul şəxs, qurum rəhbəri və ya şöbə seçilməlidir.');
        for(const o of owners){
          if(!one('SELECT id FROM users WHERE id=? AND company=? AND active=1',o,targetCompany))fail('Seçilən əməkdaş və ya rəhbər aktiv olmalıdır.');
        }
        const supervisor=(b.supervisor&&one('SELECT id FROM users WHERE id=? AND company=? AND active=1',Number(b.supervisor),targetCompany))?Number(b.supervisor):null;
        const supUser=supervisor?one('SELECT name FROM users WHERE id=?',supervisor):null;

        for(const o of owners){
          const newTaskId=insert('INSERT INTO tasks(title,details,project,owner,status,priority,due,group_id,created_by,supervisor) VALUES(?,?,?,?,?,?,?,?,?,?)',title,details,project,o,status,priority,due,groupId,u.id,supervisor);
          const oUser=one('SELECT name FROM users WHERE id=?',o);
          let logTxt=`Tapşırıq yaradıldı. Məsul şəxs: ${oUser?.name||'Təyin edilməyib'}`;
          if(supUser)logTxt+=`, Nəzarətçi: ${supUser.name}`;
          if(groupId){
            const gObj=one('SELECT name FROM groups WHERE id=?',groupId);
            if(gObj)logTxt+=` (${gObj.name} şöbəsi)`;
          }
          logTaskHistory(newTaskId, u.id, 'created', logTxt);
        }
      }
      break;
    }
    case 'delegateTask':{
      if(u.role!=='platform'&&!u.company)fail('Şirkət hesabı tələb olunur.',403);
      const t=task(b.id,u.company,u);
      const targetCompany=t.company_id;
      const isLead=t.group_id&&one('SELECT 1 FROM groups WHERE id=? AND lead=?',t.group_id,u.id);
      if(u.role!=='platform'&&u.role!=='admin'&&!isLead)fail('Yalnız şirkət administratoru və ya qrup rəhbəri tapşırığı təhkim edə bilər.',403);
      
      let owners=[];
      if(Array.isArray(b.owners)){
        owners=b.owners.map(Number).filter(id=>Number.isSafeInteger(id)&&id>0);
      }else if(b.owner){
        owners=[Number(b.owner)];
      }
      owners=[...new Set(owners)];
      if(!owners.length)fail('Ən azı bir məsul şəxs seçilməlidir.');

      if(u.role!=='platform'&&u.role!=='admin'&&t.group_id){
        for(const oId of owners){
          if(!one('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?',t.group_id,oId)){
            fail('Seçilən əməkdaş bu şöbənin üzvü olmalıdır.');
          }
        }
      }else{
        for(const oId of owners){
          if(!one('SELECT 1 FROM users WHERE id=? AND company=? AND active=1',oId,targetCompany)){
            fail('Seçilən əməkdaş aktiv olmalıdır.');
          }
        }
      }

      const oldOwner=one('SELECT name FROM users WHERE id=?',t.owner);
      const newOwner=one('SELECT name FROM users WHERE id=?',owners[0]);
      run('UPDATE tasks SET owner=?, version=version+1 WHERE id=?',owners[0],t.id);
      logTaskHistory(t.id, u.id, 'delegated', `Tapşırıq yönləndirildi: ${oldOwner?.name||'Bilinmir'} ➔ ${newOwner?.name||'Bilinmir'}`);
      for(let i=1;i<owners.length;i++){
        const clonedId=insert('INSERT INTO tasks(title,details,project,owner,status,priority,due,group_id,created_by,supervisor) VALUES(?,?,?,?,?,?,?,?,?,?)',t.title,t.details,t.project,owners[i],t.status,t.priority,t.due,t.group_id,u.id,t.supervisor);
        const oUser=one('SELECT name FROM users WHERE id=?',owners[i]);
        logTaskHistory(clonedId, u.id, 'created', `Tapşırıq şöbə daxilində yönləndirilmə ilə yaradıldı. Məsul şəxs: ${oUser?.name||'Bilinmir'}`);
      }
      break;
    }
    case 'note':{
      const content=str(b.content,10000);
      const title=b.title?str(b.title,200):'';
      let date=b.date||null;
      if(date){
        date=String(date).trim();
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Tarixi yoxlayın.');
      }
      let noteId=b.id?Number(b.id):null;
      if(noteId){
        const existing=one('SELECT id FROM notes WHERE id=? AND user=?',noteId,u.id);
        if(!existing)fail('Qeyd tapılmadı.',404);
        run('UPDATE notes SET title=?,content=?,date=? WHERE id=?',title,content,date,existing.id);
      }else{
        noteId=insert('INSERT INTO notes(user,title,content,date) VALUES(?,?,?,?)',u.id,title,content,date);
      }
      if(Array.isArray(b.shared_with)){
        run('DELETE FROM note_shares WHERE note_id=?',noteId);
        const shareUsers=[...new Set(b.shared_with.map(Number))].filter(id=>id&&id!==u.id);
        for(const sId of shareUsers){
          if(one('SELECT id FROM users WHERE id=? AND active=1',sId)){
            run('INSERT OR IGNORE INTO note_shares(note_id,user_id) VALUES(?,?)',noteId,sId);
          }
        }
      }
      break;
    }
    case 'shareNote':{
      const noteId=Number(b.id);
      const existing=one('SELECT id FROM notes WHERE id=? AND user=?',noteId,u.id);
      if(!existing)fail('Yalnız öz qeydlərinizi paylaşa bilərsiniz.',403);
      run('DELETE FROM note_shares WHERE note_id=?',existing.id);
      const shareUsers=Array.isArray(b.users)?[...new Set(b.users.map(Number))].filter(id=>id&&id!==u.id):[];
      for(const sId of shareUsers){
        if(one('SELECT id FROM users WHERE id=? AND active=1',sId)){
          run('INSERT OR IGNORE INTO note_shares(note_id,user_id) VALUES(?,?)',existing.id,sId);
        }
      }
      break;
    }
    case 'deleteNote':{
      const noteId=Number(b.id);
      const existing=one('SELECT id, user FROM notes WHERE id=?',noteId);
      if(!existing)fail('Qeyd tapılmadı.',404);
      if(existing.user===u.id){
        run('DELETE FROM note_shares WHERE note_id=?',existing.id);
        run('DELETE FROM notes WHERE id=?',existing.id);
      }else{
        const share=one('SELECT 1 FROM note_shares WHERE note_id=? AND user_id=?',existing.id,u.id);
        if(!share)fail('Qeyd tapılmadı.',404);
        run('DELETE FROM note_shares WHERE note_id=? AND user_id=?',existing.id,u.id);
      }
      break;
    }
    case 'status':case 'comment':case 'deleteTask':{
      if(u.role!=='platform'&&!u.company)fail('Şirkət hesabı tələb olunur.',403);
      const t=task(b.id,u.company,u);
      if(action==='comment'){
        const commentBody=str(b.body,3000);
        insert('INSERT INTO comments(task,author,body) VALUES(?,?,?)',t.id,u.id,commentBody);
        const preview=commentBody.length>60?commentBody.slice(0,60)+'...':commentBody;
        logTaskHistory(t.id, u.id, 'comment', `Şərh əlavə edildi: "${preview}"`);
        break;
      }
      if(action==='deleteTask'){
        if(u.role!=='platform'&&u.role!=='admin'&&t.created_by!==u.id)fail('Yalnız tapşırığı yaradan şəxs və ya administrator silə bilər.',403);
      }else if(u.role!=='platform'&&u.role!=='admin'&&t.owner!==u.id&&t.created_by!==u.id&&t.supervisor!==u.id)fail('Yalnız sizə təyin edilən, yaratdığınız və ya nəzarət etdiyiniz tapşırığı keçirə bilərsiniz.',403);
      if(t.version!==b.version)fail('Tapşırıq dəyişib. Yeniləyib təkrar açın.',409);
      if(action==='deleteTask')run('DELETE FROM tasks WHERE id=?',t.id);
      else {
        const newStatus=choose(b.status,statuses);
        run('UPDATE tasks SET status=?,version=version+1 WHERE id=?',newStatus,t.id);
        if(t.status!==newStatus){
          logTaskHistory(t.id, u.id, 'status', `Mərhələ dəyişdirildi: ${statusNamesAz[t.status]||t.status} ➔ ${statusNamesAz[newStatus]||newStatus}`);
        }
      }
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
    if(path.startsWith('/api/demo/'))fail('Ünvan tapılmadı.',404);
    if(!path.startsWith('/api/')){
      const file=resolve(web,'.'+decodeURIComponent(path==='/'?'/index.html':path));
      if(!file.startsWith(web+sep)||!existsSync(file))fail('Tapılmadı.',404);
      res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.ttf':'font/ttf','.png':'image/png'})[extname(file)]||'application/octet-stream');
      res.setHeader('Cache-Control','no-cache');
      return res.end(readFileSync(file));
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
      const bodyLimit=path==='/api/importUsers'?131072:(path==='/api/profile'?2097152:32768);
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>bodyLimit)fail('Sorğu çox böyükdür.',413);chunks.push(chunk);}
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
    if(path==='/api/importUsers')return json(200,{imported:tx(()=>importUsers(b,u))});
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
