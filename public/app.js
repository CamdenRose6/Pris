const $ = id => document.getElementById(id);
let classroomAccount = null, requestDesk = null, activityPlayer = null, workspaceGeneration = 0;
let ringMenuTarget=null, ringDeleteTarget=null, ringDeleteBusy=false;
let imageGeneration = false, imageLabel = 'FLUX.1 Schnell';
function cardImageLabel(card){return card.imageModel?.includes('flux-1-schnell')?'FLUX.1 Schnell':card.imageModel?'Nano Banana 2':'AI illustration';}
const imageJobs = new Map(), brokenImages = new Set();
function cardImageURL(card){const url=WordRingImages.approvedURL(card);return url&&!brokenImages.has(url)?url:null;}
let reviewingCardId=null, reviewLoaded=false;

const samples = [
 ['cat','🐈','A small, furry animal that often lives with people.','The cat sleeps in the sun.','It says meow.','Which animal says meow?',['bird','cat','frog'],1],
 ['bird','🐦','An animal with feathers and a beak.','A bird sings in the tree.','Look for feathers and wings.','Which animal has feathers?',['bird','cat','frog'],0],
 ['garden','🌷','A place where people grow flowers or vegetables.','We plant seeds in our garden.','Think of a place where flowers grow.','Where would you plant flowers?',['ocean','bedroom','garden'],2],
 ['grow','🌱','To become bigger or taller.','The little seed will grow into a plant.','Think about a seed becoming a tall plant.','What does grow mean?',['Become smaller','Become bigger','Go to sleep'],1],
 ['sun','☀️','The star that gives Earth light and warmth.','The sun shines on the flowers.','You see it in the sky during the day.','What gives Earth light and warmth?',['sun','moon','cloud'],0],
 ['butterfly','🦋','An insect with large, colorful wings.','A butterfly lands on a flower.','It was once a caterpillar.','Which animal was once a caterpillar?',['cat','bird','butterfly'],2]
].map(([word,emoji,definition,sentence,hint,question,choices,answer]) => ({word,emoji,definition,sentence,hint,imagePrompt:`A friendly illustration of ${word}, no text`,quiz:{question,choices,answer},source:'sample',folder:'Nature explorers',grade:'2'}));
let state;
try { state = JSON.parse(localStorage.getItem('wordring-v1')); } catch {}
if (!state || !Array.isArray(state.cards) || !Array.isArray(state.folders)) state = {cards:samples.map(c=>({...c,id:crypto.randomUUID()})),folders:['Nature explorers','My favorite words']};
if(WordRingImages.migrate(state.cards))save();
let readingIndex = 0, readingFlipped = false, activeTab = 'reading';
let activeFolder = '', view = 'both', queue = [], questionIndex = 0, solved = false, firstTry = true, score = 0;
const reader = WordRingRecorder.create({getCard:()=>currentCards()[readingIndex],stopSpeech,render:()=>renderReading(),skip:()=>moveWord(1),hasPicture:card=>!!cardImageURL(card)||!!card.emoji,onResult:(card,result)=>classroomAccount?.result(card,result),getUserId:()=>classroomAccount?.user()?.id,isActive:()=>!isAdvancedCurrent()});
const ringIcon = '<svg class="ring-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="7" y="3" width="14" height="18" rx="3"/><path d="M10 7H5a2 2 0 0 0 0 4h5M10 13H5a2 2 0 0 0 0 4h5"/></svg>';
function isAdvancedCurrent(){const card=currentCards()[readingIndex];return !!(classroomAccount?.isStudent()&&card&&WordRingLearning.advanced(card));}
const isTeacher = ()=>classroomAccount?.user()?.role==='teacher';
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message) { $('toast').textContent=message; $('toast').classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').classList.remove('show'),3000); }
function save() { if(classroomAccount?.user()){if(classroomAccount.isStudent())return;return classroomAccount.persist(state);} try { localStorage.setItem('wordring-v1',JSON.stringify(state)); } catch { toast('Storage is full. These changes may not survive a reload.'); } }
function currentCards() { return state.cards.filter(c=>!activeFolder || c.folder===activeFolder); }
function render() {
 $('folderLabel').setAttribute('aria-current',isTeacher()&&!activeFolder&&activeTab==='library'?'page':'false');
 $('folders').replaceChildren();
 [...(classroomAccount?.user()?[]:[['','All words']]),...state.folders.map(f=>[f,f])].forEach(([value,label])=>{const b=document.createElement('button'); b.className='folder'+(activeFolder===value?' selected':''); b.innerHTML=`${classroomAccount?.user()?ringIcon:'▱ &nbsp;'} ${escapeHTML(label)} <b>${isTeacher()&&!value?state.folders.length:state.cards.filter(c=>!value||c.folder===value).length}</b>`;b.onclick=()=>{activeFolder=value;readingIndex=0;showReading();};if(isTeacher()&&value)enableRingMenu(b,value);$('folders').append(b);});
 $('folderSelect').replaceChildren(...state.folders.map(f=>{const o=document.createElement('option');o.value=f;o.textContent=f;return o;}));
 if(activeFolder) $('folderSelect').value=activeFolder;
 $('folderHeading').textContent=classroomAccount?.isStudent()?'My Ring':activeFolder||(isTeacher()?'My Rings':'My word garden');
 const studentOverview=classroomAccount?.isStudent();
 const overview=(isTeacher()&&!activeFolder)||studentOverview;
 $('openCreate').textContent=overview?'＋ Add ring':'＋ Add content';
 document.querySelector('.view-switch').hidden=overview;
 if(overview){
  $('cardCount').textContent=`${state.folders.length} ring${state.folders.length===1?'':'s'} · ${studentOverview?'Choose a ring to read':'Choose a ring to manage its cards'}`;
  $('cards').replaceChildren();
  if(!state.folders.length)$('cards').innerHTML=studentOverview?'<div class="empty">Your teacher will assign rings here soon. You can request a ring with your own idea.</div>':'<div class="empty">Create your first ring to start adding cards.</div>';
  for(const folder of state.folders){
   const button=document.createElement('button');button.className='ring-overview-card';button.type='button';
   const count=state.cards.filter(card=>card.folder===folder).length;
   const earned=state.cards.filter(card=>card.folder===folder&&classroomAccount?.progress()[card.id]?.correct).length;
   button.innerHTML=`${ringIcon}<h3>${escapeHTML(folder)}</h3><p>${studentOverview?`${earned} / ${count} words read`:`${count} card${count===1?'':'s'}`}</p>${studentOverview?`<progress value="${earned}" max="${count||1}" aria-label="Words read"></progress>`:''}<span>${studentOverview?'Read this ring':'Open ring'} →</span>`;
   if(state.cards.some(card=>card.folder===folder&&WordRingLearning.advanced(card))){const badge=document.createElement('small');badge.className='activity-type-badge';badge.textContent='Spelling + comprehension';button.append(badge);}
   if(!studentOverview)enableRingMenu(button,folder);button.onclick=()=>{activeFolder=folder;readingIndex=0;studentOverview?showReading():showLibrary();};$('cards').append(button);
  }
  return;
 }
 const cards=currentCards().filter(card=>!classroomAccount?.isStudent()||classroomAccount.progress()[card.id]?.correct); $('cardCount').textContent=classroomAccount?.isStudent()?`${cards.length} word${cards.length===1?'':'s'} in My Ring`:isTeacher()?`${cards.length} word${cards.length===1?'':'s'} ${activeFolder?'in this ring':'across your rings'}`:`${cards.length} words to discover · A little more curious every day`;
 $('cards').innerHTML=cards.length?'':classroomAccount?.isStudent()?'<div class="empty">Your ring is ready to grow.<br>Read an assigned word correctly to add it here.</div>':'<div class="empty">Your next discovery belongs here.<br>Create a word set to get started.</div>';
 cards.forEach((card,i)=>{
  const el=document.createElement('article');el.className='card';el.style.setProperty('--tint',['#f2e9d9','#e9eee0','#f7e7df','#e7efdf','#f9efd1','#eae6f1'][i%6]);
  el.innerHTML=`${view!=='word'?`<div class="picture" aria-label="${view==='picture'?'Vocabulary illustration':escapeHTML(card.word)+' illustration'}">${cardImageURL(card)?`<img class="card-illustration" src="${cardImageURL(card)}" alt="${view==='picture'?'Word picture clue':escapeHTML(card.word)+' illustration'}">`:`<span aria-hidden="true">${escapeHTML(card.emoji||'✦')}</span>`}<small>${cardImageURL(card)?escapeHTML(cardImageLabel(card)):card.emoji?'Emoji clue':'Image pending'}</small></div>`:''}<div class="card-body"><div class="word-line"><h3>${view==='picture'?'Mystery word':escapeHTML(card.word)}</h3><button class="speak" aria-label="Hear ${view==='picture'?'word':escapeHTML(card.word)}">◖))</button></div>${view!=='picture'?`<p class="definition">${escapeHTML(card.definition)}</p><div class="sentence">${escapeHTML(card.sentence)}</div>`:'<p class="definition">Look at the picture. Can you name it?<br>Tap the speaker for a clue.</p>'}<div class="card-bottom"><span>${card.source==='gemma'?'✦ Gemma lesson':card.source==='manual'?'Your word':'Sample lesson'}</span><button class="make-picture" aria-label="Picture options for ${escapeHTML(card.word)}" ${imageJobs.has(card.id)?'disabled':''}>${imageJobs.has(card.id)?'Creating…':card.pendingImageUrl?'Review picture':cardImageURL(card)||card.emoji?'Picture options':'Create picture'}</button><button class="edit-activities" ${!isTeacher()||!WordRingLearning.advanced(card)?'hidden':''}>${card.comprehension?'Edit activities':'Set up activities'}</button><button class="delete" aria-label="Delete ${escapeHTML(card.word)}">Remove</button></div></div>`;
  el.querySelector('.edit-activities').onclick=()=>openActivityEditor(card);
  el.querySelector('.make-picture').onclick=()=>openImageReview(card);
  if(classroomAccount?.isStudent()){el.querySelector('.make-picture').hidden=true;el.querySelector('.delete').hidden=true;}
  const img=el.querySelector('.card-illustration');if(img)img.onerror=()=>markMissingPicture(card,img);
  el.querySelector('.speak').onclick=()=>speak(card.word);
  el.querySelector('.delete').onclick=()=>{state.cards=state.cards.filter(c=>c.id!==card.id);save();render();};
  $('cards').append(el);
 });
}
let naturalSpeech = false, speechRequest = 0, speechController = null, playingAudio = null, audioURL = null;
let deviceVoices = [], voicePreference = 'auto';
try { voicePreference=localStorage.getItem('wordring-voice')||'auto';$('speechSpeed').value=localStorage.getItem('wordring-slow')==='true'?'slow':'normal'; } catch {}
function stopSpeech(){
 speechRequest++;
 if(speechController){speechController.abort();speechController=null;}
 if(playingAudio){playingAudio.pause();playingAudio=null;}
 if(audioURL){URL.revokeObjectURL(audioURL);audioURL=null;}
 if('speechSynthesis' in window)speechSynthesis.cancel();
 document.querySelectorAll('.letter-button.is-speaking').forEach(button=>button.classList.remove('is-speaking'));
 $('readAloud').classList.remove('speaking');$('readAloud').removeAttribute('aria-busy');
}
function voiceScore(voice){
 let score=/^en[-_]US$/i.test(voice.lang)?20:0;
 if(/premium|enhanced|natural|neural|google/i.test(voice.name))score+=100;
 if(/samantha|ava|zoe|susan|jenny|aria/i.test(voice.name))score+=40;
 if(voice.default)score+=5;
 return score;
}
function refreshVoices(){
 deviceVoices='speechSynthesis' in window?speechSynthesis.getVoices().filter(v=>/^en([-_]|$)/i.test(v.lang)&&! /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|trinoids|whisper|wobble|zarvox/i.test(v.name)).sort((a,b)=>voiceScore(b)-voiceScore(a)):[];
 const select=$('voiceSelect');select.replaceChildren();
 const add=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);};
 add('auto',naturalSpeech?'Natural AI voice':'Best available device voice');
 deviceVoices.forEach(v=>add(v.voiceURI,`${v.name} · ${v.lang}`));
 select.value=[...select.options].some(o=>o.value===voicePreference)?voicePreference:'auto';
 updateVoiceStatus();
}
function updateVoiceStatus(message){
 if(message){$('voiceStatus').textContent=message;return;}
 const choice=deviceVoices.find(v=>v.voiceURI===$('voiceSelect').value)||deviceVoices[0];
 $('voiceStatus').textContent=naturalSpeech&&$('voiceSelect').value==='auto'?'Natural AI reading voice':choice?`Device voice: ${choice.name}`:'Device default voice · quality depends on your browser';
}
function speakOnDevice(text, request){
 if(request!==speechRequest)return;
 if(!('speechSynthesis' in window)){updateVoiceStatus('No device voice available. Connect a natural voice to hear words.');return;}
 const u=new SpeechSynthesisUtterance(text);
 const voice=deviceVoices.find(v=>v.voiceURI===$('voiceSelect').value)||deviceVoices[0];
 if(voice){u.voice=voice;u.lang=voice.lang;}else u.lang='en-US';
 u.rate=($('speechSpeed').value==='slow')?.8:.95;u.pitch=1;u.volume=1;
 u.onstart=()=>{if(request===speechRequest)updateVoiceStatus('Reading…');};
 u.onend=()=>{if(request===speechRequest){$('readAloud').classList.remove('speaking');document.querySelectorAll('.letter-button.is-speaking').forEach(button=>button.classList.remove('is-speaking'));updateVoiceStatus();}};
 u.onerror=event=>{if(request===speechRequest&&event.error!=='interrupted'&&event.error!=='canceled'){updateVoiceStatus('Audio could not play. Try another reading voice.');$('readAloud').classList.remove('speaking');}};
 $('readAloud').classList.add('speaking');speechSynthesis.speak(u);
}
async function speak(text, options={}){
 reader.cancel();stopSpeech();const request=speechRequest;
 if(options.buttons)options.buttons.forEach(button=>button.classList.add('is-speaking'));
 const fallback=()=>{if(options.sound){$('letterFeedback').textContent='Sound audio is unavailable. Try again or use Hear the word.';document.querySelectorAll('.letter-button.is-speaking').forEach(button=>button.classList.remove('is-speaking'));return;}speakOnDevice(text,request);};
 if(!options.sound&&(!naturalSpeech||$('voiceSelect').value!=='auto')){fallback();return;}
 const controller=new AbortController();speechController=controller;$('readAloud').setAttribute('aria-busy','true');updateVoiceStatus('Getting your reading voice ready…');
 const timeout=setTimeout(()=>controller.abort(),35000);
 try{
  const response=await fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,slow:($('speechSpeed').value==='slow'),...(options.sound?{sound:options.sound}:{})}),signal:controller.signal});
  if(!response.ok)throw Error('Speech unavailable');
  const blob=await response.blob();if(request!==speechRequest)return;
  audioURL=URL.createObjectURL(blob);playingAudio=new Audio(audioURL);
  playingAudio.onended=()=>{if(request===speechRequest){stopSpeech();updateVoiceStatus();}};
  playingAudio.onerror=()=>{if(request===speechRequest){stopSpeech();updateVoiceStatus('Audio could not play. Please try again.');}};
  await playingAudio.play();if(request!==speechRequest)return;
  $('readAloud').classList.add('speaking');updateVoiceStatus('Reading…');
 }catch(error){if(request!==speechRequest)return;updateVoiceStatus(options.sound?'Sound audio is unavailable.':'Natural voice unavailable. Using your device voice.');toast(options.sound?'Sound audio is unavailable. Please try again.':'Using your device voice for now.');fallback();}
 finally{clearTimeout(timeout);if(request===speechRequest){speechController=null;$('readAloud').removeAttribute('aria-busy');}}
}
$('voiceSelect').onchange=()=>{stopSpeech();voicePreference=$('voiceSelect').value;try{localStorage.setItem('wordring-voice',voicePreference);}catch{}updateVoiceStatus();};
$('speechSpeed').onchange=()=>{stopSpeech();try{localStorage.setItem('wordring-slow',String(($('speechSpeed').value==='slow')));}catch{}updateVoiceStatus();};
if('speechSynthesis' in window)speechSynthesis.addEventListener('voiceschanged',refreshVoices);
refreshVoices();

function showLibrary(){ setTab('library'); $('library').hidden=false;$('practice').hidden=true;$('libraryNav').classList.add('active');$('practiceNav').classList.remove('active');render(); }
function beginPractice(){if(classroomAccount?.isStudent()){showStudentHome();return;}if(isTeacher()){setTab('classroom');return;}queue=[...currentCards()].filter(c=>c.quiz).sort(()=>Math.random()-.5).slice(0,5);if(!queue.length)return toast('Create some cards before practicing.');setTab('practice');questionIndex=0;score=0;$('library').hidden=true;$('practice').hidden=false;$('libraryNav').classList.remove('active');$('practiceNav').classList.add('active');renderQuestion();$('practice').scrollIntoView({behavior:'smooth'});}
function renderQuestion(){
 if(questionIndex===queue.length){$('quiz').innerHTML=`<div style="font-size:58px">🌻</div><p class="eyebrow">LOOK AT YOU GROW!</p><h3>You practiced ${queue.length} words.</h3><p>${score} correct on the first try. Every retry is another chance to learn.</p><button class="primary" id="again">Practice again</button>`;$('again').onclick=beginPractice;return;}
 const card=queue[questionIndex];solved=false;firstTry=true;
 $('quiz').innerHTML=`<div class="quiz-progress">WORD ${questionIndex+1} OF ${queue.length} · ${card.source==='gemma'?'Created by Gemma':'Sample practice'}</div><h3>${escapeHTML(card.quiz.question)}</h3><div id="choices"></div><p id="feedback" role="status"></p><div class="hint" id="hintText" hidden>${escapeHTML(card.hint)}</div><div class="quiz-actions"><button class="secondary" id="hint">Give me a hint</button><button class="primary" id="next" hidden>Next word →</button></div>`;
 card.quiz.choices.forEach((choice,i)=>{const b=document.createElement('button');b.className='choice';b.textContent=choice;b.onclick=()=>{if(solved)return;if(i===card.quiz.answer){solved=true;if(firstTry)score++;b.classList.add('correct');$('feedback').textContent='You got it! '+card.sentence;$('next').hidden=false;document.querySelectorAll('.choice').forEach(c=>c.disabled=true);}else{firstTry=false;b.classList.add('wrong');b.disabled=true;$('feedback').textContent='Give it another try. Here’s a clue.';$('hintText').hidden=false;}};$('choices').append(b);});
 $('hint').onclick=()=>{$('hintText').hidden=false;};$('next').onclick=()=>{questionIndex++;renderQuestion();};
}
function updateContentForm(){
 const advanced=WordRingLearning.advanced({grade:$('grade').value});
 $('contentType').textContent=advanced?'Spelling + reading comprehension':'Pronunciation words';
 $('contentDescription').textContent=['4','5'].includes($('grade').value)?'Longer passages with two questions on inference, evidence, and reasoning. Grade 5 adds evaluation of explanations and claims.':advanced?'Each card includes a picture-based spelling question and a short reading passage with comprehension questions. Students complete both activities.':'Students read words aloud and tap letters to hear their sounds. Picture and audio clues help when they need another try.';
 $('contentNote').textContent=advanced?'Gemma creates both activities. For your own words without Gemma, set up the reading questions after adding them. Create and approve a picture, or choose an emoji clue, before assigning.':'Gemma creates grade-appropriate words to practice pronouncing. Kindergarten and Grade 1 have no spelling or comprehension questions.';
 $('sample').textContent=advanced?'Try sample activities':'Try sample words';
}
function addCards(cards, source){
 if(classroomAccount?.isStudent())return;
 const folder=$('folderSelect').value,grade=$('grade').value,advanced=WordRingLearning.advanced({grade});
 const added=cards.map(c=>{const card={...c,id:crypto.randomUUID(),folder,grade,source};if(!advanced){delete card.quiz;delete card.comprehension;}return card;});
 state.cards.push(...added);activeFolder=folder;save();$('createDialog').close();readingIndex=Math.max(0,currentCards().length-cards.length);showReading();toast(`${cards.length} ${advanced?'activity cards':'pronunciation words'} added to ${folder}`);
 if(advanced&&source==='manual'&&isTeacher())openActivityEditor(added[0]);
}
function sampleLesson(){
 if(['4','5'].includes($('grade').value)){addCards(WordRingLearning.upperSamples($('grade').value),'sample');return;}
 const cards=samples.slice(0,5).map(card=>({...card,comprehension:{passage:card.sentence,questions:[{...card.quiz,choices:[...card.quiz.choices]}]}}));
 // Sample questions must be answerable from the passage itself.
 cards.forEach(card=>{card.comprehension.passage=card.definition+' '+card.sentence+' '+card.hint;});
 addCards(cards,'sample');
}
function manualCards(){const words=[...new Set($('words').value.split(',').map(s=>s.trim()).filter(Boolean))].slice(0,8);return words.map(word=>({word,definition:'Your own word.',sentence:'',hint:'',imagePrompt:`An illustration of ${word}`}));}
let gemmaConnected=false;
$('createForm').onsubmit=async event=>{event.preventDefault();$('createError').textContent='';if(!gemmaConnected){const cards=manualCards();if(cards.length){addCards(cards,'manual');return;}$('createError').textContent='Gemma is not connected yet. Enter your own words or try the sample lesson.';return;}const generation=workspaceGeneration;const button=$('generate');button.disabled=true;button.textContent='Growing your lesson…';try{const response=await fetch('/api/lesson',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grade:$('grade').value,topic:$('topic').value,words:$('words').value}),signal:AbortSignal.timeout(65000)});const result=await response.json();if(generation!==workspaceGeneration)return;if(!response.ok)throw Error(result.error);if(!Array.isArray(result.cards)||!result.cards.length)throw Error('The lesson was empty. Please try again.');addCards(result.cards,'gemma');}catch(error){$('createError').textContent=error.name==='TimeoutError'?'The request timed out. Please try again.':error.message;}finally{button.disabled=false;button.textContent='✦ Generate with Gemma';}};
$('folderLabel').onclick=()=>{if(!classroomAccount?.user())return;activeFolder='';readingIndex=0;showLibrary();};
$('openCreate').onclick=()=>{if(isTeacher()&&!activeFolder){$('newFolder').click();return;}if(isTeacher()&&!state.folders.length)return toast('Add a ring first using + beside My Rings.');$('createError').textContent='';updateContentForm();$('createDialog').showModal();};$('grade').onchange=updateContentForm;$('closeCreate').onclick=()=>$('createDialog').close();$('sample').onclick=sampleLesson;
$('newFolder').onclick=()=>{if(classroomAccount?.isStudent())return;const name=prompt(isTeacher()?'Name your new ring':'Name your new folder');if(!name?.trim())return;const value=name.trim().slice(0,50);if(state.folders.includes(value))return toast(isTeacher()?'That ring already exists.':'That folder already exists.');state.folders.push(value);activeFolder=value;save();readingIndex=0;showReading();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('selected',x===b));render();});
$('practiceNav').onclick=beginPractice;$('libraryNav').onclick=showLibrary;$('back').onclick=showLibrary;
showReading();fetch('/api/status').then(r=>r.json()).then(s=>{gemmaConnected=s.gemma;naturalSpeech=!!s.naturalSpeech;imageGeneration=!!s.imageGeneration;imageLabel=s.imageLabel||'AI illustration';refreshVoices();updateImageControls();$('connection').textContent=s.gemma?'✦ Gemma connected':'◌ Sample mode · Gemma not connected';if(!s.gemma)$('generate').textContent='Add my words';}).catch(()=>{$('connection').textContent='◌ Offline · Sample mode';$('generate').textContent='Add my words';});

function setTab(name) {
 closeRingMenu();activityPlayer?.cancel();
 if(isTeacher()&&['reading','practice'].includes(name))name='classroom';
 if(classroomAccount?.isStudent()&&name==='practice')name='library';
 reader.cancel();
 activeTab=name;
 for (const tab of ['reading','library','practice','settings','classroom','requests']) {
  $(tab).hidden=tab!==name;
  $(tab+'Nav').classList.toggle('active',tab===name||(classroomAccount?.isStudent()&&tab==='library'&&name==='reading'));
  $(tab+'Nav').setAttribute('aria-current',tab===name?'page':'false');
 }
 document.body.dataset.tab=name;
 stopSpeech();
}
function showReading(){if(isTeacher()){showLibrary();return;}readingFlipped=false;setTab('reading');render();renderReading();}
function renderReading(){
 const cards=currentCards();readingIndex=Math.max(0,Math.min(readingIndex,cards.length-1));
 const card=cards[readingIndex];
 const advanced=isAdvancedCurrent();$('readingTitle').textContent=advanced?'Let’s practice.':'Let’s read.';$('readingIntro').textContent=advanced?'Spell the picture word, then read and answer.':'Look at the word. Try reading it aloud.';document.body.dataset.activityMode=advanced?'advanced':'reading';$('advancedActivities').hidden=!advanced;
 $('readingFolder').textContent=activeFolder||'All words';
 $('readingEmpty').hidden=!!card;
 $('readingCard').hidden=!card;
 $('flipCard').disabled=!card;
 $('readAloud').disabled=!card;$('readSentence').hidden=!card?.sentence;
 $('previousWord').disabled=!card||readingIndex===0;
 $('nextWord').disabled=!card||readingIndex===cards.length-1;
 $('readingPosition').textContent=card?`${readingIndex+1} / ${cards.length}`:'0 / 0';
 $('readingProgress').max=cards.length||1;$('readingProgress').value=card?readingIndex+1:0;
 updateImageControls();
 if(!card){reader.sync();return;}
 if(advanced){const complete=!!classroomAccount.progress()[card.id]?.correct;$('nextWord').disabled=!complete||readingIndex===cards.length-1;activityPlayer?.show(card,complete);return;}
 renderLetters(card);
 $('readingWord').hidden=false;
 $('flipCard').disabled=false;
 $('readingSupport').hidden=!readingFlipped;
 $('readingSupport').replaceChildren();
 if(readingFlipped){
  if(cardImageURL(card)){const img=document.createElement('img');img.className='reading-illustration';img.src=cardImageURL(card);img.alt=card.word+' illustration';img.onerror=()=>markMissingPicture(card,img);$('readingSupport').append(img);}
  else if(card.emoji){const picture=document.createElement('span');picture.className='reading-picture';picture.textContent=card.emoji;picture.setAttribute('aria-label',card.word+' illustration');$('readingSupport').append(picture);}
  const sentence=document.createElement('span');sentence.textContent=card.sentence||'Listen to the word, then try reading it again.';$('readingSupport').append(sentence);
 }
 $('cardCue').textContent=reader.lettersAllowed()?'SOUND IT OUT, THEN TRY AGAIN.':'READ THIS WORD ALOUD.';
 $('flipCard').textContent=readingFlipped?'Hide picture clue ↻':'Show picture clue ↻';
 $('flipCard').setAttribute('aria-expanded',String(readingFlipped));
 reader.sync();
}
function moveWord(direction){activityPlayer?.cancel();reader.cancel();readingIndex+=direction;readingFlipped=false;stopSpeech();updateVoiceStatus();renderReading();}
$('readingNav').onclick=showReading;
$('readingManage').onclick=()=>classroomAccount?.isStudent()?showStudentHome():showLibrary();
$('requestsNav').onclick=()=>{setTab('requests');requestDesk?.refresh();};
$('classroomNav').onclick=()=>{setTab('classroom');classroomAccount?.refresh();};
$('settingsNav').onclick=()=>{setTab('settings');updateVoiceStatus();updateImageControls();};
$('managePictures').onclick=showLibrary;
$('previewVoice').onclick=()=>speak('Let’s read together. One word at a time.');
$('flipCard').onclick=()=>{if(!reader.help().picture)return;stopSpeech();readingFlipped=!readingFlipped;renderReading();};
$('readAloud').onclick=()=>{if(!reader.help().audio)return;const card=currentCards()[readingIndex];if(card)speak(card.word);};
$('previousWord').onclick=()=>moveWord(-1);$('nextWord').onclick=()=>moveWord(1);
$('back').onclick=showReading;
window.addEventListener('keydown',event=>{
 if(activeTab!=='reading'||$('activityEditor').open||$('accountDialog').open||$('createDialog').open||$('imageReviewDialog').open||/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
 if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const button=$(event.key==='ArrowLeft'?'previousWord':'nextWord');if(!button.disabled)button.click();}
 if(event.code==='Space'&&currentCards().length){event.preventDefault();$('flipCard').click();}
});

$('readSentence').onclick=()=>{if(!reader.help().audio)return;const card=currentCards()[readingIndex];if(card?.sentence)speak(card.sentence);};

function updateImageControls(){
 const waiting=state.cards.filter(c=>c.pendingImageUrl).length;
 $('imageStatus').textContent=(imageGeneration?`${imageLabel} connected`:`${imageLabel} is not configured`)+(waiting?` · ${waiting} picture${waiting===1?'':'s'} waiting for review`:'');
}

function markMissingPicture(card,img){
 if(!card.imageUrl||brokenImages.has(card.imageUrl))return;
 brokenImages.add(card.imageUrl);img.hidden=true;
 render();if(activeTab==='reading')renderReading();
}
async function createCardPicture(card,{regenerate=false}={}){
 if(classroomAccount?.isStudent()||imageJobs.has(card.id))return;
 if(!regenerate&&(card.pendingImageUrl||cardImageURL(card)))return openImageReview(card);
 if(!imageGeneration)return toast('Configure the image provider in .env and restart WordRing to create pictures.');
 const generation=workspaceGeneration;const controller=new AbortController();imageJobs.set(card.id,controller);$('regeneratePicture').disabled=true;
 render();if(activeTab==='reading')updateImageControls();
 const timeout=setTimeout(()=>controller.abort(),100000);
 try{
  const response=await fetch('/api/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:card.word,imagePrompt:card.imagePrompt||'',...(regenerate?{variation:crypto.randomUUID()}:{})}),signal:controller.signal});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Could not create a picture.');
  if(!/^\/generated\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(result.imageUrl))throw Error('An invalid picture was returned.');
  if(!controller.signal.aborted&&generation===workspaceGeneration&&state.cards.some(c=>c.id===card.id)){WordRingImages.stage(card,result);brokenImages.delete(result.imageUrl);save();toast('Your picture is ready for review.');if(activeTab==='library')openImageReview(card);}
 }catch(error){if(controller.signal.reason==='emoji')return;toast(error.name==='TimeoutError'||error.name==='AbortError'?'Picture generation took too long. Try again shortly.':error.message);}
 finally{clearTimeout(timeout);imageJobs.delete(card.id);if(reviewingCardId===card.id)$('regeneratePicture').disabled=false;render();if(activeTab==='reading')renderReading();}
}


function refreshAfterReview(){render();updateImageControls();if(activeTab==='reading')renderReading();}
function openImageReview(card){
 if(classroomAccount?.isStudent())return;
 reviewingCardId=card.id;reviewLoaded=false;$('approvePicture').disabled=true;$('reviewError').textContent='';
 $('reviewTitle').textContent=`Picture for “${card.word}”`;
 $('reviewDescription').textContent='Check that this picture clearly shows the word before adding it to the reading card.';
 const expected=WordRingImages.validURL(card.pendingImageUrl)?card.pendingImageUrl:cardImageURL(card);
 $('regeneratePicture').disabled=imageJobs.has(card.id);$('regeneratePicture').textContent=expected?'Generate another picture':'Generate AI picture';
 $('approvePicture').hidden=!card.pendingImageUrl;$('discardPicture').hidden=!card.pendingImageUrl;
 $('pictureEmoji').value=card.emoji||'';
 const image=$('reviewPicture');image.hidden=!expected;image.alt=`Proposed illustration for ${card.word}`;
 image.onload=()=>{if(reviewingCardId===card.id&&card.pendingImageUrl===expected){reviewLoaded=true;$('approvePicture').disabled=false;}};
 image.onerror=()=>{reviewLoaded=false;$('approvePicture').disabled=true;$('reviewError').textContent='This picture could not load. Generate another picture or choose an emoji below.';};
 if(expected)image.src=expected;else image.removeAttribute('src');
 if(!$('imageReviewDialog').open)$('imageReviewDialog').showModal();
}
$('closeReview').onclick=()=>$('imageReviewDialog').close();
$('imageReviewDialog').addEventListener('close',()=>{reviewingCardId=null;reviewLoaded=false;});
$('approvePicture').onclick=()=>{
 const card=state.cards.find(c=>c.id===reviewingCardId);if(!card||!reviewLoaded)return;
 WordRingImages.approve(card);save();$('imageReviewDialog').close();refreshAfterReview();toast('Picture approved for reading.');
};
$('discardPicture').onclick=()=>{
 const card=state.cards.find(c=>c.id===reviewingCardId);if(card){WordRingImages.discard(card);save();}
 $('imageReviewDialog').close();refreshAfterReview();toast('The AI picture was not added to the reading card.');
};

$('regeneratePicture').onclick=()=>{
 const card=state.cards.find(c=>c.id===reviewingCardId);if(card)createCardPicture(card,{regenerate:true});
};
for(const emoji of ['🐈','🐕','☀️','🎩','🐷','🛏️','🦊','🌳','🌷','⚽','🚀','📚']){
 const button=document.createElement('button');button.type='button';button.textContent=emoji;button.setAttribute('aria-label','Choose '+emoji);
 button.onclick=()=>{$('pictureEmoji').value=emoji;};$('emojiChoices').append(button);
}
$('usePictureEmoji').onclick=async()=>{
 const card=state.cards.find(c=>c.id===reviewingCardId);if(!card||!isTeacher())return;
 const before={...card},generation=workspaceGeneration;const button=$('usePictureEmoji');button.disabled=true;
 try{
  WordRingImages.useEmoji(card,$('pictureEmoji').value);imageJobs.get(card.id)?.abort('emoji');
  await save();if(generation!==workspaceGeneration)return;
  $('imageReviewDialog').close();refreshAfterReview();toast('Emoji saved as the picture clue.');
 }catch(error){if(generation===workspaceGeneration){for(const key of Object.keys(card))delete card[key];Object.assign(card,before);$('reviewError').textContent=error.message;}}
 finally{button.disabled=false;}
};

function renderLetters(card){
 const word=$('readingWord');word.replaceChildren();
 word.classList.toggle('long-word',card.word.length>5);word.style.setProperty('--letter-count',Math.max(1,card.word.length));
 word.setAttribute('aria-label',`Letters in ${card.word}`);
 const known=!!WordRingPhonics.segments(card.word);
 if(!reader.lettersAllowed()){
  $('letterFeedback').textContent='';
  for(const letter of card.word){const span=document.createElement('span');span.className='letter-plain';span.textContent=letter;word.append(span);}
  return;
 }
 $('letterFeedback').textContent=known?'Tap a letter to hear its sound.':'Tap letters to hear their names. Use Hear the word for pronunciation.';
 for(const part of WordRingPhonics.letters(card.word)){
  if(!/[a-z]/i.test(part.letter)){const span=document.createElement('span');span.textContent=part.letter;word.append(span);continue;}
  const button=document.createElement('button');button.type='button';button.className='letter-button';button.textContent=part.letter;button.dataset.group=part.group;
  const shared=part.letters.length>1;
  button.setAttribute('aria-label',part.sound?`Hear ${part.letters}${shared?' together':''} sound, letter ${part.letter}`:`Hear letter ${part.letter} name`);
  if(shared)button.classList.add('shared-sound');
  button.onclick=()=>{
   if(part.sound==='silent'){stopSpeech();$('letterFeedback').textContent=`The ${part.letters} is silent in ${card.word}.`;return;}
   const buttons=[...word.querySelectorAll('.letter-button')].filter(el=>el.dataset.group===String(part.group));
   $('letterFeedback').textContent=WordRingPhonics.hint(part,card.word);
   speak(part.letter,{sound:part.sound,buttons});
  };
  word.append(button);
 }
}


function showStudentHome(){activeFolder='';showLibrary();}

function guestLibrary(){
 try{const saved=JSON.parse(localStorage.getItem('wordring-v1'));if(saved&&Array.isArray(saved.cards)&&Array.isArray(saved.folders))return saved;}catch{}
 return {cards:samples.map(card=>({...card,id:crypto.randomUUID()})),folders:['Nature explorers','My favorite words']};
}
function replaceWorkspace(library,progress){
 closeRingMenu();$('activityEditor').close();$('deleteRingDialog').close();activityPlayer?.reset();workspaceGeneration++;reader.cancel();stopSpeech();for(const job of imageJobs.values())job.abort();imageJobs.clear();
 $('createDialog').close();$('imageReviewDialog').close();
 state=library;activeFolder='';readingIndex=0;readingFlipped=false;
 reader.reset(progress);render();renderReading();updateImageControls();
}
classroomAccount=WordRingClassroom.start({getLibrary:()=>state,replaceWorkspace,getGuestLibrary:guestLibrary,
 showReading,showLibrary,showClassroom:()=>setTab('classroom'),toast});
activityPlayer=WordRingActivities.create({getUser:()=>classroomAccount?.user(),stopSpeech,speak,onResult:(card,result)=>classroomAccount.result(card,result),render:renderReading});
requestDesk=WordRingRequests.create({account:()=>classroomAccount?.user(),getLibrary:()=>state,createRing:createRequestedRing,openRing:name=>{activeFolder=name;showLibrary();},toast});
window.addEventListener('beforeunload',event=>{if(document.body.dataset.saving==='true'){event.preventDefault();event.returnValue='';}});


function closeRingMenu(restoreFocus=false){
 const target=ringMenuTarget;ringMenuTarget=null;$('ringContextMenu').hidden=true;
 if(restoreFocus&&target?.button.isConnected)target.button.focus();
}
function openRingMenu(name,button,x,y){
 if(!isTeacher()||!state.folders.includes(name))return;
 ringMenuTarget={name,button};const menu=$('ringContextMenu');menu.hidden=false;
 menu.style.left='0px';menu.style.top='0px';const size=menu.getBoundingClientRect();
 menu.style.left=Math.max(8,Math.min(x,window.innerWidth-size.width-8))+'px';
 menu.style.top=Math.max(8,Math.min(y,window.innerHeight-size.height-8))+'px';
 $('deleteRingMenuItem').focus();
}
$('deleteRingMenuItem').onclick=()=>{
 const target=ringMenuTarget;closeRingMenu();if(!target||!isTeacher())return;
 ringDeleteTarget={name:target.name,userId:classroomAccount.user().id};
 const count=state.cards.filter(card=>card.folder===target.name).length;
 $('deleteRingDescription').textContent=`Delete “${target.name}” and its ${count} card${count===1?'':'s'} from your rings?`;
 $('deleteRingError').textContent='';$('deleteRingDialog').showModal();$('cancelDeleteRing').focus();
};
$('cancelDeleteRing').onclick=()=>$('deleteRingDialog').close();
$('deleteRingDialog').addEventListener('cancel',event=>{if(ringDeleteBusy)event.preventDefault();});
$('deleteRingDialog').addEventListener('close',()=>{ringDeleteTarget=null;});
$('confirmDeleteRing').onclick=async()=>{
 const target=ringDeleteTarget;
 if(ringDeleteBusy||!target||!isTeacher()||classroomAccount.user().id!==target.userId)return;
 ringDeleteBusy=true;$('confirmDeleteRing').disabled=true;$('cancelDeleteRing').disabled=true;
 $('deleteRingError').textContent='';
 workspaceGeneration++;stopSpeech();
 for(const job of imageJobs.values())job.abort();
 const next={...state,folders:state.folders.filter(folder=>folder!==target.name),cards:state.cards.filter(card=>card.folder!==target.name)};
 try{
  await classroomAccount.persist(next);
  if(!isTeacher()||classroomAccount.user().id!==target.userId)return;
  state=next;if(activeFolder===target.name)activeFolder='';readingIndex=0;
  $('deleteRingDialog').close();render();await classroomAccount.refresh();toast(`Deleted “${target.name}”.`);
 }catch(error){$('deleteRingError').textContent='The ring could not be deleted. '+error.message;}
 finally{ringDeleteBusy=false;$('confirmDeleteRing').disabled=false;$('cancelDeleteRing').disabled=false;}
};
document.addEventListener('click',event=>{if(!$('ringContextMenu').contains(event.target))closeRingMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('ringContextMenu').hidden){event.preventDefault();closeRingMenu(true);}});
window.addEventListener('scroll',()=>closeRingMenu(),true);
window.addEventListener('resize',()=>closeRingMenu());

function enableRingMenu(button,name){
 button.setAttribute('aria-haspopup','menu');
 button.oncontextmenu=event=>{event.preventDefault();openRingMenu(name,button,event.clientX,event.clientY);};
 button.onkeydown=event=>{if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){event.preventDefault();const rect=button.getBoundingClientRect();openRingMenu(name,button,rect.left,rect.bottom);}};
}

async function createRequestedRing({topic,grade,count,manual,words,signal,onProgress}){
 if(!isTeacher())throw Error('A teacher account is required.');
 const owner=classroomAccount.user().id,generation=workspaceGeneration;
 const current=()=>{if(signal.aborted||!isTeacher()||classroomAccount.user().id!==owner||generation!==workspaceGeneration)throw new DOMException('Account changed or operation cancelled.','AbortError');};
 const chosen=[...new Set(words.split(',').map(word=>word.trim()).filter(Boolean))];
 const requested=manual?chosen.length:count;
 if(!Number.isInteger(requested)||requested<1||requested>200)throw Error(manual?'Enter 1–200 comma-separated words.':'Choose 1–200 words.');
 if(state.cards.length+requested>200)throw Error(`Your local collection has room for ${Math.max(0,200-state.cards.length)} more words.`);
 if(state.folders.length>=40)throw Error('Your collection already has 40 rings.');
 if(manual&&chosen.some(word=>word.length>100))throw Error('Keep each word under 100 characters.');
 if(!manual&&!gemmaConnected)throw Error('Connect Gemma or choose Use my own words.');
 let cards=[];
 if(manual)cards=chosen.map(word=>({word,definition:'Teacher-selected word.',sentence:'',hint:'',imagePrompt:`A clear friendly illustration of ${word}, no text`,source:'manual'}));
 else{
  for(let offset=0;offset<requested;offset+=8){
   current();const batch=Math.min(8,requested-offset);onProgress(`Creating words ${offset+1}–${offset+batch} of ${requested}…`);
   const timeout=new AbortController();const abort=()=>timeout.abort();signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,65000);
   try{
    const response=await fetch('/api/lesson',{method:'POST',headers:{'Content-Type':'application/json','X-WordRing-User':owner},body:JSON.stringify({grade,topic,count:batch,words:'',exclude:cards.map(card=>card.word)}),signal:timeout.signal});
    const result=await response.json();current();if(!response.ok)throw Error(result.error||'Could not create the words.');
    if(!Array.isArray(result.cards)||result.cards.length!==batch)throw Error('Gemma returned an unexpected number of words. No ring was saved; try again.');
    const spellings=[...cards,...result.cards].map(card=>String(card.word).trim().toLowerCase());
    if(new Set(spellings).size!==spellings.length)throw Error('Gemma repeated a word. No ring was saved; try fewer words or use your own list.');
    cards.push(...result.cards.map(card=>({...card,source:'gemma'})));
   }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  }
 }
 current();
 const base=topic.trim().slice(0,42)||'Requested ring';let name=base,number=2;
 while(state.folders.includes(name))name=`${base} (${number++})`;
 const next={...state,folders:[...state.folders,name],cards:[...state.cards,...cards.map(card=>({...card,id:crypto.randomUUID(),folder:name,grade}))]};
 onProgress('Saving your ring…');await classroomAccount.persist(next);current();state=next;render();return name;
}

let activityEditorCard=null,activityEditorGeneration=0;
for(let number=1;number<=2;number++){
 const fieldset=document.createElement('fieldset');fieldset.className='activity-question-fields';fieldset.id='activityQuestion'+number;
 const legend=document.createElement('legend');legend.textContent='Question '+number;fieldset.append(legend);
 const field=(labelText,id,kind='input')=>{const label=document.createElement('label');label.htmlFor=id;label.textContent=labelText;const input=document.createElement(kind);input.id=id;fieldset.append(label,input);return input;};
 field('Question','activityQ'+number).maxLength=300;
 for(let choice=0;choice<3;choice++)field('Choice '+(choice+1),'activityQ'+number+'Choice'+choice).maxLength=100;
 const answer=field('Correct choice','activityQ'+number+'Answer','select');
 for(let choice=0;choice<3;choice++){const option=document.createElement('option');option.value=choice;option.textContent='Choice '+(choice+1);answer.append(option);}
 $('activityQuestionFields').append(fieldset);
}
$('useSecondQuestion').onchange=()=>{$('activityQuestion2').hidden=!$('useSecondQuestion').checked;};
function fillActivityEditor(content){
 $('activityPassage').value=content?.passage||'';
 for(let number=1;number<=2;number++){
  const question=content?.questions?.[number-1];$('activityQ'+number).value=question?.question||'';
  for(let choice=0;choice<3;choice++)$('activityQ'+number+'Choice'+choice).value=question?.choices?.[choice]||'';
  $('activityQ'+number+'Answer').value=question?.answer??0;
 }
 $('useSecondQuestion').checked=content?.questions?.length===2;$('useSecondQuestion').onchange();
}
function openActivityEditor(card){
 if(!isTeacher()||!WordRingLearning.advanced(card))return;
 activityEditorCard=card;activityEditorGeneration=workspaceGeneration;
 const upper=['4','5'].includes(String(card.grade));
 $('activityEditorGuidance').textContent=upper?`Grade ${card.grade}: use two paragraphs and two reasoning questions. ${String(card.grade)==='5'?'Compare explanations or evaluate a claim, then ask for supporting evidence.':'Ask for an inference, then the evidence that best supports it.'} Keep the passage within 1200 characters.`:'Grade 2–3: use a short passage with one or two reading questions. Add a picture clue for spelling.';
 $('activityPassage').rows=upper?8:4;
 $('activityEditorTitle').textContent=`Activities for “${card.word}”`;$('activityEditorError').textContent='';
 fillActivityEditor(card.comprehension||{passage:card.sentence||'',questions:[]});$('activityEditor').showModal();
}
$('closeActivityEditor').onclick=()=>$('activityEditor').close();
$('activityEditor').addEventListener('close',()=>{activityEditorCard=null;});
$('saveActivities').onclick=async()=>{
 const card=activityEditorCard;if(!card||!isTeacher()||activityEditorGeneration!==workspaceGeneration)return;
 $('activityEditorError').textContent='';
 try{
  const questions=Array.from({length:$('useSecondQuestion').checked?2:1},(_,i)=>{const number=i+1;return {question:$('activityQ'+number).value,choices:[0,1,2].map(choice=>$('activityQ'+number+'Choice'+choice).value),answer:Number($('activityQ'+number+'Answer').value)};});
  const content=WordRingLearning.content({passage:$('activityPassage').value,questions});
  card.comprehension=content;$('saveActivities').disabled=true;await save();
  if(activityEditorCard===card){$('activityEditor').close();render();toast('Activities saved. Approve the picture clue before assigning this Grade 2+ card.');}
 }catch(error){$('activityEditorError').textContent=error.message;}finally{$('saveActivities').disabled=false;}
};
$('generateActivities').onclick=async()=>{
 const card=activityEditorCard,generation=activityEditorGeneration;
 if(!card||!isTeacher())return;$('activityEditorError').textContent='';
 if(!gemmaConnected){$('activityEditorError').textContent='Gemma is not connected. Enter the passage and questions manually.';return;}
 $('generateActivities').disabled=true;$('saveActivities').disabled=true;
 try{
  const response=await fetch('/api/lesson',{method:'POST',headers:{'Content-Type':'application/json','X-WordRing-User':classroomAccount.user().id},body:JSON.stringify({grade:card.grade,topic:card.word,words:card.word,count:1}),signal:AbortSignal.timeout(65000)});
  const result=await response.json();if(activityEditorCard!==card||generation!==workspaceGeneration)return;
  if(!response.ok)throw Error(result.error||'Could not generate the activity.');
  const generated=result.cards?.[0];if(generated?.word?.trim().toLowerCase()!==card.word.trim().toLowerCase())throw Error('Gemma returned a different word. Please try again.');
  fillActivityEditor(WordRingLearning.content(generated.comprehension));$('activityEditorError').textContent='Review the passage and correct answers, then save activities.';
 }catch(error){if(activityEditorCard===card)$('activityEditorError').textContent=error.message;}
 finally{$('generateActivities').disabled=false;$('saveActivities').disabled=false;}
};
