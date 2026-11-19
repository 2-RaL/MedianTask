const { createApp } = Vue;
const icons={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',board:'M3 4h18v16H3z M9 4v16 M15 4v16',list:'M7 6h14 M7 12h14 M7 18h14 M3 6h.1 M3 12h.1 M3 18h.1',box:'m12 2 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10',team:'M3 20v-2a5 5 0 0 1 10 0v2 M16 14a5 5 0 0 1 5 5 M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M16 4a4 4 0 0 1 0 8',report:'M3 3v18h18 M8 16v-5 M13 16V6 M18 16v-8',check:'m4 12 5 5L20 6',clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 6v6l4 2',search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M15 15l6 6',date:'M3 5h18v16H3z M7 2v6 M17 2v6 M3 10h18',plus:'M12 5v14 M5 12h14',logout:'M10 3H4v18h6 M9 12h12 M17 8l4 4-4 4',menu:'M3 5h18 M3 12h18 M3 19h18',flag:'M5 21V3c5-4 9 5 15 0v10c-6 5-10-4-15 0',company:'M4 21V3h12v18 M16 10h4v11 M2 21h20 M8 7h4 M8 11h4 M8 15h4'};
const app=createApp({
 data:()=>({s:null,ready:false,demoPage:location.pathname==='/demo',busy:false,error:'',toast:'',timer:null,page:'board',mobile:false,auth:{email:'',password:''},view:'board',query:'',project:'',priority:'',companyFilter:'',modal:'',form:{},note:'',drag:null,over:'',statuses:{todo:'Planlaşdırılıb',doing:'İcradadır',review:'Yoxlamada',done:'Tamamlanıb'},priorities:{low:'Aşağı',normal:'Orta',high:'Yüksək'},demos:[['Super admin','platform'],['Admin','admin'],['İstifadəçi','member']]}),
 computed:{
  isPlatform(){return this.s?.me.role==='platform'},admin(){return this.s?.me.role==='admin'},
  nav(){return this.isPlatform?[['companies','Şirkətlər','company'],['plans','Paketlər','box'],['team','İstifadəçilər','team']]:[['board','Tapşırıq lövhəsi','board'],['mine','Mənim tapşırıqlarım','check'],...(this.admin?[['reports','Hesabatlar','report'],['team','Komanda','team']]:[])]},
  pageName(){return this.nav.find(n=>n[0]===this.page)?.[1]},
  sub(){return {board:'Layihələr üzrə tapşırıqlar və onların icra vəziyyəti.',mine:'Sizə həvalə edilmiş tapşırıqlar və son tarixlər.',reports:'Layihələrin gedişatı və komandanın cari iş yükü.',companies:'Şirkətlərin paketləri, administratorları və istifadəçi yerləri.',plans:'Şirkətlər üçün standart paketlər və istifadəçi limitləri.',team:'Komanda üzvləri, rollar və giriş səlahiyyətləri.'}[this.page]},
  today(){return new Date().toLocaleDateString('az-AZ',{weekday:'long',day:'numeric',month:'long'})},
  team(){return this.s.users.filter(u=>!this.isPlatform||!this.companyFilter||u.company===this.companyFilter)},
  filtered(){return this.baseTasks.filter(t=>(!this.project||t.project===this.project)&&(!this.priority||t.priority===this.priority)&&(!this.query||t.title.toLocaleLowerCase('az').includes(this.query.trim().toLocaleLowerCase('az'))))},
  baseTasks(){return this.s.tasks.filter(t=>this.page!=='mine'||t.owner===this.s.me.id)},
  boardMetrics(){const t=this.page==='reports'?this.baseTasks:this.filtered;return [['Cəmi tapşırıq',t.length,'board'],['İcradadır',t.filter(x=>x.status==='doing').length,'clock'],['Tamamlanıb',t.filter(x=>x.status==='done').length,'check'],['Gecikən',t.filter(this.late).length,'flag']]},
  platformMetrics(){return [['Şirkətlər',this.s.companies.length,'company'],['Aktiv hesablar',this.s.users.filter(u=>u.active).length,'team'],['Paketlər',this.s.plans.length,'box'],['Boş yerlər',this.s.companies.reduce((n,c)=>n+c.seats-c.used,0),'grid']]},
  current(){return this.s?.tasks?.find(t=>t.id===this.form.id)},
  actionLabel(){if(this.page==='reports')return 'CSV yüklə';if(!this.admin&&!this.isPlatform)return '';return {board:'Yeni tapşırıq',mine:'Yeni tapşırıq',team:'İstifadəçi əlavə et',companies:'Şirkət əlavə et',plans:'Yeni paket'}[this.page]},
  modalTitle(){return this.modal==='detail'?this.current?.title:this.modal==='deleteTask'?'Tapşırıq silinsin?':({task:'Tapşırıq',plan:'Paket',company:'Şirkət',user:'İstifadəçi',project:'Layihə'}[this.modal]||'')+(this.form.id?' · redaktə':' · əlavə et')}
 },
 async mounted(){try{await this.restore()}catch(e){if(e.status!==401)this.error=e.message}finally{this.ready=true}},
 methods:{
  async api(path,body,demo=this.demoPage){const r=await fetch((demo?'/api/demo/':'/api/')+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok){if(r.status===401&&this.s){this.close();this.s=null}throw Object.assign(Error(d.error),{status:r.status})}return d},
  async restore(){this.s=await this.api('state');this.go(this.isPlatform?'companies':'board')},
  async login(){this.busy=true;this.error='';try{await this.api('login',this.auth);await this.restore();this.auth.password=''}catch(e){this.error=e.message}finally{this.busy=false}},
  async demoLogin(role){
    if(this.busy)return;
    this.busy=true;
    this.error='';
    try{
      await this.api('login',{role},true);
      if(this.demoPage)await this.restore();
      else location.assign('/demo');
    }catch(e){
      this.error=e.message;
    }finally{
      this.busy=false;
    }
  },
  async logout(){try{await this.api('logout',{});if(this.demoPage){location.assign('/');return}this.s=null;this.auth={email:'',password:''};this.error='';this.mobile=false}catch(e){this.notify(e.message)}},
  go(page){this.page=page;this.project='';this.priority='';this.query='';this.companyFilter='';this.mobile=false},
  roleName(r){return {platform:'Platforma administratoru',admin:'Şirkət administratoru',member:'Əməkdaş'}[r]},
  initials(n){return n.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toLocaleUpperCase('az')},person(id){return this.s.users.find(u=>u.id===id)?.name||'Təyin edilməyib'},
  projectName(id){return this.s.projects.find(p=>p.id===id)?.name},projectIndex(id){return this.s.projects.findIndex(p=>p.id===id)%4},
  dateLabel(d){return d?new Date(d+'T12:00:00').toLocaleDateString('az-AZ',{day:'numeric',month:'short'}):'Tarixsiz'},
  late(t){const d=new Date();d.setHours(0,0,0,0);return !!t.due&&t.status!=='done'&&new Date(t.due+'T00:00:00')<d},
  percent(id){const t=this.s.tasks.filter(t=>t.project===id);return t.length?Math.round(100*t.filter(t=>t.status==='done').length/t.length):0},
  notify(msg){this.toast=msg;clearTimeout(this.timer);this.timer=setTimeout(()=>this.toast='',3200)},
  primaryAction(){if(this.page==='reports')return this.csv();if(['board','mine'].includes(this.page))return this.newTask('todo');if(this.page==='team'&&this.isPlatform&&!this.s.companies.length){this.notify('Əvvəlcə şirkət əlavə edin.');return this.open('company')}this.open({plans:'plan',companies:'company',team:'user'}[this.page])},
  newTask(status){if(!this.s.projects.length){this.notify('İlk tapşırıq üçün layihə yaradın.');return this.open('project')}this.open('task',{status})},
  open(type,data={}){this.mobile=false;this.error='';this.note='';this.modal=type;this.form={status:'todo',priority:'normal',project:this.project||this.s.projects?.[0]?.id,owner:this.page==='mine'?this.s.me.id:'',plan:this.s.plans?.[0]?.id,company:this.companyFilter||this.s.companies?.[0]?.id,role:'member',seats:10,monthly:0,cap:'',...data,active:data.active!==0};if(!this.$refs.dialog.open)this.$refs.dialog.showModal()},
  close(){this.$refs.dialog?.close();this.modal='';this.error=''},detail(t){this.open('detail',t)},
  async mutate(type,payload,after){if(this.busy)return;this.busy=true;this.error='';try{await this.api(type,payload);this.s=await this.api('state');after?.();this.notify('Dəyişiklik yadda saxlanıldı.')}catch(e){this.error=e.message;if(!this.modal)this.notify(e.message);if(e.status===409){try{this.s=await this.api('state')}catch{}}}finally{this.busy=false}},
  save(){this.mutate(this.modal,this.form,()=>this.close())},comment(){this.mutate('comment',{id:this.form.id,body:this.note},()=>this.note='')},
  move(t,status){if(t.status!==status)this.mutate('status',{id:t.id,version:t.version,status})},
  drop(k){if(this.drag)this.move(this.drag,k);this.drag=null;this.over=''},
  csv(){const rows=[['Tapşırıq','Layihə','Məsul şəxs','Mərhələ','Prioritet','Son tarix'],...this.s.tasks.map(t=>[t.title,this.projectName(t.project),this.person(t.owner),this.statuses[t.status],this.priorities[t.priority],t.due])];const quote=v=>'"'+String(v||'').replace(/^[\s]*[=+@-]/,m=>"'"+m).replaceAll('"','""')+'"';const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Meridian-Hesabat.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 }
});
app.component('ico',{props:['name'],setup(){return {icons}},template:'<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path :d="icons[name]"/></svg>'});
const orbitStops = new WeakMap();
app.directive('logo-orbit', {
  mounted(svg) {
    const centerX = 622;
    const centerY = 168;
    const ribbonCount = 12;
    const backLayer = svg.querySelector('[data-ribbon-back]');
    const frontLayer = svg.querySelector('[data-ribbon-front]');
    const ribbons = Array.from({ length: ribbonCount }, (_, index) => {
      const gold = index % 2 === 0;
      const tilt = (-32 + (index - 5.5) * 4.2) * Math.PI / 180;
      function makePath(layer, opacity) {
        const path = document.createElementNS(svg.namespaceURI, 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', gold ? 'url(#mGoldRibbon)' : 'url(#mGreenRibbon)');
        path.setAttribute('stroke-width', gold ? 2.4 + (index % 3) * .6 : 2.8);
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('opacity', opacity);
        layer.append(path);
        return path;
      }
      return {
        back: makePath(backLayer, .4),
        front: makePath(frontLayer, .95),
        radiusX: 95 + (index % 4) * 14,
        radiusY: 36 + (index % 3) * 9,
        phase: index / ribbonCount * Math.PI * 2,
        speed: 1.8 + (index % 3) * .22,
        cosTilt: Math.cos(tilt),
        sinTilt: Math.sin(tilt),
      };
    });

    function draw(elapsed) {
      for (const ribbon of ribbons) {
        const head = elapsed * ribbon.speed + ribbon.phase;
        let front = '';
        let back = '';
        let wasInFront;
        for (let point = 0; point <= 24; point++) {
          const angle = head - point * 2.2 / 24;
          const depth = Math.sin(angle);
          const x = Math.cos(angle) * ribbon.radiusX;
          const y = depth * ribbon.radiusY;
          const inFront = depth >= 0;
          const projectedX = centerX + x * ribbon.cosTilt - y * ribbon.sinTilt;
          const projectedY = centerY + x * ribbon.sinTilt + y * ribbon.cosTilt;
          const sample = `${wasInFront === inFront ? 'L' : 'M'}${projectedX.toFixed(1)} ${projectedY.toFixed(1)} `;
          if (inFront) front += sample;
          else back += sample;
          wasInFront = inFront;
        }
        ribbon.front.setAttribute('d', front);
        ribbon.back.setAttribute('d', back);
      }
    }

    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const startedAt = performance.now();
    let frame;
    function animate(now) {
      draw((now - startedAt) / 1000);
      frame = requestAnimationFrame(animate);
    }
    function updateMotion() {
      cancelAnimationFrame(frame);
      if (motion.matches) draw(0);
      else frame = requestAnimationFrame(animate);
    }
    updateMotion();
    motion.addEventListener('change', updateMotion);
    orbitStops.set(svg, () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener('change', updateMotion);
    });
  },
  unmounted(svg) {
    orbitStops.get(svg)?.();
    orbitStops.delete(svg);
  },
});
app.mount('#app');
