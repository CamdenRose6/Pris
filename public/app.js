const $ = id => document.getElementById(id);
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
const escapeHTML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message) { $('toast').textContent=message; $('toast').classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').classList.remove('show'),3000); }
function save() { try { localStorage.setItem('wordring-v1',JSON.stringify(state)); } catch { toast('Storage is full. These changes may not survive a reload.'); } }
function currentCards() { return state.cards.filter(c=>!activeFolder || c.folder===activeFolder); }
function render() {
 $('folders').replaceChildren();
 [['','All words'],...state.folders.map(f=>[f,f])].forEach(([value,label])=>{const b=document.createElement('button'); b.className='folder'+(activeFolder===value?' selected':''); b.innerHTML=`▱ &nbsp; ${escapeHTML(label)} <b>${state.cards.filter(c=>!value||c.folder===value).length}</b>`;b.onclick=()=>{activeFolder=value;readingIndex=0;showReading();};$('folders').append(b);});
 $('folderSelect').replaceChildren(...state.folders.map(f=>{const o=document.createElement('option');o.value=f;o.textContent=f;return o;}));
 if(activeFolder) $('folderSelect').value=activeFolder;
 $('folderHeading').textContent=activeFolder||'My word garden';
 const cards=currentCards(); $('cardCount').textContent=`${cards.length} words to discover · A little more curious every day`;
 $('cards').innerHTML=cards.length?'':'<div class="empty">Your next discovery belongs here.<br>Create a word set to get started.</div>';
 cards.forEach((card,i)=>{
  const el=document.createElement('article');el.className='card';el.style.setProperty('--tint',['#f2e9d9','#e9eee0','#f7e7df','#e7efdf','#f9efd1','#eae6f1'][i%6]);
  el.innerHTML=`${view!=='word'?`<div class="picture" aria-label="${view==='picture'?'Vocabulary illustration':escapeHTML(card.word)+' illustration'}">${cardImageURL(card)?`<img class="card-illustration" src="${cardImageURL(card)}" alt="${view==='picture'?'Word picture clue':escapeHTML(card.word)+' illustration'}">`:`<span aria-hidden="true">${escapeHTML(card.emoji||'✦')}</span>`}<small>${cardImageURL(card)?escapeHTML(cardImageLabel(card)):card.emoji?'Emoji placeholder':'Image pending'}</small></div>`:''}<div class="card-body"><div class="word-line"><h3>${view==='picture'?'Mystery word':escapeHTML(card.word)}</h3><button class="speak" aria-label="Hear ${view==='picture'?'word':escapeHTML(card.word)}">◖))</button></div>${view!=='picture'?`<p class="definition">${escapeHTML(card.definition)}</p><div class="sentence">${escapeHTML(card.sentence)}</div>`:'<p class="definition">Look at the picture. Can you name it?<br>Tap the speaker for a clue.</p>'}<div class="card-bottom"><span>${card.source==='gemma'?'✦ Gemma lesson':card.source==='manual'?'Your word':'Sample lesson'}</span><button class="make-picture" ${imageJobs.has(card.id)?'disabled':''}>${imageJobs.has(card.id)?'Creating…':card.pendingImageUrl?'Review picture':cardImageURL(card)?'Picture approved':'Create picture'}</button><button class="delete" aria-label="Delete ${escapeHTML(card.word)}">Remove</button></div></div>`;
  el.querySelector('.make-picture').onclick=()=>card.pendingImageUrl?openImageReview(card):cardImageURL(card)?toast('This picture is already approved.'):createCardPicture(card);
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
 u.onend=()=>{if(request===speechRequest){$('readAloud').classList.remove('speaking');updateVoiceStatus();}};
 u.onerror=event=>{if(request===speechRequest&&event.error!=='interrupted'&&event.error!=='canceled'){updateVoiceStatus('Audio could not play. Try another reading voice.');$('readAloud').classList.remove('speaking');}};
 $('readAloud').classList.add('speaking');speechSynthesis.speak(u);
}
async function speak(text){
 stopSpeech();const request=speechRequest;
 if(!naturalSpeech||$('voiceSelect').value!=='auto'){speakOnDevice(text,request);return;}
 const controller=new AbortController();speechController=controller;$('readAloud').setAttribute('aria-busy','true');updateVoiceStatus('Getting your reading voice ready…');
 const timeout=setTimeout(()=>controller.abort(),35000);
 try{
  const response=await fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,slow:($('speechSpeed').value==='slow')}),signal:controller.signal});
  if(!response.ok)throw Error('Speech unavailable');
  const blob=await response.blob();if(request!==speechRequest)return;
  audioURL=URL.createObjectURL(blob);playingAudio=new Audio(audioURL);
  playingAudio.onended=()=>{if(request===speechRequest){stopSpeech();updateVoiceStatus();}};
  playingAudio.onerror=()=>{if(request===speechRequest){stopSpeech();updateVoiceStatus('Audio could not play. Please try again.');}};
  await playingAudio.play();if(request!==speechRequest)return;
  $('readAloud').classList.add('speaking');updateVoiceStatus('Reading…');
 }catch(error){if(request!==speechRequest)return;updateVoiceStatus('Natural voice unavailable. Using your device voice.');toast('Using your device voice for now.');speakOnDevice(text,request);}
 finally{clearTimeout(timeout);if(request===speechRequest){speechController=null;$('readAloud').removeAttribute('aria-busy');}}
}
$('voiceSelect').onchange=()=>{stopSpeech();voicePreference=$('voiceSelect').value;try{localStorage.setItem('wordring-voice',voicePreference);}catch{}updateVoiceStatus();};
$('speechSpeed').onchange=()=>{stopSpeech();try{localStorage.setItem('wordring-slow',String(($('speechSpeed').value==='slow')));}catch{}updateVoiceStatus();};
if('speechSynthesis' in window)speechSynthesis.addEventListener('voiceschanged',refreshVoices);
refreshVoices();

function showLibrary(){ setTab('library'); $('library').hidden=false;$('practice').hidden=true;$('libraryNav').classList.add('active');$('practiceNav').classList.remove('active');render(); }
function beginPractice(){queue=[...currentCards()].filter(c=>c.quiz).sort(()=>Math.random()-.5).slice(0,5);if(!queue.length)return toast('Create some cards before practicing.');setTab('practice');questionIndex=0;score=0;$('library').hidden=true;$('practice').hidden=false;$('libraryNav').classList.remove('active');$('practiceNav').classList.add('active');renderQuestion();$('practice').scrollIntoView({behavior:'smooth'});}
function renderQuestion(){
 if(questionIndex===queue.length){$('quiz').innerHTML=`<div style="font-size:58px">🌻</div><p class="eyebrow">LOOK AT YOU GROW!</p><h3>You practiced ${queue.length} words.</h3><p>${score} correct on the first try. Every retry is another chance to learn.</p><button class="primary" id="again">Practice again</button>`;$('again').onclick=beginPractice;return;}
 const card=queue[questionIndex];solved=false;firstTry=true;
 $('quiz').innerHTML=`<div class="quiz-progress">WORD ${questionIndex+1} OF ${queue.length} · ${card.source==='gemma'?'Created by Gemma':'Sample practice'}</div><h3>${escapeHTML(card.quiz.question)}</h3><div id="choices"></div><p id="feedback" role="status"></p><div class="hint" id="hintText" hidden>${escapeHTML(card.hint)}</div><div class="quiz-actions"><button class="secondary" id="hint">Give me a hint</button><button class="primary" id="next" hidden>Next word →</button></div>`;
 card.quiz.choices.forEach((choice,i)=>{const b=document.createElement('button');b.className='choice';b.textContent=choice;b.onclick=()=>{if(solved)return;if(i===card.quiz.answer){solved=true;if(firstTry)score++;b.classList.add('correct');$('feedback').textContent='You got it! '+card.sentence;$('next').hidden=false;document.querySelectorAll('.choice').forEach(c=>c.disabled=true);}else{firstTry=false;b.classList.add('wrong');b.disabled=true;$('feedback').textContent='Give it another try. Here’s a clue.';$('hintText').hidden=false;}};$('choices').append(b);});
 $('hint').onclick=()=>{$('hintText').hidden=false;};$('next').onclick=()=>{questionIndex++;renderQuestion();};
}
function addCards(cards, source){const folder=$('folderSelect').value;const grade=$('grade').value;state.cards.push(...cards.map(c=>({...c,id:crypto.randomUUID(),folder,grade,source})));activeFolder=folder;save();$('createDialog').close();readingIndex=Math.max(0,currentCards().length-cards.length);showReading();toast(`${cards.length} words added to ${folder}`);}
function sampleLesson(){addCards(samples.slice(0,5),'sample');}
function manualCards(){const words=[...new Set($('words').value.split(',').map(s=>s.trim()).filter(Boolean))].slice(0,8);return words.map(word=>({word,definition:'Your own word. Connect Gemma to add a definition and practice question.',sentence:'',hint:'',imagePrompt:`An illustration of ${word}`}));}
let gemmaConnected=false;
$('createForm').onsubmit=async event=>{event.preventDefault();$('createError').textContent='';if(!gemmaConnected){const cards=manualCards();if(cards.length){addCards(cards,'manual');return;}$('createError').textContent='Gemma is not connected yet. Enter your own words or try the sample lesson.';return;}const button=$('generate');button.disabled=true;button.textContent='Growing your lesson…';try{const response=await fetch('/api/lesson',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grade:$('grade').value,topic:$('topic').value,words:$('words').value}),signal:AbortSignal.timeout(65000)});const result=await response.json();if(!response.ok)throw Error(result.error);if(!Array.isArray(result.cards)||!result.cards.length)throw Error('The lesson was empty. Please try again.');addCards(result.cards,'gemma');}catch(error){$('createError').textContent=error.name==='TimeoutError'?'The request timed out. Please try again.':error.message;}finally{button.disabled=false;button.textContent='✦ Generate with Gemma';}};
$('openCreate').onclick=()=>{$('createError').textContent='';$('createDialog').showModal();};$('closeCreate').onclick=()=>$('createDialog').close();$('sample').onclick=sampleLesson;
$('newFolder').onclick=()=>{const name=prompt('Name your new folder');if(!name?.trim())return;const value=name.trim().slice(0,50);if(state.folders.includes(value))return toast('That folder already exists.');state.folders.push(value);activeFolder=value;save();readingIndex=0;showReading();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('selected',x===b));render();});
$('practiceNav').onclick=beginPractice;$('libraryNav').onclick=showLibrary;$('back').onclick=showLibrary;
showReading();fetch('/api/status').then(r=>r.json()).then(s=>{gemmaConnected=s.gemma;naturalSpeech=!!s.naturalSpeech;imageGeneration=!!s.imageGeneration;imageLabel=s.imageLabel||'AI illustration';refreshVoices();updateImageControls();$('connection').textContent=s.gemma?'✦ Gemma connected':'◌ Sample mode · Gemma not connected';if(!s.gemma)$('generate').textContent='Add my words';}).catch(()=>{$('connection').textContent='◌ Offline · Sample mode';$('generate').textContent='Add my words';});

function setTab(name) {
 activeTab=name;
 for (const tab of ['reading','library','practice','settings']) {
  $(tab).hidden=tab!==name;
  $(tab+'Nav').classList.toggle('active',tab===name);
  $(tab+'Nav').setAttribute('aria-current',tab===name?'page':'false');
 }
 document.body.dataset.tab=name;
 stopSpeech();
}
function showReading(){readingFlipped=false;setTab('reading');render();renderReading();}
function renderReading(){
 const cards=currentCards();readingIndex=Math.max(0,Math.min(readingIndex,cards.length-1));
 const card=cards[readingIndex];
 $('readingFolder').textContent=activeFolder||'All words';
 $('readingEmpty').hidden=!!card;
 $('readingCard').hidden=!card;
 $('readAloud').disabled=!card;$('readSentence').hidden=!card?.sentence;
 $('previousWord').disabled=!card||readingIndex===0;
 $('nextWord').disabled=!card||readingIndex===cards.length-1;
 $('readingPosition').textContent=card?`${readingIndex+1} / ${cards.length}`:'0 / 0';
 $('readingProgress').max=cards.length||1;$('readingProgress').value=card?readingIndex+1:0;
 updateImageControls();
 if(!card)return;
 $('readingWord').textContent=card.word;
 $('readingWord').hidden=readingFlipped;
 $('readingSupport').hidden=!readingFlipped;
 $('readingSupport').replaceChildren();
 if(readingFlipped){
  if(cardImageURL(card)){const img=document.createElement('img');img.className='reading-illustration';img.src=cardImageURL(card);img.alt=card.word+' illustration';img.onerror=()=>markMissingPicture(card,img);$('readingSupport').append(img);}
  else if(card.emoji){const picture=document.createElement('span');picture.className='reading-picture';picture.textContent=card.emoji;picture.setAttribute('aria-label',card.word+' illustration');$('readingSupport').append(picture);}
  const word=document.createElement('strong');word.textContent=card.word;$('readingSupport').append(word);
  const sentence=document.createElement('span');sentence.textContent=card.sentence||'Listen to the word, then try reading it again.';$('readingSupport').append(sentence);
 }
 $('cardCue').textContent=readingFlipped?'LOOK, LISTEN, AND TRY AGAIN':'TRY READING THIS WORD';
 $('flipCue').textContent=readingFlipped?'Tap to return to the word ↻':'Tap to see a clue ↻';
 $('readingCard').setAttribute('aria-label',readingFlipped?'Show word side':'Show a clue for '+card.word);
}
function moveWord(direction){readingIndex+=direction;readingFlipped=false;stopSpeech();updateVoiceStatus();renderReading();}
$('readingNav').onclick=showReading;
$('readingManage').onclick=showLibrary;
$('settingsNav').onclick=()=>{setTab('settings');updateVoiceStatus();updateImageControls();};
$('managePictures').onclick=showLibrary;
$('previewVoice').onclick=()=>speak('Let’s read together. One word at a time.');
$('readingCard').onclick=()=>{readingFlipped=!readingFlipped;renderReading();};
$('readAloud').onclick=()=>{const card=currentCards()[readingIndex];if(card)speak(card.word);};
$('previousWord').onclick=()=>moveWord(-1);$('nextWord').onclick=()=>moveWord(1);
$('back').onclick=showReading;
window.addEventListener('keydown',event=>{
 if(activeTab!=='reading'||$('createDialog').open||$('imageReviewDialog').open||/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
 if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();moveWord(event.key==='ArrowLeft'?-1:1);}
 if(event.code==='Space'&&currentCards().length){event.preventDefault();$('readingCard').click();}
});

$('readSentence').onclick=()=>{const card=currentCards()[readingIndex];if(card?.sentence)speak(card.sentence);};

function updateImageControls(){
 const waiting=state.cards.filter(c=>c.pendingImageUrl).length;
 $('imageStatus').textContent=(imageGeneration?`${imageLabel} connected`:`${imageLabel} is not configured`)+(waiting?` · ${waiting} picture${waiting===1?'':'s'} waiting for review`:'');
}

function markMissingPicture(card,img){
 if(!card.imageUrl||brokenImages.has(card.imageUrl))return;
 brokenImages.add(card.imageUrl);img.hidden=true;
 render();if(activeTab==='reading')renderReading();
}
async function createCardPicture(card){
 if(imageJobs.has(card.id)||cardImageURL(card))return;
 if(card.pendingImageUrl)return openImageReview(card);
 if(!imageGeneration)return toast('Configure the image provider in .env and restart WordRing to create pictures.');
 const controller=new AbortController();imageJobs.set(card.id,controller);
 render();if(activeTab==='reading')updateImageControls();
 const timeout=setTimeout(()=>controller.abort(),100000);
 try{
  const response=await fetch('/api/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:card.word,imagePrompt:card.imagePrompt||''}),signal:controller.signal});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Could not create a picture.');
  if(!/^\/generated\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(result.imageUrl))throw Error('An invalid picture was returned.');
  if(state.cards.some(c=>c.id===card.id)){WordRingImages.stage(card,result);brokenImages.delete(result.imageUrl);save();toast('Your picture is ready for review.');if(activeTab==='library')openImageReview(card);}
 }catch(error){toast(error.name==='TimeoutError'||error.name==='AbortError'?'Picture generation took too long. Try again shortly.':error.message);}
 finally{clearTimeout(timeout);imageJobs.delete(card.id);render();if(activeTab==='reading')renderReading();}
}


function refreshAfterReview(){render();updateImageControls();if(activeTab==='reading')renderReading();}
function openImageReview(card){
 if(!WordRingImages.validURL(card.pendingImageUrl))return;
 reviewingCardId=card.id;reviewLoaded=false;$('approvePicture').disabled=true;$('reviewError').textContent='';
 $('reviewTitle').textContent=`Picture for “${card.word}”`;
 $('reviewDescription').textContent='Check that this picture clearly shows the word before adding it to the reading card.';
 const image=$('reviewPicture');image.alt=`Proposed illustration for ${card.word}`;
 const expected=card.pendingImageUrl;
 image.onload=()=>{if(reviewingCardId===card.id&&card.pendingImageUrl===expected){reviewLoaded=true;$('approvePicture').disabled=false;}};
 image.onerror=()=>{reviewLoaded=false;$('approvePicture').disabled=true;$('reviewError').textContent='This picture could not load. Choose Keep word only, then create it again.';};
 image.src=expected;
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
