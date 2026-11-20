import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';

test('Şirkətlər, limitlər, səlahiyyətlər və tapşırıqlar',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'meridian-test-'));
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
  const password='LocalTestPass2026';
  const server=spawn(process.execPath,[fileURLToPath(new URL('../index.js',import.meta.url))],{env:{...process.env,NODE_ENV:'production',DATA_DIR:dir,PORT:String(port),HOST:'127.0.0.1',ADMIN_EMAIL:'root@test.local',ADMIN_PASSWORD:password},stdio:['ignore','pipe','inherit']});
  t.after(async()=>{if(server.exitCode===null){const ended=once(server,'exit');server.kill();await ended}await rm(dir,{recursive:true,force:true})});
  await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('Server dayandı')})]);
  const req=async(path,cookie='',body)=>fetch('http://127.0.0.1:'+port+'/api/'+path,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  async function sign(email){const r=await req('login','',{email,password});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]}
  async function state(c){return (await req('state',c)).json()}
  async function post(path,cookie,body,code=200){const r=await req(path,cookie,body);assert.equal(r.status,code,await r.text())}
  const root=await sign('root@test.local');
  await post('plan',root,{name:'Studio',seats:2,monthly:49});
  for(const n of ['alpha','beta'])await post('company',root,{name:n,plan:2,adminName:n,email:n+'@test.local',password});
  await post('company',root,{name:'rollback',plan:2,adminName:'test',email:'alpha@test.local',password},409);
  assert.equal((await state(root)).companies.length,2);
  const a=await sign('alpha@test.local'),b=await sign('beta@test.local');
  const mkUser=(n)=>({name:n,email:n+'@test.local',password,role:'member'});
  const simultaneous=await Promise.all(['member','other'].map(n=>req('user',a,mkUser(n))));
  assert.deepEqual(simultaneous.map(x=>x.status).sort(),[200,409]);
  const member=(await state(a)).users.find(u=>u.role==='member');const m=await sign(member.email);
  await post('plan',root,{id:2,name:'Studio',seats:1,monthly:40},400);
  await post('company',root,{id:1,plan:2,name:'alpha',cap:3});
  await post('user',root,{...mkUser('third'),company:1});
  await post('project',a,{name:'Dizayn'});await post('project',b,{name:'Satış'});
  await post('task',a,{title:'İcmal',details:'Test',project:1,status:'todo',owner:member.id,priority:'high',due:'2026-12-02'});
  assert.equal((await state(b)).tasks.length,0);
  await post('comment',b,{id:1,body:'Şərh'},404);await post('status',b,{id:1,version:1,status:'doing'},404);
  await post('project',m,{name:'Yanlış rol'},403);
  await post('status',m,{id:1,version:1,status:'doing'});await post('status',a,{id:1,version:1,status:'done'},409);
  await post('comment',m,{id:1,body:'Hazırdır'});assert.equal((await state(a)).comments.length,1);
  await post('user',a,{...member,active:false,password:''});assert.equal((await req('state',m)).status,401);
  await post('deleteTask',a,{id:1,version:2});assert.equal((await state(a)).comments.length,0);
  await post('task',a,{title:'Xəta',details:'',project:1,status:'todo',owners:[]},400);
  await post('note',a,{title:'Qeyd 1',content:'Təqvim qeydi',date:'2026-11-25'});
  await post('note',a,{title:'Sərbəst qeyd',content:'Fikirlər'});
  const notesAfter=(await state(a)).notes;
  assert.equal(notesAfter.length,2);
  assert.equal(notesAfter.find(n=>n.title==='Qeyd 1').date,'2026-11-25');
  assert.equal(notesAfter.find(n=>n.title==='Sərbəst qeyd').date,null);
  await post('deleteNote',a,{id:notesAfter[0].id});
  assert.equal((await state(a)).notes.length,1);
  const importRows=[
    {line:2,name:'Excel Member',email:'excel-member@test.local',password},
    {line:4,name:'Excel Admin',email:'excel-admin@test.local',password,role:'admin'},
  ];
  await post('importUsers',b,{company:1,rows:importRows},409);
  await post('company',root,{id:2,plan:2,name:'beta',cap:3});
  await post('importUsers',await sign('third@test.local'),{company:2,rows:importRows},403);
  const invalidImport=await req('importUsers',b,{company:1,rows:[
    importRows[0],{...importRows[1],email:'alpha@test.local'},
  ]});
  assert.equal(invalidImport.status,409);
  assert.match((await invalidImport.json()).error,/Excel sətiri 4/);
  assert.equal((await state(b)).users.length,1);
  const imported=await req('importUsers',b,{company:1,rows:importRows});
  assert.equal(imported.status,200);
  assert.deepEqual(await imported.json(),{imported:2});
  assert.ok(!(await state(a)).users.some(account=>account.email==='excel-member@test.local'));
  assert.equal((await state(await sign('excel-admin@test.local'))).me.role,'admin');
  assert.equal((await state(await sign('excel-member@test.local'))).me.role,'member');
  await post('logout',a,{});assert.equal((await req('state',a)).status,401);
});
