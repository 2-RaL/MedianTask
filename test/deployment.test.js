import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, cp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

test('Build, birbaşa və require ilə işəsalma, HTTPS proxy və redeploy sonrası məlumat', async t => {
  const root = await mkdtemp(join(tmpdir(), 'meridian-deploy-'));
  t.after(() => rm(root, {recursive:true,force:true}));
  const source = fileURLToPath(new URL('../', import.meta.url));
  const build = spawn(process.execPath, [join(source,'scripts/build.js')], {stdio:'ignore'});
  assert.equal((await once(build,'exit'))[0],0);
  let child;
  const data = join(root,'persistent');
  const appOrigin='https://meridian.example';
  const pass='DeploymentCheck2026';
  async function start(folder, { loadWithRequire = false, adminEmailKey = 'ADMIN_EMAIL' } = {}) {
    await cp(join(source,'dist'), folder, {recursive:true});
    await writeFile(join(folder,'.env'), [
      'NODE_ENV=production',
      'PORT=0',
      'DATA_DIR='+data,
      'APP_URL='+appOrigin,
      adminEmailKey+'=owner@example.com',
      'ADMIN_PASSWORD='+pass,
    ].join('\n'));
    // PORT=0 seçimini testdəki serverin elan etdiyi porta bağlamaq üçün logu genişləndiririk.
    const entry = join(folder, 'index.js');
    const args = loadWithRequire
      ? ['--input-type=commonjs', '--eval', 'require(process.argv[1])', entry]
      : [entry];
    child=spawn(process.execPath,args,{cwd:root,stdio:['ignore','pipe','pipe']});
    let output='';
    const port = await new Promise((resolve,reject)=>{
      child.stdout.on('data',chunk=>{output+=chunk;const m=output.match(/localhost:(\d+)/);if(m)resolve(Number(m[1]));});
      child.once('exit',code=>reject(Error('Server exit '+code)));
      child.stderr.on('data',chunk=>{if(String(chunk).includes('işə düşmədi'))reject(Error(String(chunk)));});
    });
    return 'http://127.0.0.1:'+port;
  }
  async function stop(){const exited=once(child,'exit');child.kill('SIGTERM');await exited;child=null;}
  t.after(async()=>{if(child)await stop()});
  let url=await start(join(root,'release-one'), { adminEmailKey: 'ADMIIN_EMAIL' });
  assert.equal((await fetch(url+'/api/health')).status,200);
  assert.equal((await fetch(url+'/')).status,200);
  assert.equal((await fetch(url+'/demo')).status,200);
  const demoHeaders = {'Content-Type':'application/json', Origin:appOrigin};
  assert.equal((await fetch(url+'/api/demo/state')).status,401);
  for (const role of ['platform', 'admin', 'member']) {
    const response = await fetch(url+'/api/demo/login', {
      method:'POST', headers:demoHeaders, body:JSON.stringify({role}),
    });
    assert.equal(response.status,200);
    const setCookie = response.headers.get('set-cookie');
    assert.match(setCookie,/^demo_sid=[a-f\d]+; Path=\/api\/demo\/; HttpOnly; SameSite=Lax; Secure/);
    const demoCookie = setCookie.split(';')[0];
    const demoState = await fetch(url+'/api/demo/state',{headers:{Cookie:demoCookie}});
    assert.equal(demoState.status,200);
    assert.equal((await demoState.json()).me.role,role);
    const liveState = await fetch(url+'/api/state',{
      headers:{Cookie:demoCookie.replace('demo_sid=','sid=')},
    });
    assert.equal(liveState.status,401);
    const change = await fetch(url+'/api/demo/plan',{
      method:'POST', headers:{...demoHeaders,Cookie:demoCookie}, body:'{}',
    });
    assert.equal(change.status,403);
    const logout = await fetch(url+'/api/demo/logout',{
      method:'POST', headers:{...demoHeaders,Cookie:demoCookie}, body:'{}',
    });
    assert.equal(logout.status,200);
    assert.equal((await fetch(url+'/api/demo/state',{headers:{Cookie:demoCookie}})).status,401);
  }
  async function login(){
    const r=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:appOrigin},body:JSON.stringify({email:'owner@example.com',password:pass})});
    assert.equal(r.status,200);
    assert.match(r.headers.get('set-cookie'),/Secure/);
    return r.headers.get('set-cookie').split(';')[0];
  }
  let cookie=await login();
  const isolatedDemo = await fetch(url+'/api/demo/state',{
    headers:{Cookie:cookie.replace('sid=','demo_sid=')},
  });
  assert.equal(isolatedDemo.status,401);
  const r=await fetch(url+'/api/plan',{method:'POST',headers:{'Content-Type':'application/json',Origin:appOrigin,Cookie:cookie},body:JSON.stringify({name:'Persistent plan',seats:25,monthly:29})});
  assert.equal(r.status,200);
  await stop();
  url=await start(join(root,'release-two'), { loadWithRequire: true });
  assert.equal((await fetch(url+'/api/health')).status,200);
  cookie=await login();
  const state=await (await fetch(url+'/api/state',{headers:{Cookie:cookie}})).json();
  assert.ok(state.plans.some(p=>p.name==='Persistent plan'));
  assert.equal(state.me.email,'owner@example.com');
  await stop();
});
