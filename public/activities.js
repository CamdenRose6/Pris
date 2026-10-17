window.WordRingActivities={create({getUser,stopSpeech,speak,onResult,render}){
 const $=id=>document.getElementById(id);let run=0,controller=null,busy=false,currentCard=null,currentComplete=false;const feedback=new Map();
 const make=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls||'';if(text!==undefined)node.textContent=text;return node;};
 function cancel(){run++;controller?.abort();controller=null;busy=false;currentCard=null;}
 function show(card,completed){
  currentCard=card;currentComplete=completed;const root=$('advancedActivities');root.replaceChildren();
  const progress=card.activityProgress||WordRingLearning.initial(card),phase=WordRingLearning.phase(card,progress,completed);
  root.append(make('p','eyebrow','SPELLING + READING COMPREHENSION'));
  if(phase==='done'){
   root.append(make('h2','','Great work!'),make('p','','You completed this word. Use Next word, or return to My Ring.'));return;
  }
  let content;
  try{content=WordRingLearning.content(card.comprehension);}catch{
   root.append(make('h2','','Your teacher is preparing this activity.'),make('p','','This ring needs a reading passage and questions. Please try another ring.'));return;
  }
  if(phase==='spelling'){
   root.append(make('h2','','Spell the word'));
   const picture=WordRingImages.approvedURL(card);
   if(picture){const image=make('img','spelling-picture');image.src=picture;image.alt='Picture clue for the spelling word';root.append(image);}
   else if(card.emoji){const clue=make('span','spelling-emoji',card.emoji);clue.setAttribute('role','img');clue.setAttribute('aria-label','Picture clue');root.append(clue);}
   else{root.append(make('p','','Your teacher needs to add a picture clue before you can spell this word.'));return;}
   const form=make('form','spelling-form'),label=make('label','','What word does the picture show?');label.htmlFor='spellingAnswer';
   const input=make('input');input.id='spellingAnswer';input.type='text';input.maxLength=100;input.required=true;input.autocomplete='off';input.spellcheck=false;input.autocapitalize='off';input.disabled=busy;
   const button=make('button','primary',busy?'Checking…':'Check spelling');button.disabled=busy;
   form.append(label,input,button);form.onsubmit=event=>{event.preventDefault();submit(card,{activity:'spelling',answer:input.value});};root.append(form);
   if(progress.spellingMisses>0){const hear=make('button','secondary','Hear the word again');hear.type='button';hear.onclick=()=>speak(card.word);root.append(hear);}
  }else{
   const index=progress.questionsCorrect.findIndex(correct=>!correct),question=content.questions[index];
   root.append(make('h2','','Read and understand'),make('p','comprehension-passage',content.passage),make('p','question-number',`Question ${index+1} of ${content.questions.length}`),make('h3','',question.question));
   const choices=make('div','comprehension-choices');question.choices.forEach((choice,answer)=>{const button=make('button','secondary',choice);button.disabled=busy;button.onclick=()=>submit(card,{activity:'comprehension',questionIndex:index,answer});choices.append(button);});root.append(choices);
  }
  const message=make('p','activity-feedback',feedback.get(card.id)||'Take your time. You can try again.');message.setAttribute('role','status');message.setAttribute('aria-live','polite');root.append(message);
 }
 async function submit(card,answer){
  if(busy||!getUser())return;stopSpeech();busy=true;const epoch=++run,owner=getUser().id;controller=new AbortController();show(card,currentComplete);
  const timer=setTimeout(()=>controller?.abort(),15000);
  try{
   const response=await fetch('/api/classroom/activity-check',{method:'POST',headers:{'Content-Type':'application/json','X-WordRing-User':owner},body:JSON.stringify({cardId:card.id,...answer}),signal:controller.signal});
   const result=await response.json();if(epoch!==run||getUser()?.id!==owner)return;
   if(!response.ok)throw Error(result.error||'Could not check that answer. Try again.');
   card.activityProgress=result.activityProgress;feedback.set(card.id,result.message);onResult(card,result);busy=false;render();
   if(answer.activity==='spelling'&&result.outcome==='retry'){speak(card.word);$('spellingAnswer')?.focus();}
  }catch(error){if(epoch===run){feedback.set(card.id,error.name==='AbortError'?'The check took too long. Please try again.':error.message);busy=false;render();}}
  finally{clearTimeout(timer);if(epoch===run){busy=false;controller=null;}}
 }
 return {show,cancel,reset:()=>{cancel();feedback.clear();}};
}};
