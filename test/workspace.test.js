import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
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
  const sampleAvatar='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  await post('profile',a,{name:'Alpha Boss',email:'alpha-new@test.local',password:'NewPassword2026*',avatar:sampleAvatar});
  const aState=await state(a);
  assert.equal(aState.me.name,'Alpha Boss');
  assert.equal(aState.me.email,'alpha-new@test.local');
  assert.equal(aState.me.avatar,sampleAvatar);
  assert.equal(aState.users.find(u=>u.id===aState.me.id).avatar,sampleAvatar);
  await post('profile',a,{name:'Alpha Boss',email:'alpha-new@test.local',avatar:'invalid-avatar-format'},400);
  await post('profile',a,{name:'Alpha Boss',email:'alpha-new@test.local',avatar:''});
  assert.equal((await state(a)).me.avatar,null);
  const aLogin=await req('login','',{email:'alpha-new@test.local',password:'NewPassword2026*'});
  assert.equal(aLogin.status,200);
  await post('profile',a,{name:'Alpha Original',email:'alpha@test.local',password});
  const thirdUser=(await state(a)).users.find(u=>u.email==='third@test.local');
  await post('group',a,{name:'Maliyyə Şöbəsi',lead:thirdUser.id,members:[thirdUser.id]});
  let sGroups=(await state(a)).groups;
  assert.equal(sGroups.length,1);
  assert.equal(sGroups[0].name,'Maliyyə Şöbəsi');
  assert.equal(sGroups[0].lead,thirdUser.id);
  await post('task',a,{title:'Büdcə təhlili',details:'Şöbəyə tapşırıq',project:1,status:'todo',priority:'high',due:'2026-12-10',group:sGroups[0].id});
  let grpTask=(await state(a)).tasks.find(t=>t.title==='Büdcə təhlili');
  assert.ok(grpTask);
  assert.equal(grpTask.owner,thirdUser.id);
  assert.equal(grpTask.group_id,sGroups[0].id);
  const thirdSign=await sign('third@test.local');
  await post('group',a,{id:sGroups[0].id,name:'Maliyyə Şöbəsi',lead:thirdUser.id,members:[thirdUser.id,(await state(a)).me.id]});
  await post('delegateTask',thirdSign,{id:grpTask.id,owners:[(await state(a)).me.id]});
  grpTask=(await state(a)).tasks.find(t=>t.id===grpTask.id);
  assert.equal(grpTask.owner,(await state(a)).me.id);
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

  // Test note sharing
  const aUser = (await state(a)).me;
  const bUser = (await state(b)).me;
  await post('note', a, {title: 'Ortaq qeyd', content: 'Paylaşılan məzmun', date: '2026-11-28', shared_with: [bUser.id]});
  let bNotes = (await state(b)).notes;
  const sharedToB = bNotes.find(n => n.title === 'Ortaq qeyd');
  assert.ok(sharedToB);
  assert.equal(sharedToB.user, aUser.id);
  assert.equal(sharedToB.date, '2026-11-28');
  assert.equal(sharedToB.author_name, 'Alpha Original');

  // Test note share update via shareNote
  await post('shareNote', a, {id: sharedToB.id, users: []});
  assert.ok(!(await state(b)).notes.some(n => n.id === sharedToB.id));
  await post('shareNote', a, {id: sharedToB.id, users: [bUser.id]});
  assert.ok((await state(b)).notes.some(n => n.id === sharedToB.id));

  // Recipient deleting removes it from recipient's view without deleting for author
  await post('deleteNote', b, {id: sharedToB.id});
  assert.ok(!(await state(b)).notes.some(n => n.id === sharedToB.id));
  assert.ok((await state(a)).notes.some(n => n.id === sharedToB.id));

  // Test Super Admin state and capabilities
  const rootState = await state(root);
  assert.ok(Array.isArray(rootState.tasks));
  assert.ok(Array.isArray(rootState.projects));
  assert.ok(Array.isArray(rootState.groups));
  assert.ok(Array.isArray(rootState.notes));
  assert.ok(rootState.tasks.length > 0);
  assert.ok(rootState.projects.length > 0);

  // Super Admin creating project under company
  await post('project', root, {name: 'Super Layihə', company: 1});
  const superProj = (await state(root)).projects.find(p => p.name === 'Super Layihə');
  assert.ok(superProj);
  assert.equal(superProj.company, 1);

  // Test project editing (renaming / fixing spelling typos)
  await post('project', a, {name: 'İlkin Səhv Layihə'});
  const createdProj = (await state(a)).projects.find(p => p.name === 'İlkin Səhv Layihə');
  assert.ok(createdProj, 'Project created');
  await post('project', a, {id: createdProj.id, name: 'Düzəliş Edilmiş Layihə'});
  const updatedProj = (await state(a)).projects.find(p => p.id === createdProj.id);
  assert.equal(updatedProj.name, 'Düzəliş Edilmiş Layihə', 'Project name successfully edited');
  await post('project', thirdSign, {id: createdProj.id, name: 'İcazəsiz dəyişiklik'}, 403);
  await post('project', b, {id: createdProj.id, name: 'Başqa şirkət layihəsi'}, 403);
  await post('project', root, {id: createdProj.id, name: 'Super Admin Düzəlişi'});
  assert.equal((await state(a)).projects.find(p => p.id === createdProj.id).name, 'Super Admin Düzəlişi');

  // Super Admin creating task
  await post('task', root, {title: 'Super Tapşırıq', details: 'Admin tapşırığı', project: superProj.id, status: 'todo', priority: 'high', owner: aUser.id, due: '2026-11-01'});
  let superTask = (await state(root)).tasks.find(t => t.title === 'Super Tapşırıq');
  assert.ok(superTask);
  assert.equal(superTask.owner, aUser.id);

  // Super Admin updating status, comment, delete
  await post('status', root, {id: superTask.id, version: superTask.version, status: 'doing'});
  superTask = (await state(root)).tasks.find(t => t.id === superTask.id);
  assert.equal(superTask.status, 'doing');
  await post('comment', root, {id: superTask.id, body: 'Super admin şərhi'});
  assert.ok((await state(root)).comments.some(c => c.task === superTask.id));
  await post('deleteTask', root, {id: superTask.id, version: superTask.version});
  assert.ok(!(await state(root)).tasks.some(t => t.id === superTask.id));

  // Test task visibility scoping: members only see assigned tasks, company admin sees all
  await post('task', a, {title: 'Admin Tapşırığı', details: 'Rəhbər işi', project: 1, status: 'todo', owner: aUser.id, priority: 'normal'});
  await post('task', a, {title: 'Üçüncü işçi tapşırığı', details: 'Tək şəxsə iş', project: 1, status: 'todo', owner: thirdUser.id, priority: 'normal'});

  const thirdTasks = (await state(thirdSign)).tasks;
  assert.ok(thirdTasks.some(t => t.title === 'Üçüncü işçi tapşırığı'), 'Member should see assigned task');
  assert.ok(!thirdTasks.some(t => t.title === 'Admin Tapşırığı'), 'Member must not see unassigned task');

  const adminTasks = (await state(a)).tasks;
  assert.ok(adminTasks.some(t => t.title === 'Üçüncü işçi tapşırığı'), 'Company admin sees member tasks');
  assert.ok(adminTasks.some(t => t.title === 'Admin Tapşırığı'), 'Company admin sees all company tasks');

  const adminTaskObj = adminTasks.find(t => t.title === 'Admin Tapşırığı');
  await post('comment', thirdSign, {id: adminTaskObj.id, body: 'İcazəsiz şərh'}, 403);
  await post('status', thirdSign, {id: adminTaskObj.id, version: adminTaskObj.version, status: 'done'}, 403);

  // Test standard user (member) adding task
  await post('task', thirdSign, {title: 'Standart User Tapşırığı', details: 'İşçinin öz tapşırığı', project: 1, status: 'todo', owner: thirdUser.id, priority: 'high'});
  let memberCreatedTasks = (await state(thirdSign)).tasks;
  const createdByMember = memberCreatedTasks.find(t => t.title === 'Standart User Tapşırığı');
  assert.ok(createdByMember, 'Standard user can add tasks');
  assert.equal(createdByMember.owner, thirdUser.id);
  // Member updating task
  await post('task', thirdSign, {id: createdByMember.id, version: createdByMember.version, title: 'Standart User Tapşırığı Yeniləndi', project: 1, owner: thirdUser.id, status: 'doing', priority: 'high'});
  assert.equal((await state(thirdSign)).tasks.find(t => t.id === createdByMember.id).title, 'Standart User Tapşırığı Yeniləndi');

  // Test standard user adding task assigned to another user (must still be visible to creator!)
  await post('task', thirdSign, {title: 'Başqasına təhkim edilən tapşırıq', details: 'Həmkar üçün iş', project: 1, status: 'todo', owner: aUser.id, priority: 'normal'});
  const thirdTasksAfterAdd = (await state(thirdSign)).tasks;
  const assignedToOther = thirdTasksAfterAdd.find(t => t.title === 'Başqasına təhkim edilən tapşırıq');
  assert.ok(assignedToOther, 'Task created by member assigned to someone else MUST be visible to the creator');
  assert.equal(assignedToOther.created_by, thirdUser.id);
  assert.equal(assignedToOther.owner, aUser.id);
  // Creator should be able to update status as well
  await post('status', thirdSign, {id: assignedToOther.id, version: assignedToOther.version, status: 'doing'});
  assert.equal((await state(thirdSign)).tasks.find(t => t.id === assignedToOther.id).status, 'doing');

  // Super Admin creating task directly assigned to organization leader
  await post('task', root, {title: 'Qurum Rəhbərinə Birbaşa Tapşırıq', details: 'Rəhbərə tapşırıq', company: 1, target: 'leader', priority: 'high', due: '2026-12-25'});
  const leaderTask = (await state(root)).tasks.find(t => t.title === 'Qurum Rəhbərinə Birbaşa Tapşırıq');
  assert.ok(leaderTask, 'Super admin created task for organization leader');
  assert.equal(leaderTask.owner, aUser.id, 'Task assigned to company 1 admin');
  assert.ok((await state(a)).tasks.some(t => t.id === leaderTask.id), 'Company leader sees the task assigned by super admin');

  // Super Admin task organization filtering verification
  const allRootTasks = (await state(root)).tasks;
  const comp1Tasks = allRootTasks.filter(t => t.company_id === 1);
  assert.ok(comp1Tasks.length > 0);
  assert.ok(comp1Tasks.every(t => t.company_id === 1));

  // Super Admin creating calendar note
  await post('note', root, {title: 'Super Qeyd', content: 'Kalendar qeydi', date: '2026-11-20'});
  assert.ok((await state(root)).notes.some(n => n.title === 'Super Qeyd'));

  // Test Excel Dashboard structure in public/app.js
  const appJsContent = await readFile(fileURLToPath(new URL('../public/app.js', import.meta.url)), 'utf-8');
  assert.ok(appJsContent.includes('Worksheet ss:Name="İdarəetmə Paneli"'), 'Excel export must contain Dashboard worksheet');
  assert.ok(appJsContent.includes('Worksheet ss:Name="Tapşırıqlar"'), 'Excel export must contain Tasks worksheet');
  assert.ok(appJsContent.includes('CƏMİ TAPŞIRIQ') && appJsContent.includes('VAXTINDA İCRA'), 'Excel Dashboard contains KPI cards');

  // Test supervisor (Tapşırığa nəzarət) and activity history (tarixçə)
  // Create a 4th member to verify supervisor visibility
  await post('user', a, {name: 'Nəzarətçi Əməkdaş', email: 'supervisor@test.local', password: 'Password123456*', role: 'member'});
  const supUser = (await state(a)).users.find(u => u.email === 'supervisor@test.local');
  const supSign = (await req('login', null, {email: 'supervisor@test.local', password: 'Password123456*'})).headers.get('set-cookie').split(';')[0];

  // Admin creates task with thirdUser as owner and supUser as supervisor
  await post('task', a, {title: 'Nəzarətli Tapşırıq', details: 'Nəzarət altında icra', project: 1, status: 'todo', owner: thirdUser.id, supervisor: supUser.id, priority: 'high'});
  const supTasks = (await state(supSign)).tasks;
  const supervisedTask = supTasks.find(t => t.title === 'Nəzarətli Tapşırıq');
  assert.ok(supervisedTask, 'Supervisor should see task in their task list');
  assert.equal(supervisedTask.supervisor, supUser.id, 'Task supervisor column correctly assigned');

  // Comment and status update should record history
  await post('comment', supSign, {id: supervisedTask.id, body: 'Nəzarətçi qeydi'});
  await post('status', thirdSign, {id: supervisedTask.id, version: supervisedTask.version, status: 'doing'});

  const stWithHistory = await state(a);
  const taskHist = stWithHistory.history.filter(h => h.task === supervisedTask.id);
  assert.ok(taskHist.length >= 3, 'Task should have created, comment, and status history entries');
  assert.ok(taskHist.some(h => h.action === 'created'), 'History has created action');
  assert.ok(taskHist.some(h => h.action === 'comment'), 'History has comment action');
  assert.ok(taskHist.some(h => h.action === 'status'), 'History has status action');

  // Verify sidebar redundant sideProjects div is removed from index.html
  const indexHtmlContent = await readFile(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf-8');
  assert.ok(!indexHtmlContent.includes('class="sideProjects"'), 'Duplicate sideProjects block must be removed');
  assert.ok(indexHtmlContent.includes('detail-tabs-bar'), 'Task detail should have tabs for history and comments');
  assert.ok(!indexHtmlContent.includes('👑'), 'Crown emoji must be removed from task creation');

  assert.ok(indexHtmlContent.includes('class="stars-sky"'), 'Login cover must contain starry night sky');
  assert.ok(indexHtmlContent.includes('stars-svg'), 'Starry night sky must contain stars SVG');

  const styleCssContent = await readFile(fileURLToPath(new URL('../public/style.css', import.meta.url)), 'utf-8');
  assert.ok(styleCssContent.includes('.stars-sky') && styleCssContent.includes('.stars-svg'), 'Starry night sky styles must be defined');
  assert.ok(styleCssContent.includes('.lane.ltodo h3') && styleCssContent.includes('.lane.ldoing h3') && styleCssContent.includes('.lane.lreview h3') && styleCssContent.includes('.lane.ldone h3'), 'Status column headers have custom backgrounds');
  assert.ok(styleCssContent.includes('.profile-avatar-row'), 'Profile avatar row styling is defined');

  // Verify standard member nav does not have 'mine' (Mənim tapşırıqlarım)
  assert.ok(!appJsContent.includes("['mine','Mənim tapşırıqlarım','check'],\n      ['projects','Layihələr','folder'],\n      ['notes','Qeydlər','date'],\n      ['reports','Hesabatlar','report']\n    ];"), 'Member nav must not have mine');

  await post('logout',a,{});assert.equal((await req('state',a)).status,401);
});
