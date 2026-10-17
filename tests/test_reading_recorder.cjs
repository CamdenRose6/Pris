const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const flow=require('../public/reading-flow.js');
function harness(){
 const elements=new Map(),tracks={stopped:0,stop(){this.stopped++}};
 const $=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,textContent:'',classList:{toggle(){}},setAttribute(){}});return elements.get(id);};
 let card={id:'first',word:'cat'},recorder,resolveMic,result={outcome:'retry',transcript:'dog',message:'Try again.'};
 let now=0;
 class Recorder{
  static isTypeSupported(){return true;}
  constructor(){recorder=this;this.mimeType='audio/webm';this.state='inactive';}
  start(){this.state='recording';}
  stop(){this.state='inactive';this.ondataavailable({data:new Blob(['x'.repeat(200)])});this.onstop();}
 }
 class Reader{readAsDataURL(){this.result='data:audio/webm;base64,'+Buffer.from('x'.repeat(200)).toString('base64');queueMicrotask(()=>this.onload());}}
 const context={window:{addEventListener(){}},document:{getElementById:$},WordRingReading:flow,navigator:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>resolveMic=resolve)}},MediaRecorder:Recorder,FileReader:Reader,Blob,AbortController,performance:{now:()=>now},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},fetch:async()=>({ok:true,json:async()=>result})};
 context.window.MediaRecorder=Recorder;
 vm.runInNewContext(fs.readFileSync('public/reading-recorder.js','utf8'),context);
 let api;
 const render=()=>{$('nextWord').disabled=false;api.sync();};
 api=context.window.WordRingRecorder.create({getCard:()=>card,stopSpeech(){},render,skip(){}});
 render();
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 return {$,api,tracks,flush,setCard:value=>card=value,setResult:value=>result=value,
  async record(){const starting=$('recordWord').onclick();resolveMic({getTracks:()=>[tracks]});await starting;now+=1000;await $('recordWord').onclick();await flush();},
  pending(){return $('recordWord').onclick();},allowMic(){resolveMic({getTracks:()=>[tracks]});}};
}
test('recorder results drive the actual help buttons, then next word',async()=>{
 const h=harness();assert.equal(h.$('flipCard').hidden,true);assert.equal(h.$('readAloud').hidden,true);
 await h.record();assert.equal(h.$('flipCard').hidden,false);assert.equal(h.$('readAloud').hidden,true);
 await h.record();assert.equal(h.$('readAloud').hidden,false);assert.equal(h.$('nextWord').disabled,true);
 h.setResult({outcome:'correct',message:'You got it!',transcript:'cat'});await h.record();
 assert.equal(h.$('nextWord').disabled,false);assert.equal(h.$('recordWord').disabled,true);
 assert.ok(h.tracks.stopped>=3);
});
test('cancel during microphone permission prevents a late recording',async()=>{
 const h=harness(),pending=h.pending();h.api.cancel();h.allowMic();await pending;
 assert.equal(h.tracks.stopped,1);assert.equal(h.$('flipCard').hidden,true);assert.equal(h.$('readAloud').hidden,true);
});
test('unclear recognition does not unlock clues',async()=>{
 const h=harness();h.setResult({outcome:'unclear',message:'Try again.'});await h.record();
 assert.equal(h.$('flipCard').hidden,true);assert.equal(h.$('readAloud').hidden,true);
});
test('saved classroom progress restores hints and earned words, then clears on sign out',()=>{
 const h=harness();
 h.api.reset({first:{misses:2,correct:false}});h.api.sync();
 assert.equal(h.$('flipCard').hidden,false);assert.equal(h.$('readAloud').hidden,false);
 h.api.reset({first:{misses:1,correct:true}});h.api.sync();
 assert.equal(h.$('recordWord').disabled,true);
 assert.match(h.$('attemptFeedback').textContent,/My Ring/);
 h.api.reset();h.$('nextWord').disabled=false;h.api.sync();
 assert.equal(h.$('recordWord').disabled,false);assert.equal(h.$('flipCard').hidden,true);
});
