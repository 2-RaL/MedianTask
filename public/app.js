const { createApp } = Vue;
const icons={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',board:'M3 4h18v16H3z M9 4v16 M15 4v16',list:'M7 6h14 M7 12h14 M7 18h14 M3 6h.1 M3 12h.1 M3 18h.1',box:'m12 2 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10',team:'M3 20v-2a5 5 0 0 1 10 0v2 M16 14a5 5 0 0 1 5 5 M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M16 4a4 4 0 0 1 0 8',report:'M3 3v18h18 M8 16v-5 M13 16V6 M18 16v-8',check:'m4 12 5 5L20 6',clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 6v6l4 2',search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M15 15l6 6',date:'M3 5h18v16H3z M7 2v6 M17 2v6 M3 10h18',plus:'M12 5v14 M5 12h14',logout:'M10 3H4v18h6 M9 12h12 M17 8l4 4-4 4',menu:'M3 5h18 M3 12h18 M3 19h18',flag:'M5 21V3c5-4 9 5 15 0v10c-6 5-10-4-15 0',company:'M4 21V3h12v18 M16 10h4v11 M2 21h20 M8 7h4 M8 11h4 M8 15h4',folder:'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',share:'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13'};
const autoFillUsers = [
  {id:'platform',label:'Super admin',email:'r.tural.94@gmail.com',password:'Admin123456789*'},
  {id:'admin',label:'Şirkət admini',email:'info@atm.gov.az',password:'ATM123456789*'},
  {id:'member',label:'Standart user',email:'tural.rustamov@atm.gov.az',password:'ATM123456789*'},
];

const app=createApp({
 setup(){
  return {
    autoFillUsers,
  };
 },
 data:()=>({
  s:null,ready:false,demo:false,busy:false,error:'',toast:'',timer:null,page:'board',mobile:false,
  auth:{email:'',password:''},view:'board',query:'',project:'',priority:'',companyFilter:'',modal:'',form:{},note:'',drag:null,over:'',
  statuses:{todo:'Planlaşdırılıb',doing:'İcradadır',review:'Yoxlamada',done:'Tamamlanıb'},
  priorities:{low:'Aşağı',normal:'Orta',high:'Yüksək'},
  demos:[['Şirkət admini','leyla'],['Platforma admini','platform'],['İstifadəçi','murad']],
  calYear:new Date().getFullYear(),
  calMonth:new Date().getMonth(),
  selectedDate:new Date().toISOString().slice(0,10),
  newDateNote:{title:'',content:'',shared_with:[]},
  newFreeNote:{title:'',content:''},
  sharingNote:null,
  shareUserIds:[],
  teamTab:'members',
  taskTarget:'users',
  delegateOwners:[]
 }),
 computed:{
  isPlatform(){return this.s?.me.role==='platform'},admin(){return this.s?.me.role==='admin'},
  nav(){
    if(this.isPlatform)return [
      ['board','Tapşırıq lövhəsi','board'],
      ['mine','Mənim tapşırıqlarım','check'],
      ['notes','Qeydlər','date'],
      ['reports','Hesabatlar','report'],
      ['companies','Şirkətlər','company'],
      ['plans','Paketlər','box'],
      ['team','İstifadəçilər','team']
    ];
    return [
      ['board','Tapşırıq lövhəsi','board'],
      ['mine','Mənim tapşırıqlarım','check'],
      ['notes','Qeydlər','date'],
      ['reports','Hesabatlar','report'],
      ...(this.admin?[['team','Komanda','team']]:[])
    ];
  },
  pageName(){return this.nav.find(n=>n[0]===this.page)?.[1]},
  sub(){
    const reportsSub = (this.admin || this.isPlatform)
      ? 'Layihələrin gedişatı və komandanın cari iş yükü analitikası.'
      : 'Sizə həvalə edilmiş tapşırıqların gedişatı və fərdi icra analitikası.';
    return {
      board:'Layihələr üzrə tapşırıqlar və onların icra vəziyyəti.',
      mine:'Sizə həvalə edilmiş tapşırıqlar və son tarixlər.',
      notes:'Şəxsi və paylaşılan təqvim qeydləri, xatırlatmalar və sərbəst qeydlər.',
      reports:reportsSub,
      companies:'Şirkətlərin paketləri, administratorları və istifadəçi yerləri.',
      plans:'Şirkətlər üçün standart paketlər və istifadəçi limitləri.',
      team:'Komanda üzvləri, rollar və giriş səlahiyyətləri.'
    }[this.page];
  },
  today(){return new Date().toLocaleDateString('az-AZ',{weekday:'long',day:'numeric',month:'long'})},
  todayDateStr(){
    const now=new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  },
  activeUsers(){
    return this.s?.users?.filter(u=>u.active)||[];
  },
  userNotes(){
    return this.s?.notes||[];
  },
  todayNotes(){
    return this.userNotes.filter(n=>n.date===this.todayDateStr);
  },
  selectedDateNotes(){
    return this.userNotes.filter(n=>n.date===this.selectedDate);
  },
  freeNotes(){
    return this.userNotes.filter(n=>!n.date);
  },
  notesMetrics(){
    return [
      ['Bugünkü qeydlər',this.todayNotes.length,'clock',this.todayNotes.length?'Bugünə aid xatırlatmalar':'Qeyd yoxdur'],
      ['Seçilmiş gün üçün',this.selectedDateNotes.length,'date',this.formatDateAz(this.selectedDate)],
      ['Sərbəst qeydlər',this.freeNotes.length,'list','Təqvimdən kənar daimi qeydlər'],
      ['Cəmi qeydlər',this.userNotes.length,'board','Bütün şəxsi qeydlər']
    ];
  },
  calMonthName(){
    const months=['Yanvar','Fevral','Mart','Aprel','May','İyun','İyul','Avqust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
    return months[this.calMonth]+' '+this.calYear;
  },
  weekDays(){
    return ['B.e','Ç.a','Ç.','C.a','C.','Ş.','B.'];
  },
  calendarDays(){
    const y=this.calYear;
    const m=this.calMonth;
    const firstDayOfWeek=(new Date(y,m,1).getDay()+6)%7;
    const daysInMonth=new Date(y,m+1,0).getDate();
    const daysInPrevMonth=new Date(y,m,0).getDate();
    const days=[];
    const notes=this.userNotes;

    for(let i=firstDayOfWeek-1;i>=0;i--){
      const dayNum=daysInPrevMonth-i;
      const prevDate=new Date(y,m-1,dayNum);
      const dateStr=`${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}-${String(prevDate.getDate()).padStart(2,'0')}`;
      days.push({
        dayNum,
        dateStr,
        isCurrentMonth:false,
        isToday:dateStr===this.todayDateStr,
        isSelected:dateStr===this.selectedDate,
        notesCount:notes.filter(n=>n.date===dateStr).length
      });
    }

    for(let d=1;d<=daysInMonth;d++){
      const dateStr=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      days.push({
        dayNum:d,
        dateStr,
        isCurrentMonth:true,
        isToday:dateStr===this.todayDateStr,
        isSelected:dateStr===this.selectedDate,
        notesCount:notes.filter(n=>n.date===dateStr).length
      });
    }

    const remaining=(7-(days.length%7))%7;
    for(let d=1;d<=remaining;d++){
      const nextDate=new Date(y,m+1,d);
      const dateStr=`${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}-${String(nextDate.getDate()).padStart(2,'0')}`;
      days.push({
        dayNum:d,
        dateStr,
        isCurrentMonth:false,
        isToday:dateStr===this.todayDateStr,
        isSelected:dateStr===this.selectedDate,
        notesCount:notes.filter(n=>n.date===dateStr).length
      });
    }

    return days;
  },
  companyLeader(){
    if(!this.s?.users)return null;
    const cid=Number(this.form?.company||(this.isPlatform?this.companyFilter:this.s.me?.company));
    if(!cid)return null;
    return this.s.users.find(u=>u.company===cid&&u.role==='admin'&&u.active)||null;
  },
  team(){
    return this.s.users.filter(u=>{
      if(!this.isPlatform||!this.companyFilter)return true;
      if(this.companyFilter==='platform')return u.role==='platform';
      return u.company===Number(this.companyFilter);
    });
  },
  filtered(){return this.baseTasks.filter(t=>(!this.project||t.project===this.project)&&(!this.priority||t.priority===this.priority)&&(!this.query||t.title.toLocaleLowerCase('az').includes(this.query.trim().toLocaleLowerCase('az'))))},
  baseTasks(){
    if(!this.s?.tasks)return [];
    let list=this.s.tasks;
    if(this.page==='mine'||(!this.admin&&!this.isPlatform))list=list.filter(t=>t.owner===this.s.me.id);
    if(this.isPlatform&&this.companyFilter&&this.companyFilter!=='platform'){
      list=list.filter(t=>t.company_id===Number(this.companyFilter));
    }
    return list;
  },
  availableProjects(){
    if(!this.s?.projects)return [];
    if(this.isPlatform&&this.companyFilter&&this.companyFilter!=='platform'){
      return this.s.projects.filter(p=>p.company===Number(this.companyFilter));
    }
    return this.s.projects;
  },
  shareableUsers(){
    const myId=this.s?.me?.id;
    let list=(this.s?.users||[]).filter(u=>u.active&&u.id!==myId);
    if(!this.isPlatform&&this.s?.me?.company){
      list=list.filter(u=>u.company===this.s.me.company);
    }else if(this.isPlatform&&this.companyFilter&&this.companyFilter!=='platform'){
      list=list.filter(u=>u.company===Number(this.companyFilter));
    }
    return list;
  },
  reportTasks(){
    if(!this.s?.tasks)return [];
    if(this.isPlatform){
      return this.companyFilter&&this.companyFilter!=='platform'
        ? this.s.tasks.filter(t=>t.company_id===Number(this.companyFilter))
        : this.s.tasks;
    }
    return this.admin ? this.s.tasks : this.s.tasks.filter(t=>t.owner===this.s.me.id);
  },
  boardMetrics(){
    const t=this.page==='reports'?this.reportTasks:(this.page==='mine'?this.baseTasks:this.filtered);
    const total=t.length,done=t.filter(x=>x.status==='done').length,rate=total?Math.round((done/total)*100):0,late=t.filter(this.late).length;
    return [
      ['Cəmi tapşırıq',total,'board',total+' tapşırıq'],
      ['İcradadır',t.filter(x=>x.status==='doing').length,'clock','aktiv icra prosesində'],
      ['Tamamlanıb',`${done} (${rate}%)`,'check','uğurla icra edilib'],
      ['Gecikən',late,'flag',late?'diqqət tələb edir':'qrafikə uyğundur']
    ];
  },
  reportStats(){
    const t=this.reportTasks,total=t.length;
    const todo=t.filter(x=>x.status==='todo').length;
    const doing=t.filter(x=>x.status==='doing').length;
    const review=t.filter(x=>x.status==='review').length;
    const done=t.filter(x=>x.status==='done').length;
    const late=t.filter(this.late).length;

    const high=t.filter(x=>x.priority==='high').length;
    const normal=t.filter(x=>x.priority==='normal').length;
    const low=t.filter(x=>x.priority==='low').length;

    const maxStatus=Math.max(todo,doing,review,done,1);
    const maxPriority=Math.max(high,normal,low,1);

    const statuses=[
      {key:'todo',label:'Planlaşdırılıb',count:todo,pct:total?Math.round((todo/total)*100):0,barPct:Math.round((todo/maxStatus)*100),color:'#8f9b91'},
      {key:'doing',label:'İcradadır',count:doing,pct:total?Math.round((doing/total)*100):0,barPct:Math.round((doing/maxStatus)*100),color:'#ad8652'},
      {key:'review',label:'Yoxlamada',count:review,pct:total?Math.round((review/total)*100):0,barPct:Math.round((review/maxStatus)*100),color:'#79909e'},
      {key:'done',label:'Tamamlanıb',count:done,pct:total?Math.round((done/total)*100):0,barPct:Math.round((done/maxStatus)*100),color:'#37583f'},
    ];

    const priorities=[
      {key:'high',label:'Yüksək',count:high,pct:total?Math.round((high/total)*100):0,barPct:Math.round((high/maxPriority)*100),color:'#8f5037',bg:'#f3e4dc'},
      {key:'normal',label:'Orta',count:normal,pct:total?Math.round((normal/total)*100):0,barPct:Math.round((normal/maxPriority)*100),color:'#806329',bg:'#f1ead7'},
      {key:'low',label:'Aşağı',count:low,pct:total?Math.round((low/total)*100):0,barPct:Math.round((low/maxPriority)*100),color:'#45685a',bg:'#e5eee6'},
    ];

    const C=251.327;let offset=0;
    const donutSegments=priorities.filter(p=>p.count>0).map(p=>{
      const strokeDash=total?(p.count/total)*C:0;
      const currentOffset=offset;
      offset+=strokeDash;
      return {...p,dasharray:`${strokeDash} ${C-strokeDash}`,dashoffset:-currentOffset};
    });

    const onTimeRate=total?Math.round(((total-late)/total)*100):100;
    return {total,todo,doing,review,done,late,high,normal,low,statuses,priorities,donutSegments,onTimeRate};
  },
  reportProjects(){
    if(!this.s?.projects)return [];
    const t=this.reportTasks;
    const list=(this.admin || this.isPlatform)
      ? (this.isPlatform && this.companyFilter && this.companyFilter !== 'platform'
          ? this.s.projects.filter(p => p.company === Number(this.companyFilter))
          : this.s.projects)
      : this.s.projects.filter(p=>t.some(task=>task.project===p.id));
    return list.map(p=>{
      const pTasks=t.filter(task=>task.project===p.id);
      const total=pTasks.length;
      const done=pTasks.filter(task=>task.status==='done').length;
      const doing=pTasks.filter(task=>task.status==='doing').length;
      const review=pTasks.filter(task=>task.status==='review').length;
      const todo=pTasks.filter(task=>task.status==='todo').length;
      const late=pTasks.filter(this.late).length;
      const pct=total?Math.round((done/total)*100):0;
      return {id:p.id,name:p.name,total,done,doing,review,todo,late,pct};
    });
  },
  reportUsers(){
    if((!this.admin&&!this.isPlatform)||!this.s?.users)return [];
    let users=this.s.users;
    if(this.isPlatform&&this.companyFilter&&this.companyFilter!=='platform'){
      users=users.filter(u=>u.company===Number(this.companyFilter));
    }
    const activeTasks=this.reportTasks;
    const maxUserTasks=Math.max(...users.map(u=>activeTasks.filter(t=>t.owner===u.id).length),1);
    return users
      .filter(u=>u.active||activeTasks.some(t=>t.owner===u.id&&t.status!=='done'))
      .map(u=>{
        const uTasks=activeTasks.filter(t=>t.owner===u.id);
        const total=uTasks.length;
        const done=uTasks.filter(t=>t.status==='done').length;
        const doing=uTasks.filter(t=>t.status==='doing').length;
        const late=uTasks.filter(this.late).length;
        const pct=total?Math.round((done/total)*100):0;
        return {id:u.id,name:u.name,role:u.role,total,done,doing,late,pct,barPct:Math.round((total/maxUserTasks)*100)};
      });
  },
  platformMetrics(){return [['Şirkətlər',this.s.companies.length,'company'],['Aktiv hesablar',this.s.users.filter(u=>u.active).length,'team'],['Paketlər',this.s.plans.length,'box'],['Boş yerlər',this.s.companies.reduce((n,c)=>n+c.seats-c.used,0),'grid']]},
  current(){return this.s?.tasks?.find(t=>t.id===this.form.id)},
  actionLabel(){if(this.page==='reports')return 'Excel yüklə';if(this.page==='notes')return '';return (this.admin||this.isPlatform)?{board:'Yeni tapşırıq',mine:'Yeni tapşırıq',team:'İstifadəçi əlavə et',companies:'Şirkət əlavə et',plans:'Yeni paket'}[this.page]||'':'';},
  modalTitle(){
    if(this.modal==='shareNote')return 'Qeydi paylaş';
    if(this.modal==='profile')return 'Profil məlumatları';
    if(this.modal==='group')return this.form.id?'Şöbəni redaktə et':'Yeni şöbə / qrup yarat';
    if(this.modal==='deleteGroup')return 'Şöbə silinsin?';
    if(this.modal==='importUsers')return 'Excel ilə toplu əlavə et';
    if(this.modal==='deleteUser')return 'İstifadəçi silinsin?';
    if(this.modal==='deleteTask')return 'Tapşırıq silinsin?';
    return this.modal==='detail'?this.current?.title:({task:'Tapşırıq',plan:'Paket',company:'Şirkət',user:'İstifadəçi',project:'Layihə'}[this.modal]||'')+(this.form.id?' · redaktə':' · əlavə et');
  },
  selectedGroupObj(){
    return this.s?.groups?.find(g=>g.id===Number(this.form.group));
  },
  currentGroup(){
    return this.s?.groups?.find(g=>g.id===this.current?.group_id);
  },
  isCurrentGroupLead(){
    return this.admin || (this.currentGroup && this.currentGroup.lead===this.s?.me?.id);
  },
  currentGroupMembers(){
    if(!this.currentGroup)return [];
    const memberIds=this.currentGroup.member_ids||[];
    return (this.s?.users||[]).filter(u=>u.active&&memberIds.includes(u.id));
  }
 },
 async mounted(){
  try{this.demo=(await this.api('info')).demo;await this.restore()}catch(e){if(e.status!==401)this.error=e.message}finally{this.ready=true}
 },
 methods:{
  async api(path,body){const r=await fetch('/api/'+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok){if(r.status===401&&this.s){this.close();this.s=null}throw Object.assign(Error(d.error),{status:r.status})}return d},
  async restore(){this.s=await this.api('state');if(!this.page||!this.nav.some(n=>n[0]===this.page))this.go(this.isPlatform?'companies':'board');},
  async login(){this.busy=true;this.error='';try{await this.api('login',this.auth);await this.restore();this.auth.password=''}catch(e){this.error=e.message}finally{this.busy=false}},
  fillUser(u){
    if(this.busy)return;
    this.auth.email=u.email;
    this.auth.password=u.password;
    this.error='';
    this.$nextTick(()=>this.$refs.loginSubmit?.focus());
  },
  async demoLogin(name){
    if(!this.demo || this.busy)return;
    this.auth={email:name+'@meridian.test',password:'MeridianDemo2026'};
    await this.$nextTick();
    await this.login();
  },
  async logout(){try{await this.api('logout',{});this.s=null;this.auth={email:'',password:''};this.error='';this.mobile=false}catch(e){this.notify(e.message)}},
  go(page){this.page=page;this.project='';this.priority='';this.query='';if(!this.isPlatform)this.companyFilter='';this.mobile=false},
  setCompanyFilter(cid){
    this.companyFilter=cid;
    if(this.project&&!this.availableProjects.some(p=>p.id===this.project)){
      this.project='';
    }
  },
  setTaskTarget(target){
    this.taskTarget=target;
    if(target==='leader'&&this.companyLeader){
      this.form.owner=this.companyLeader.id;
      this.form.owners=[this.companyLeader.id];
    }
  },
  companyName(cid){
    if(!cid)return '—';
    const c=this.s?.companies?.find(x=>x.id===Number(cid));
    return c?c.name:'—';
  },
  companyTaskCount(cid){
    if(!this.s?.tasks)return 0;
    return this.s.tasks.filter(t=>t.company_id===Number(cid)).length;
  },
  roleName(r){return {platform:'Platforma administratoru',admin:'Şirkət administratoru',member:'Əməkdaş'}[r]},
  initials(n){return n.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toLocaleUpperCase('az')},person(id){return this.s.users.find(u=>u.id===id)?.name||'Təyin edilməyib'},
  projectName(id){return this.s.projects.find(p=>p.id===id)?.name},projectIndex(id){return this.s.projects.findIndex(p=>p.id===id)%4},
  openProjectEdit(id){
    const p=this.s?.projects?.find(x=>x.id===Number(id));
    if(p)this.open('project',p);
  },
  dateLabel(d){return d?new Date(d+'T12:00:00').toLocaleDateString('az-AZ',{day:'numeric',month:'short'}):'Tarixsiz'},
  late(t){const d=new Date();d.setHours(0,0,0,0);return !!t.due&&t.status!=='done'&&new Date(t.due+'T00:00:00')<d},
  percent(id){const t=this.s.tasks.filter(t=>t.project===id);return t.length?Math.round(100*t.filter(t=>t.status==='done').length/t.length):0},
  notify(msg){this.toast=msg;clearTimeout(this.timer);this.timer=setTimeout(()=>this.toast='',3200)},
  primaryAction(){if(this.page==='reports')return this.excel();if(['board','mine'].includes(this.page))return this.newTask('todo');this.open({plans:'plan',companies:'company',team:'user'}[this.page])},
  newTask(status){
    const projs=this.availableProjects;
    if(!this.isPlatform&&(!projs||!projs.length)){this.notify('İlk tapşırıq üçün layihə yaradın.');return this.open('project')}
    this.open('task',{status});
  },
  open(type,data={}){
    this.mobile=false;this.error='';this.note='';this.modal=type;
    const initialCompany=(data.company!==undefined&&data.company!==null)?data.company:(data.company_id!==undefined&&data.company_id!==null)?data.company_id:(this.companyFilter&&this.companyFilter!=='platform'?Number(this.companyFilter):(this.s.companies?.[0]?.id||''));
    if(type==='profile'){
      this.form={
        name:this.s.me.name,
        email:this.s.me.email,
        password:''
      };
    }else if(type==='group'){
      const activeFirst=this.activeUsers[0]?.id||'';
      this.form={
        id:data.id||null,
        company:data.company||initialCompany,
        name:data.name||'',
        lead:data.lead||activeFirst,
        members:data.member_ids?[...data.member_ids]:(activeFirst?[activeFirst]:[])
      };
    }else if(type==='deleteGroup'){
      this.form={...data};
    }else if(type==='detail'){
      this.form={...data};
      this.delegateOwners=data.owner?[data.owner]:[];
    }else if(type==='task'){
      const compId=this.isPlatform?(initialCompany||this.s.companies?.[0]?.id):this.s.me.company;
      const compProjs=this.isPlatform?this.s.projects.filter(p=>p.company===Number(compId)):this.s.projects;
      const compGroups=this.isPlatform?this.s.groups.filter(g=>g.company===Number(compId)):this.s.groups;
      const compUsers=this.isPlatform?this.s.users.filter(u=>u.active&&u.company===Number(compId)):this.activeUsers;
      const leader=this.isPlatform?this.s.users.find(u=>u.active&&u.role==='admin'&&u.company===Number(compId)):null;

      this.taskTarget=data.group_id?'group':(this.isPlatform&&!data.id?'leader':'users');
      const defaultProject=this.project||compProjs[0]?.id||'';
      const defaultGroup=compGroups[0]?.id||'';
      const defaultOwner=this.page==='mine'?this.s.me.id:(this.taskTarget==='leader'&&leader?leader.id:(compUsers[0]?.id||this.s.me.id));

      if(data.id){
        this.form={
          id:data.id,
          version:data.version,
          title:data.title,
          details:data.details||'',
          company:data.company_id||initialCompany,
          project:data.project,
          group:data.group_id||'',
          owner:data.owner||'',
          owners:data.owner?[data.owner]:[],
          status:data.status,
          priority:data.priority,
          due:data.due||''
        };
      }else{
        this.form={
          title:'',
          details:'',
          company:initialCompany,
          project:defaultProject,
          group:defaultGroup,
          owner:defaultOwner,
          owners:defaultOwner?[defaultOwner]:[],
          status:data.status||'todo',
          priority:'normal',
          due:''
        };
      }
    }else{
      this.form={
        status:'todo',
        priority:'normal',
        project:this.project||this.s.projects?.[0]?.id,
        owner:this.page==='mine'?this.s.me.id:'',
        plan:this.s.plans?.[0]?.id,
        company:initialCompany,
        role:data.role||(this.isPlatform?'platform':'member'),
        seats:10,monthly:0,cap:'',
        ...data,
        active:data.active!==0
      };
    }
    if(!this.$refs.dialog.open)this.$refs.dialog.showModal();
  },
  close(){this.$refs.dialog?.close();this.modal='';this.error='';this.sharingNote=null;this.shareUserIds=[]},detail(t){this.open('detail',t)},
  async mutate(type,payload,after){if(this.busy)return;this.busy=true;this.error='';try{await this.api(type,payload);this.s=await this.api('state');after?.();this.notify('Dəyişiklik yadda saxlanıldı.')}catch(e){this.error=e.message;if(!this.modal)this.notify(e.message);if(e.status===409){try{this.s=await this.api('state')}catch{}}}finally{this.busy=false}},
  save(){
    if(this.modal==='profile'){
      if(!this.form.name?.trim()){this.error='Ad və soyad daxil edin.';return;}
      if(!this.form.email?.trim()){this.error='E-poçt daxil edin.';return;}
      if(this.form.password&&this.form.password.length<12){this.error='Şifrə ən azı 12 simvol olmalıdır.';return;}
      this.mutate('profile',this.form,()=>{this.close();this.notify('Profil məlumatlarınız yeniləndi.');});
      return;
    }
    if(this.modal==='group'){
      if(!this.form.name?.trim()){this.error='Şöbənin adını daxil edin.';return;}
      if(!this.form.lead){this.error='Şöbə rəhbərini seçin.';return;}
      if(this.isPlatform&&!this.form.company){this.error='Şirkət seçin.';return;}
      this.mutate('group',this.form,()=>this.close());
      return;
    }
    if(this.modal==='deleteGroup'){
      this.mutate('deleteGroup',{id:this.form.id},()=>this.close());
      return;
    }
    if(this.modal==='project'){
      if(!this.form.name?.trim()){this.error='Layihə adını daxil edin.';return;}
      if(this.isPlatform&&!this.form.company){this.error='Şirkət seçin.';return;}
      const isEdit=!!this.form.id;
      this.mutate('project',this.form,()=>{
        this.close();
        this.notify(isEdit?'Layihənin adı yeniləndi.':'Yeni layihə yaradıldı.');
      });
      return;
    }
    if(this.modal==='task'){
      if(!this.form.title?.trim()){this.error='Tapşırığın adını daxil edin.';return;}
      if(this.isPlatform&&!this.form.company){this.error='Şirkət seçin.';return;}
      if(this.taskTarget==='leader'&&!this.form.id){
        if(!this.companyLeader){this.error='Seçilmiş qurum üzrə aktiv rəhbər tapılmadı.';return;}
        this.form.owner=this.companyLeader.id;
        this.form.owners=[this.companyLeader.id];
      }else if(this.taskTarget==='group'&&!this.form.id){
        if(!this.form.group){this.error='Şöbə seçin.';return;}
      }else if(this.form.id){
        if(!this.form.owner){this.error='Məsul şəxs seçilməlidir.';return;}
      }else{
        if(!this.form.owners||!this.form.owners.length){this.error='Ən azı bir məsul şəxs seçilməlidir.';return;}
      }
      const payload={
        ...this.form,
        target:this.taskTarget,
        group:(this.taskTarget==='group'||this.form.id)?this.form.group:null
      };
      this.mutate('task',payload,()=>this.close());
      return;
    }
    this.mutate(this.modal,this.form,()=>this.close());
  },
  onTaskCompanyChange(){
    const compId=Number(this.form.company);
    const compProjs=this.s.projects.filter(p=>p.company===compId);
    const compGroups=this.s.groups.filter(g=>g.company===compId);
    const compUsers=this.s.users.filter(u=>u.active&&u.company===compId);
    const leader=this.s.users.find(u=>u.active&&u.role==='admin'&&u.company===compId);
    this.form.project=compProjs[0]?.id||'';
    this.form.group=compGroups[0]?.id||'';
    if(this.taskTarget==='leader'&&leader){
      this.form.owner=leader.id;
      this.form.owners=[leader.id];
    }else{
      this.form.owner=compUsers[0]?.id||'';
      this.form.owners=compUsers[0]?[compUsers[0].id]:[];
    }
  },
  openShareModal(n){
    this.sharingNote=n;
    this.shareUserIds=[...(n.shared_with||[])];
    this.modal='shareNote';
    if(!this.$refs.dialog.open)this.$refs.dialog.showModal();
  },
  async saveShareNote(){
    if(!this.sharingNote)return;
    await this.mutate('shareNote',{
      id:this.sharingNote.id,
      users:this.shareUserIds
    },()=>{
      this.close();
      this.notify('Qeyd seçilmiş əməkdaşlarla paylaşıldı.');
    });
  },
  getSharedUserNames(userIds){
    if(!userIds||!userIds.length)return '';
    return userIds.map(id=>this.person(id)).filter(Boolean).join(', ');
  },
  async delegateCurrentTask(){
    if(!this.current)return;
    if(!this.delegateOwners||!this.delegateOwners.length){
      this.notify('Ən azı bir əməkdaş seçin.');
      return;
    }
    await this.mutate('delegateTask',{
      id:this.current.id,
      owners:this.delegateOwners
    },()=>{
      this.close();
      this.notify('Tapşırıq şöbə əməkdaşına təhkim edildi.');
    });
  },
  groupName(id){
    return this.s?.groups?.find(g=>g.id===id)?.name||'';
  },comment(){this.mutate('comment',{id:this.form.id,body:this.note},()=>this.note='')},
  async importUsers(){
    if(this.busy)return;
    const file=this.$refs.importFile.files[0];
    if(!file||!file.name.toLowerCase().endsWith('.xlsx')||file.size>2*1024*1024){
      this.error='2 MB-dan böyük olmayan .xlsx faylı seçin.';
      return;
    }
    const company=this.form.company;
    this.error='';
    this.busy=true;
    try {
      let sheets;
      try {
        sheets=await readXlsxFile(file,{trim:false});
      } catch {
        throw Error('Excel faylı oxunmadı. Faylı .xlsx kimi yenidən yadda saxlayın.');
      }
      const [header=[],...lines]=sheets[0]?.data??[];
      const titles=header.map(value=>String(value??'').trim().toLocaleLowerCase('az'));
      const columns=['ad və soyad','e-poçt','şifrə'].map(name=>titles.indexOf(name));
      if(columns.includes(-1))throw Error('İlk sətirdə Ad və soyad, E-poçt və Şifrə başlıqları olmalıdır.');
      const roleColumn=titles.indexOf('rol');
      const rows=[];
      for(const [index,line] of lines.entries()){
        const [name,email,password]=columns.map(column=>line[column]);
        const role=String(line[roleColumn]??'').trim().toLowerCase();
        if([name,email,password,role].every(value=>value==null||value===''))continue;
        rows.push({line:index+2,name,email,password,role:role||'member'});
        if(rows.length>25)throw Error('Bir faylda ən çox 25 istifadəçi ola bilər.');
      }
      if(!rows.length)throw Error('Əlavə ediləcək istifadəçi tapılmadı.');
      const {imported}=await this.api('importUsers',{company,rows});
      this.close();
      this.notify(`${imported} istifadəçi əlavə edildi.`);
      this.s=await this.api('state');
    } catch(error) {
      if(this.modal==='importUsers')this.error=error.message;
      else this.notify(error.message);
    } finally {
      this.busy=false;
    }
  },
  move(t,status){if(t.status!==status)this.mutate('status',{id:t.id,version:t.version,status})},
  drop(k){if(this.drag)this.move(this.drag,k);this.drag=null;this.over=''},
  formatDateAz(d){
    if(!d)return 'Tarixsiz';
    const parts=String(d).split('-');
    if(parts.length===3){
      const m=['yanvar','fevral','mart','aprel','may','iyun','iyul','avqust','sentyabr','oktyabr','noyabr','dekabr'];
      return `${parseInt(parts[2],10)} ${m[parseInt(parts[1],10)-1]} ${parts[0]}`;
    }
    return d;
  },
  prevMonth(){
    if(this.calMonth===0){this.calMonth=11;this.calYear--;}
    else{this.calMonth--;}
  },
  nextMonth(){
    if(this.calMonth===11){this.calMonth=0;this.calYear++;}
    else{this.calMonth++;}
  },
  goToday(){
    const now=new Date();
    this.calYear=now.getFullYear();
    this.calMonth=now.getMonth();
    this.selectedDate=this.todayDateStr;
  },
  selectDate(dateStr){
    this.selectedDate=dateStr;
  },
  async addDateNote(){
    if(!this.newDateNote.content?.trim()){this.notify('Qeyd mətni daxil edin.');return;}
    await this.mutate('note',{
      title:this.newDateNote.title?.trim()||'',
      content:this.newDateNote.content.trim(),
      date:this.selectedDate,
      shared_with:this.newDateNote.shared_with||[]
    },()=>{
      this.newDateNote.title='';
      this.newDateNote.content='';
      this.newDateNote.shared_with=[];
      this.notify('Təqvim qeydi əlavə edildi.');
    });
  },
  async addFreeNote(){
    if(!this.newFreeNote.content?.trim()){this.notify('Qeyd mətni daxil edin.');return;}
    await this.mutate('note',{
      title:this.newFreeNote.title?.trim()||'',
      content:this.newFreeNote.content.trim(),
      date:null
    },()=>{
      this.newFreeNote.title='';
      this.newFreeNote.content='';
      this.notify('Sərbəst qeyd əlavə edildi.');
    });
  },
  async removeNote(id){
    await this.mutate('deleteNote',{id},()=>{
      this.notify('Qeyd silindi.');
    });
  },
  excel(){
    const tasks=this.page==='reports'?this.reportTasks:(this.page==='mine'?this.baseTasks:this.filtered);
    const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
    const rowsXml=tasks.map(t=>{
      const st=this.statuses[t.status]||t.status;
      const pr=this.priorities[t.priority]||t.priority;
      const proj=this.projectName(t.project)||'—';
      const owner=this.person(t.owner);
      const orgCell=this.isPlatform ? `\n    <Cell ss:StyleID="CellText"><Data ss:Type="String">${esc(t.company_name || this.companyName(t.company_id))}</Data></Cell>` : '';
      return `   <Row ss:Height="22">
    <Cell ss:StyleID="CellCenter"><Data ss:Type="Number">${t.id}</Data></Cell>${orgCell}
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${esc(t.title)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${esc(t.details||'')}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${esc(proj)}</Data></Cell>
    <Cell ss:StyleID="CellText"><Data ss:Type="String">${esc(owner)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${esc(st)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${esc(pr)}</Data></Cell>
    <Cell ss:StyleID="CellCenter"><Data ss:Type="String">${esc(t.due||'Tarixsiz')}</Data></Cell>
   </Row>`;
    }).join('\n');

    const xml=`<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Meridian Tapşırıqlar Hesabatı</Title>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1A202C"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0B2818"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#14452B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellText">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10"/>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="10"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Tapşırıqlar">
  <Table>
   <Column ss:Width="45"/>
   ${this.isPlatform ? '<Column ss:Width="140"/>' : ''}
   <Column ss:Width="200"/>
   <Column ss:Width="240"/>
   <Column ss:Width="140"/>
   <Column ss:Width="140"/>
   <Column ss:Width="105"/>
   <Column ss:Width="95"/>
   <Column ss:Width="95"/>
   <Row ss:Height="28">
    <Cell ss:StyleID="Header"><Data ss:Type="String">№</Data></Cell>
    ${this.isPlatform ? '<Cell ss:StyleID="Header"><Data ss:Type="String">Qurum</Data></Cell>' : ''}
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tapşırıq</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Təsvir</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Layihə</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Məsul şəxs</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Mərhələ</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Prioritet</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Son tarix</Data></Cell>
   </Row>
${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob=new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    const compPart=(this.isPlatform&&this.companyFilter&&this.companyFilter!=='platform')?('-'+this.companyName(this.companyFilter)):(this.isPlatform?'-Platforma':'');
    a.download=(this.isPlatform?('Meridian'+compPart+'-Hesabat'):(this.admin?'Meridian-Tapshiriqlar':'Meridian-Ferdi-Hesabat'))+'-'+this.todayDateStr+'.xls';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  },
  csv(){const tasks=this.reportTasks;const rows=[['Tapşırıq','Layihə','Məsul şəxs','Mərhələ','Prioritet','Son tarix'],...tasks.map(t=>[t.title,this.projectName(t.project),this.person(t.owner),this.statuses[t.status],this.priorities[t.priority],t.due])];const quote=v=>'"'+String(v||'').replace(/^[\s]*[=+@-]/,m=>"'"+m).replaceAll('"','""')+'"';const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=(this.admin?'Meridian-Umumi-Hesabat.csv':'Meridian-Ferdi-Hesabat.csv');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 }
});
app.component('ico',{props:['name'],setup(){return {icons}},template:'<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path :d="icons[name]"/></svg>'});
const orbitStops = new WeakMap();
app.directive('logo-orbit', {
  mounted(svg) {
    const centerX = 674;
    const centerY = 161;
    const ribbonCount = 12;
    const backLayer = svg.querySelector('[data-ribbon-back]');
    const frontLayer = svg.querySelector('[data-ribbon-front]');
    const ribbons = Array.from({ length: ribbonCount }, (_, index) => {
      const gold = index % 2 === 0;
      const tilt = (-30 + (index - 5.5) * 4.4) * Math.PI / 180;
      function makePath(layer, opacity) {
        const path = document.createElementNS(svg.namespaceURI, 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', gold ? 'url(#goldRibbonGrad)' : 'url(#greenRibbonGrad)');
        path.setAttribute('stroke-width', gold ? 2.6 + (index % 3) * .65 : 3.05);
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('opacity', opacity);
        layer.append(path);
        return path;
      }
      return {
        back: makePath(backLayer, .42),
        front: makePath(frontLayer, .96),
        radiusX: 108 + (index % 4) * 14,
        radiusY: 42 + (index % 3) * 10,
        phase: index / ribbonCount * Math.PI * 2,
        speed: 1.75 + (index % 3) * .24,
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
        for (let point = 0; point <= 26; point++) {
          const angle = head - point * 2.35 / 26;
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
