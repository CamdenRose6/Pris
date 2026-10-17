/* Accounts never persist student or teacher content in browser storage. */
window.WordRingClassroom={start({getLibrary,replaceWorkspace,getGuestLibrary,showReading,showLibrary,showClassroom,toast}){
 const $=id=>document.getElementById(id);
 const expandedStudents=new Set();
 let user=null, savedProgress={}, saving=Promise.resolve(), saveError=null, dashboard={students:[]}, busy=false;
 async function api(path,data){
  const response=await fetch(path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(user?{'X-WordRing-User':user.id}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'The request could not be completed.');
  return result;
 }
 function persist(library){
  if(user?.role!=='teacher')return Promise.resolve();
  const content=JSON.parse(JSON.stringify(library)), owner=user.id;
  document.body.dataset.saving='true';
  saving=saving.catch(()=>{}).then(async()=>{
   if(user?.id!==owner)throw Error('The signed-in account changed. Please reload.');
   try{await api('/api/classroom/library',content);saveError=null;$('classroomStatus').textContent='Words saved on this computer.';}
   catch(error){saveError=error;$('classroomStatus').textContent='Words could not be saved. Your changes are still on screen. Try again before signing out.';throw error;}
  });
  const pending=saving;pending.finally(()=>{if(saving===pending)document.body.dataset.saving='false';}).catch(()=>{});
  saving.catch(error=>toast(error.message));
  return saving;
 }
 async function flush(){await saving;if(saveError)throw saveError;}
 function renderIdentity(){
  document.body.dataset.role=user?.role||'guest';
  $('accountLabel').textContent=user?`${user.name} · ${user.role==='teacher'?'Teacher':'Student'}`:'Guest practice';
  $('signIn').hidden=!!user;$('signOut').hidden=!user;
  const teacher=user?.role==='teacher',student=user?.role==='student';
  $('readingNav').hidden=teacher||student;$('practiceNav').hidden=teacher||student;$('libraryNav').hidden=teacher;
  $('requestsNav').hidden=!user;$('requestsNav').textContent=student?'✉  Request a ring':'✉  Requests';
  $('workspaceHeading').textContent=teacher?'YOUR CLASSROOM':'YOUR LEARNING WORLD';
  $('folderLabel').disabled=!user;
  $('folderLabel').textContent=user?'MY RINGS':'MY FOLDERS';
  if(user){const icon=document.createElement('span');icon.innerHTML=ringIcon;$('folderLabel').prepend(icon);}
  $('newFolder').setAttribute('aria-label',teacher?'Add ring':'Add folder');
  $('folderSelectLabel').textContent=teacher?'Ring':'Folder';
  $('managePictures').textContent=teacher?'Review ring pictures →':'Review word pictures →';
  $('pictureSettingsText').textContent=teacher?'Create and review pictures in My Rings. An AI picture appears on a reading card only after you approve it.':'Create and review pictures in My word garden. An AI picture appears on a reading card only after you approve it.';
  $('libraryNav').textContent=student?'My Ring':'▦  My word garden';
  if(student){const icon=document.createElement('span');icon.innerHTML=ringIcon;$('libraryNav').prepend(icon);}
  $('classroomNav').textContent=user?.role==='student'?'♧  My progress':'♧  Classroom';
  $('readingManage').textContent=user?.role==='student'?'My Ring →':'My word garden →';
  for(const id of ['newFolder','openCreate','managePictures'])$(id).hidden=user?.role==='student';
  $('guestClassroom').hidden=!!user;
  $('teacherClassroom').hidden=user?.role!=='teacher';
  $('studentClassroom').hidden=user?.role!=='student';
  $('classroomTitle').textContent=user?.role==='student'?'Look how far you’ve grown.':'Your classroom';
  $('classroomIntro').textContent=user?.role==='teacher'?'Create logins, assign words, and celebrate each reader’s progress.':user?'Read your assigned words. Each correct word joins My Ring.':'Save reading progress and learn together.';
 }
 function renderAssignments(){
  const folder=$('assignFolder').value, cards=getLibrary().cards.filter(card=>!folder||card.folder===folder);
  const everyone=$('assignStudent').value==='__all__';
  $('assignCount').textContent=`${cards.length} word${cards.length===1?'':'s'} ${everyone?`for each of ${dashboard.students.length} students`:'to assign'}`;
  $('assignWords').textContent=everyone?'Assign to everyone':'Assign words';
  $('assignWords').disabled=!cards.length||!dashboard.students.length;
 }
 function renderTeacher(){
  const selected=$('assignStudent').value;
  $('assignStudent').replaceChildren(...dashboard.students.map(student=>{const o=document.createElement('option');o.value=student.id;o.textContent=`${student.name} (${student.username})`;return o;}));
  if(dashboard.students.length){const option=document.createElement('option');option.value='__all__';option.textContent=`Everyone in the class (${dashboard.students.length} student${dashboard.students.length===1?'':'s'})`;$('assignStudent').append(option);}
  if(selected==='__all__'||dashboard.students.some(s=>s.id===selected))$('assignStudent').value=selected;
  const previous=$('assignFolder').value;
  $('assignFolder').replaceChildren(...[['','All rings'],...getLibrary().folders.map(f=>[f,f])].map(([id,label])=>{const o=document.createElement('option');o.value=id;o.textContent=label;return o;}));
  if(getLibrary().folders.includes(previous))$('assignFolder').value=previous;
  renderAssignments();$('studentProgress').replaceChildren();
  if(!dashboard.students.length){$('classProgressSummary').textContent='';$('studentProgress').textContent='Add your first student above.';return;}
  const report=WordRingProgress.summarize(dashboard.students);
  $('classProgressSummary').textContent=report.average===null?'Assign words to start tracking class progress.':`Class average: ${progressPercent(report.average)} of assigned words read · ${report.eligible} students with assignments. On track means at or above this average; below it shows Needs attention.`;
  report.rows.forEach((row,index)=>$('studentProgress').append(studentProgressCard(row,index,{expanded:expandedStudents.has(row.student.id),onToggle:open=>{if(open)expandedStudents.add(row.student.id);else expandedStudents.delete(row.student.id);},onRemove:async ring=>{const owner=user?.id;if(!owner||user.role!=='teacher')throw Error('Sign in as a teacher.');await api('/api/classroom/unassign-ring',{studentId:row.student.id,ring});if(user?.id!==owner)return;await refresh();toast('Ring removed from '+row.student.name+'. Saved progress is kept for reassignment.');}})));

 }
 function renderStudent(){
  const total=getLibrary().cards.length, earned=Object.values(savedProgress).filter(p=>p.correct).length;
  $('studentSummary').textContent=total?`${earned} of ${total} words have joined My Ring. Keep growing, one word at a time.`:'Your teacher will assign words here soon.';
 }
 async function refresh(){
  if(user?.role==='teacher'){dashboard=await api('/api/classroom/dashboard');renderTeacher();}
  else if(user){const workspace=await api('/api/classroom/workspace');savedProgress=workspace.progress||{};replaceWorkspace(workspace.library,savedProgress);renderStudent();}
 }
 async function enter(nextUser){
  const previous=user;user=nextUser;
  let workspace;try{workspace=nextUser?await api('/api/classroom/workspace'):{library:getGuestLibrary()};}catch(error){user=previous;throw error;}
  user=nextUser;saveError=null;saving=Promise.resolve();savedProgress={};
  expandedStudents.clear();dashboard={students:[]};$('studentProgress').replaceChildren();$('assignStudent').replaceChildren();$('studentSummary').textContent='';$('classProgressSummary').textContent='';$('classroomStatus').textContent='';
  savedProgress=workspace.progress||{};
  const library=workspace.library||{cards:[],folders:['My words']};
  replaceWorkspace(library,savedProgress);renderIdentity();if(user)$('accountDialog').close();window.dispatchEvent(new Event('wordring-account'));
  if(user?.role==='teacher'){await refresh();showClassroom();}
  else if(user){renderStudent();showLibrary();}
  else if(!$('accountDialog').open)$('accountDialog').showModal();
 }
 function openLogin(){if(!busy)$('accountDialog').showModal();}
 $('signIn').onclick=openLogin;$('classroomSignIn').onclick=openLogin;
 $('closeAccount').onclick=()=>{if(user)$('accountDialog').close();};
 $('accountDialog').addEventListener('cancel',event=>{if(!user)event.preventDefault();});
 async function authenticate(form,path,data){
  if(busy)return;busy=true;$('accountError').textContent='';
  const buttons=[...$('accountDialog').querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{const result=await api(path,data);await enter(result.user);$('loginForm').reset();$('registerForm').reset();$('accountDialog').close();}
  catch(error){$('accountError').textContent=error.message;}
  finally{busy=false;buttons.forEach(b=>b.disabled=false);}
 }
 $('loginForm').onsubmit=event=>{event.preventDefault();authenticate(event.target,'/api/account/login',{username:$('loginUsername').value,password:$('loginPassword').value});};
 $('registerForm').onsubmit=event=>{event.preventDefault();authenticate(event.target,'/api/account/register',{name:$('teacherName').value,username:$('teacherUsername').value,password:$('teacherPassword').value});};
 $('signOut').onclick=async()=>{
  if(busy)return;busy=true;$('signOut').disabled=true;
  try{await flush();await api('/api/account/logout',{});$('studentForm').reset();await enter(null);toast('Signed out.');}
  catch(error){toast('Sign out paused: '+error.message);}
  finally{busy=false;$('signOut').disabled=false;}
 };
 $('studentForm').onsubmit=async event=>{
  event.preventDefault();$('addStudent').disabled=true;
  try{await api('/api/classroom/students',{name:$('studentName').value,username:$('studentUsername').value,password:$('studentPassword').value});event.target.reset();await refresh();toast('Student login created. Share the credentials privately.');}
  catch(error){$('classroomStatus').textContent=error.message;}
  finally{$('addStudent').disabled=false;}
 };
 $('assignFolder').onchange=renderAssignments;
 $('assignStudent').onchange=renderAssignments;
 $('assignForm').onsubmit=async event=>{
  event.preventDefault();$('assignWords').disabled=true;
  try{
   await persist(getLibrary());await flush();const folder=$('assignFolder').value;
   const cardIds=getLibrary().cards.filter(card=>!folder||card.folder===folder).map(card=>card.id);
   const everyone=$('assignStudent').value==='__all__';
   const result=await api('/api/classroom/assign',{...(everyone?{allStudents:true}:{studentId:$('assignStudent').value}),cardIds});
   await refresh();toast(result.assigned?(everyone?`Assigned ${result.wordsPerStudent} words to each of ${result.students} students.`:`${result.assigned} words assigned.`):'Those words are already assigned; progress was kept.');
  }catch(error){$('classroomStatus').textContent=error.message;}
  finally{renderAssignments();}
 };
 $('importGuestWords').onclick=async()=>{
  const incoming=getGuestLibrary(), current=getLibrary();
  const existing=new Set(current.cards.map(c=>c.id));const cards=incoming.cards.filter(c=>!existing.has(c.id));
  const library={cards:[...current.cards,...cards],folders:[...new Set([...current.folders,...incoming.folders])]};
  try{await persist(library);replaceWorkspace(library,{});renderTeacher();toast(`${cards.length} guest words imported.`);}
  catch(error){$('classroomStatus').textContent=error.message;}
 };
 $('retrySaveWords').onclick=()=>persist(getLibrary()).then(()=>toast('Words saved.')).catch(()=>{});
 $('refreshClassroom').onclick=()=>refresh().catch(error=>{$('classroomStatus').textContent=error.message;});
 $('classroomWords').onclick=()=>$('folderLabel').click();$('studentRead').onclick=showReading;$('studentRing').onclick=showLibrary;
 // No account content is displayed until the session and workspace are both loaded.
 $('signIn').disabled=true;
 $('accountDialog').showModal();
 const loginButtons=[...$('accountDialog').querySelectorAll('button')];loginButtons.forEach(button=>button.disabled=true);
 api('/api/account/me').then(result=>enter(result.user)).catch(error=>{
  document.body.dataset.role='guest';$('accountError').textContent='Could not check your session. Please sign in again. '+error.message;
  if(!$('accountDialog').open)$('accountDialog').showModal();
 }).finally(()=>{$('signIn').disabled=false;loginButtons.forEach(button=>button.disabled=false);});
 return {user:()=>user,isStudent:()=>user?.role==='student',persist,progress:()=>savedProgress,
  result:(card,result)=>{if(!user||user.role!=='student'||!result.progress)return;savedProgress[card.id]=result.progress;renderStudent();},
  refresh:()=>refresh().catch(error=>{$('classroomStatus').textContent=error.message;})};
}};


function progressPercent(value){return new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(value)+'%';}
function studentProgressCard(row,index,options={}){
 const make=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};
 const student=row.student, panel=make('article','student-progress-card '+row.status);
 const heading=make('div','student-progress-name'),nameHeading=make('h3'),nameButton=make('button','student-name-button',student.name);
 nameButton.type='button';nameHeading.append(nameButton);heading.append(nameHeading,make('p','student-username','@'+student.username));
 const rings=make('section','student-assigned-rings');rings.id='student-rings-'+index;rings.hidden=!options.expanded;
 nameButton.setAttribute('aria-expanded',String(!rings.hidden));nameButton.setAttribute('aria-controls',rings.id);
 nameButton.onclick=()=>{rings.hidden=!rings.hidden;nameButton.setAttribute('aria-expanded',String(!rings.hidden));options.onToggle?.(!rings.hidden);};
 rings.append(make('h4','', 'Assigned rings'));
 const grouped=new Map();for(const word of student.words){const ring=word.folder||'Assigned words';grouped.set(ring,(grouped.get(ring)||0)+1);}
 const ringList=make('ul','assigned-ring-list'),ringError=make('p','assigned-ring-error');ringError.setAttribute('role','alert');
 for(const [ring,count] of grouped){
  const item=make('li','assigned-ring-item'),label=make('span','',`${ring} · ${count} word${count===1?'':'s'}`),remove=make('button','remove-assigned-ring','×');
  remove.type='button';remove.setAttribute('aria-label',`Remove ${ring} from ${student.name}`);
  remove.onclick=async()=>{if(remove.disabled)return;remove.disabled=true;ringError.textContent='';try{await options.onRemove?.(ring);}catch(error){ringError.textContent=error.message;}finally{remove.disabled=false;}};
  item.append(label,remove);ringList.append(item);
 }
 if(!grouped.size)rings.append(make('p','', 'No rings assigned.'));rings.append(ringList,make('p','assigned-ring-note','Removing a ring keeps saved progress if you assign it again.'),ringError);
 const body=make('div','student-progress-body'), chart=make('figure','student-progress-chart');
 const history=WordRingProgress.timeline(student.words);
 chart.append(progressChart(history,index,student.name));
 chart.append(make('figcaption','',history.missing?'Some completed words have no saved reading date.':'Words read over time · Last 14 days'));
 if(!row.completed)chart.append(make('p','progress-chart-empty',row.assigned?'No words read yet.':'No assigned words yet.'));
 const metrics=make('div','student-progress-metrics');
 const total=make('div','student-progress-total');total.append(make('span','metric-label','Words read'),make('strong','',`${row.completed} / ${row.assigned}`),make('span','metric-caption','assigned words'));
 const labels={'attention':'Needs attention','on-track':'On track with class','ready':'Ready to start','unassigned':'No words assigned'};
 const status=make('div','student-progress-status');status.append(make('strong','',labels[row.status]));
 status.append(make('p','',row.percent===null?'Assign a ring to begin.':`${progressPercent(row.percent)} complete · Class average ${progressPercent(row.average)}`));
 metrics.append(total,status);body.append(chart,metrics);
 const details=make('details','student-word-details'), summary=make('summary','',`View assigned words (${row.assigned})`),list=make('ul','progress-words');
 for(const word of student.words){list.append(make('li','',`${word.correct?'✓':'○'} ${word.word} · ${word.correct?'In My Ring':word.attempts?'Still practicing':'Ready to read'} · ${word.attempts} checked attempt${word.attempts===1?'':'s'}`));}
 details.append(summary,list);panel.append(heading,rings,body,details);return panel;
}
function progressChart(history,index,name){
 const ns='http://www.w3.org/2000/svg';
 const make=(tag,attributes={},text)=>{const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;};
 const titleId='student-chart-title-'+index,svg=make('svg',{viewBox:'0 0 400 195',role:'img','aria-labelledby':titleId});
 const max=Math.max(1,history.assigned),latest=history.points.at(-1).count;
 svg.append(make('title',{id:titleId},`${name}: ${latest} dated completed words out of ${history.assigned} assigned. Cumulative progress over the last 14 days.`));
 const left=35,right=385,top=15,bottom=160;
 const x=i=>left+(right-left)*i/(history.points.length-1),y=value=>bottom-(bottom-top)*value/max;
 const ticks=max<=1?[0,max]:[0,Math.ceil(max/2),max];
 for(const value of ticks){svg.append(make('line',{x1:left,y1:y(value),x2:right,y2:y(value),class:'progress-grid-line'}),make('text',{x:left-10,y:y(value)+4,'text-anchor':'end',class:'progress-axis-label'},value));}
 const path=history.points.map((point,i)=>`${i?'L':'M'} ${x(i)} ${y(point.count)}`).join(' ');
 svg.append(make('path',{d:path,fill:'none',class:'progress-chart-line'}));
 const format=timestamp=>new Date(timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'});
 history.points.forEach((point,i)=>{const circle=make('circle',{cx:x(i),cy:y(point.count),r:3,class:'progress-chart-dot'});circle.append(make('title',{},`${format(point.date)}: ${point.count} words read`));svg.append(circle);});
 svg.append(make('text',{x:left,y:185,class:'progress-axis-label'},format(history.points[0].date)),make('text',{x:right,y:185,'text-anchor':'end',class:'progress-axis-label'},format(history.points.at(-1).date)));
 return svg;
}
