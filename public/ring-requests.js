/* Ring ideas stay inside the student's own classroom. Teacher review precedes creation. */
window.WordRingRequests={create({account,getLibrary,createRing,openRing,toast}){
 const $=id=>document.getElementById(id), jobs=new Set();let epoch=0;
 function element(tag,className,text){const node=document.createElement(tag);node.className=className||'';if(text!==undefined)node.textContent=text;return node;}
 async function api(path,data,signal){
  const user=account();if(!user)throw Error('Sign in to use ring requests.');
  const response=await fetch(path,{method:data===undefined?'GET':'POST',headers:{'X-WordRing-User':user.id,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)}),signal});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Could not update requests.');return result;
 }
 function reset(){epoch++;for(const job of jobs)job.abort();jobs.clear();$('ringRequestForm').reset();$('ringRequestsList').replaceChildren();$('requestStatus').textContent='';$('sendRingRequest').disabled=false;refresh();}
 async function refresh(){
  const user=account(),run=epoch;if(!user)return;
  $('requestsTitle').textContent=user.role==='student'?'Request a ring':'Student requests';
  $('requestsIntro').textContent=user.role==='student'?'Tell your teacher what you’d love to read about.':'Approve or deny ideas, then create a ring and review its pictures before assigning it.';
  $('ringRequestForm').hidden=user.role!=='student';
  try{
   const result=await api('/api/classroom/requests');if(run!==epoch||account()?.id!==user.id)return;
   const pending=result.requests.filter(request=>request.status==='pending').length;
   $('requestsNav').textContent=user.role==='student'?'✉  Request a ring':`✉  Requests${pending?' ('+pending+')':''}`;
   $('ringRequestsList').replaceChildren();
   if(!result.requests.length)$('ringRequestsList').append(element('p','request-empty',user.role==='student'?'Your ring ideas will appear here.':'No student ring requests yet.'));
   for(const request of [...result.requests].sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)))$('ringRequestsList').append(requestCard(request,user,run));
  }catch(error){if(run===epoch)$('requestStatus').textContent=error.message;}
 }
 function requestCard(request,user,run){
  const panel=element('article','settings-panel ring-request-card'),heading=element('h2','',request.topic);
  const label={pending:'Waiting for teacher',approved:'Approved',denied:'Not approved'};
  panel.append(heading,element('p','request-meta',user.role==='teacher'?`From ${request.studentName}`:'Your ring idea'),element('strong','request-badge '+request.status,label[request.status]));
  if(user.role==='teacher'&&request.status==='pending'){
   const actions=element('div','actions');
   for(const [decision,text] of [['approved','Approve'],['denied','Deny']]){
    const button=element('button',decision==='approved'?'primary':'secondary',text);
    button.onclick=async()=>{actions.querySelectorAll('button').forEach(b=>b.disabled=true);try{await api('/api/classroom/request-review',{requestId:request.id,decision});if(run===epoch){await refresh();toast(decision==='approved'?'Idea approved. Choose the words for its ring.':'Request marked not approved.');}}catch(error){if(run===epoch)$('requestStatus').textContent=error.message;}finally{actions.querySelectorAll('button').forEach(b=>b.disabled=false);}};
    actions.append(button);
   }panel.append(actions);
  }
  if(request.status==='approved'){
   if(user.role==='teacher'){
    if(request.ring&&getLibrary().folders.includes(request.ring)){
     const button=element('button','secondary','Open ring · create and review pictures →');button.onclick=()=>openRing(request.ring);panel.append(element('p','',`Ring: ${request.ring}`),button);
    }else if(request.ring){panel.append(element('p','','The linked ring was removed from your collection.'));}
    else panel.append(creationForm(request,run));
   }else{
    const assigned=request.ring&&getLibrary().folders.includes(request.ring);
    panel.append(element('p','',assigned?'Your ring is ready in My Ring!':'Your teacher is preparing the words and pictures.'));
   }
  }
  if(request.status==='denied'&&user.role==='student')panel.append(element('p','','Your teacher chose not to create this ring. You can suggest another idea.'));
  return panel;
 }
 function creationForm(request,run){
  const form=element('form','request-create-form'),suffix=request.id;
  const labelInput=(labelText,id,node)=>{const label=element('label','',labelText);label.htmlFor=id;node.id=id;form.append(label,node);return node;};
  const mode=labelInput('Create words','request-mode-'+suffix,document.createElement('select'));
  for(const [value,text] of [['gemma','Generate with Gemma'],['manual','Use my own words (no AI)']]){const option=element('option','',text);option.value=value;mode.append(option);}
  const count=labelInput('Number of Gemma words (1–200, subject to collection space)','request-count-'+suffix,document.createElement('input'));count.type='number';count.min='1';count.max='200';count.value='6';count.required=true;
  const grade=labelInput('Reading level','request-grade-'+suffix,document.createElement('select'));
  for(const value of ['K','1','2','3','4','5']){const option=element('option','',value==='K'?'Kindergarten':'Grade '+value);option.value=value;grade.append(option);}
  const words=labelInput('Your own words (comma separated, for manual creation)','request-words-'+suffix,document.createElement('textarea'));words.maxLength=4000;words.placeholder='cat, dog, sun';
  mode.onchange=()=>{count.disabled=mode.value==='manual';words.required=mode.value==='manual';};
  const note=element('p','form-note','Gemma generation uses your connected provider and may consume credits. Pictures are created and approved separately inside the ring before assignment. Large sets are generated in batches of up to 8 words.');
  const error=element('p','request-error');error.setAttribute('role','alert');
  const button=element('button','primary','Create ring');form.append(note,error,button);
  form.onsubmit=async event=>{
   event.preventDefault();if(run!==epoch)return;
   const inputs=[...form.querySelectorAll('input,select,textarea,button')];inputs.forEach(input=>input.disabled=true);error.textContent='';
   const controller=new AbortController();jobs.add(controller);let savedRing=null;
   try{
    const ring=await createRing({topic:request.topic,grade:grade.value,count:Number(count.value),manual:mode.value==='manual',words:words.value,signal:controller.signal,onProgress:text=>button.textContent=text});
    savedRing=ring;if(run!==epoch)return;
    await api('/api/classroom/request-ring',{requestId:request.id,ring},controller.signal);
    await refresh();openRing(ring);toast('Ring created. Create and review its pictures, then assign it in Classroom.');
   }catch(reason){if(run===epoch)error.textContent=savedRing?`Ring “${savedRing}” was saved in My Rings, but linking failed. ${reason.message}`:reason.name==='AbortError'?'Creation cancelled.':reason.message;}
   finally{jobs.delete(controller);inputs.forEach(input=>input.disabled=false);mode.onchange();button.textContent='Create ring';}
  };return form;
 }
 document.querySelectorAll('[data-ring-idea]').forEach(button=>button.onclick=()=>{$('ringRequestTopic').value=button.dataset.ringIdea;$('ringRequestTopic').focus();});
 $('ringRequestForm').onsubmit=async event=>{
  event.preventDefault();const run=epoch;$('sendRingRequest').disabled=true;$('requestStatus').textContent='';
  try{await api('/api/classroom/requests',{topic:$('ringRequestTopic').value});if(run===epoch){event.target.reset();await refresh();toast('Your ring idea was sent to your teacher.');}}
  catch(error){if(run===epoch)$('requestStatus').textContent=error.message;}
  finally{if(run===epoch)$('sendRingRequest').disabled=false;}
 };
 $('refreshRequests').onclick=refresh;window.addEventListener('wordring-account',reset);
 return {refresh};
}};
