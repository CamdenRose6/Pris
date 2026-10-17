/* Short, explicit recordings. No audio/transcripts are stored in localStorage. */
window.WordRingRecorder = {create({getCard,stopSpeech,render,skip,onResult=()=>{},getUserId=()=>null,isActive=()=>true,hasPicture=card=>!!card?.emoji||card?.imageApproved===true}) {
  const $=id=>document.getElementById(id), progress=new Map();
  let session=null, epoch=0, checking=false, requesting=false;
  function state(){const card=getCard();if(!card)return WordRingReading.fresh();if(!progress.has(card.id))progress.set(card.id,WordRingReading.fresh());return progress.get(card.id);}
  function help(){return WordRingReading.help(state());}
  function message(text){state().feedback=text;$('attemptFeedback').textContent=text;}
  function cleanup(run){
    if(!run)return;
    clearTimeout(run.timer);clearInterval(run.meter);
    run.stream?.getTracks().forEach(track=>track.stop());
    if(run.context)run.context.close().catch(()=>{});
  }
  function cancel(){
    const wasBusy=requesting||checking||!!session;
    if(wasBusy)state().feedback='Try reading this word aloud.';
    $('heardWord').hidden=true;$('heardWord').textContent='';
    epoch++;requesting=false;checking=false;
    const old=session;session=null;
    if(old){old.cancelled=true;old.controller?.abort();if(old.recorder?.state==='recording')old.recorder.stop();cleanup(old);}
    sync();
  }
  function sync(){
    if(!isActive())return;
    const card=getCard(), current=state(), unlocked=help(), busy=requesting||checking||!!session;
    $('recordWord').disabled=!card||checking||requesting||current.correct;
    $('recordWord').textContent=requesting?'Opening microphone…':checking?'Checking your word…':session?'■ Done speaking':current.correct?'✓ Word read!':'🎙 Read it aloud';
    $('recordWord').setAttribute('aria-pressed',String(!!session&&!checking));
    $('cancelRecording').hidden=!busy;
    $('attemptFeedback').textContent=current.feedback;
    $('attemptFeedback').classList.toggle('correct',current.correct);
    $('flipCard').hidden=!card||!unlocked.picture;
    $('flipCard').disabled=!card||!hasPicture(card);
    if(card&&unlocked.picture&&!hasPicture(card))$('flipCard').textContent='Picture clue not ready';
    $('readAloud').hidden=!card||!unlocked.audio;
    $('readSentence').hidden=!card||!unlocked.audio||!card.sentence;
    $('nextWord').disabled=!card||!current.correct||$('nextWord').disabled;
    $('skipWord').hidden=!card||current.correct;
    $('recordWord').classList.toggle('recording',!!session&&!checking);
  }
  async function finish(run){
    cleanup(run);
    if(run.cancelled||epoch!==run.epoch||getCard()?.id!==run.card.id)return;
    if(run.error){session=null;message('The recording stopped unexpectedly. Please try again.');sync();return;}
    const blob=new Blob(run.chunks,{type:run.recorder.mimeType||'audio/webm'});run.chunks=[];
    if(blob.size<100||performance.now()-run.started<350||(run.meterAvailable&&!run.voiced)){
      session=null;message('I couldn’t hear you clearly. Try again—this attempt won’t count.');sync();return;
    }
    checking=true;message('Listening to what you said…');sync();
    run.controller=new AbortController();const timeout=setTimeout(()=>run.controller.abort(),50000);
    try{
      const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
      if(run.cancelled||epoch!==run.epoch)return;
      const response=await fetch('/api/reading-check',{method:'POST',headers:{'Content-Type':'application/json',...(getUserId()?{'X-WordRing-User':getUserId()}:{})},body:JSON.stringify({word:run.card.word,cardId:run.card.id,audio:encoded,mime:blob.type}),signal:run.controller.signal});
      const result=await response.json();
      if(run.cancelled||epoch!==run.epoch||getCard()?.id!==run.card.id)return;
      if(!response.ok)throw Error(result.error||'Couldn’t check your recording. Please try again.');
      if(!['correct','retry','unclear'].includes(result.outcome))throw Error('The result was unclear. Try again.');
      const updated=WordRingReading.apply(state(),result);if(result.progress){updated.misses=result.progress.misses;updated.correct=result.progress.correct;}progress.set(run.card.id,updated);onResult(run.card,result);
      if(result.outcome==='retry')updated.feedback+=updated.misses===1?(hasPicture(run.card)?' You can use the picture clue.':' No picture clue is ready yet. Try reading it again.'):' You can listen to the word or tap its letters.';
      $('heardWord').hidden=!result.transcript;$('heardWord').textContent=result.transcript?`I heard: “${result.transcript}”`:'';
    }catch(error){if(!run.cancelled&&epoch===run.epoch)message(error.name==='AbortError'?'Checking took too long. Try again—this attempt won’t count.':error.message);}
    finally{clearTimeout(timeout);if(epoch===run.epoch){session=null;checking=false;render();}}
  }
  async function start(){
    if(!isActive())return;
    if(checking||requesting)return;
    if(session){if(session.recorder.state==='recording')session.recorder.stop();return;}
    const card=getCard();if(!card||state().correct)return;
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){message('Recording isn’t supported here. Open WordRing in a recent Chrome, Edge, or Safari browser.');return;}
    stopSpeech();requesting=true;const requestEpoch=++epoch;sync();
    let stream;
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(epoch!==requestEpoch){stream.getTracks().forEach(track=>track.stop());return;}
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
      const run={card,epoch:requestEpoch,stream,chunks:[],started:performance.now(),voiced:false,meterAvailable:false};
      session=run;requesting=false;
      run.recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});
      run.recorder.ondataavailable=event=>{if(event.data.size)run.chunks.push(event.data);};
      run.recorder.onerror=()=>{run.error=true;cleanup(run);if(run.recorder.state==='recording')run.recorder.stop();else finish(run);};
      run.recorder.onstop=()=>finish(run);
      try{
        const Context=window.AudioContext||window.webkitAudioContext;
        run.context=new Context();run.context.resume().catch(()=>{});
        if(epoch!==requestEpoch){cleanup(run);return;}
        const analyzer=run.context.createAnalyser();analyzer.fftSize=2048;run.context.createMediaStreamSource(stream).connect(analyzer);
        const values=new Float32Array(analyzer.fftSize);run.meterAvailable=run.context.state==='running';
        run.meter=setInterval(()=>{if(run.context.state!=='running')return;run.meterAvailable=true;analyzer.getFloatTimeDomainData(values);const rms=Math.sqrt(values.reduce((sum,value)=>sum+value*value,0)/values.length);if(rms>.012)run.voiced=true;},75);
      }catch{/* Provider confidence still handles unclear audio if metering is unavailable. */}
      run.recorder.start();run.timer=setTimeout(()=>{if(run.recorder.state==='recording')run.recorder.stop();},8000);
      message('Listening… say the word, then tap Done speaking.');sync();
    }catch(error){
      stream?.getTracks().forEach(track=>track.stop());
      if(epoch!==requestEpoch)return;
      cleanup(session);session=null;requesting=false;
      message(error.name==='NotAllowedError'?'Microphone access is blocked. Allow it in your browser, then try again.':'Couldn’t open the microphone. Check your device and try again.');sync();
    }
  }
  $('recordWord').onclick=start;
  $('cancelRecording').onclick=()=>{cancel();message('Recording cancelled. No attempt counted.');};
  $('skipWord').onclick=()=>{cancel();$('heardWord').hidden=true;skip();};
  window.addEventListener('pagehide',cancel);
  return {sync,cancel,help,reset:(saved={})=>{progress.clear();for(const [id,value] of Object.entries(saved))progress.set(id,{...WordRingReading.fresh(),...value,feedback:value.correct?'You read this word! It’s in My Ring.':'Try reading this word aloud.'});},lettersAllowed:()=>help().letters};
}};
