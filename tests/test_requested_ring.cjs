const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness({fail=false}={}){
 const context={state:{folders:['Existing'],cards:[]},workspaceGeneration:1,isTeacher:()=>true,gemmaConnected:true,
  classroomAccount:{user:()=>({id:'teacher'}),async persist(next){context.saved=next;if(fail)throw Error('Save failed');}},
  crypto:require('node:crypto').webcrypto,DOMException,setTimeout,clearTimeout,AbortController,render(){}};
 const source=fs.readFileSync('public/app.js','utf8');vm.runInNewContext(source.slice(source.indexOf('async function createRequestedRing('),source.indexOf('let activityEditorCard=')),context);
 return context;
}
const options=(extra={})=>({topic:'Animals',grade:'K',count:3,manual:true,words:'cat, dog, cat, sun',signal:new AbortController().signal,onProgress(){},...extra});
test('manual ring creation saves teacher-selected words without AI or student assignment',async()=>{
 const h=harness();const name=await h.createRequestedRing(options());assert.equal(name,'Animals');
 assert.equal(h.state.cards.length,3);assert.equal(h.state.cards[0].folder,'Animals');assert.equal(h.state.cards[0].source,'manual');
 assert.equal(h.saved,h.state);
});
test('failed persistence never adds a ring to the displayed collection',async()=>{
 const h=harness({fail:true});await assert.rejects(h.createRequestedRing(options()),/Save failed/);assert.equal(h.state.cards.length,0);assert.equal(h.state.folders.length,1);
});
test('generation batches the requested count and excludes previously generated words',async()=>{
 const h=harness();const calls=[];
 h.fetch=async(_url,init)=>{const data=JSON.parse(init.body);calls.push(data);return {ok:true,json:async()=>({cards:Array.from({length:data.count},(_,i)=>({word:'word'+(data.exclude.length+i)}))})};};
 await h.createRequestedRing(options({manual:false,count:10}));
 assert.equal(calls.length,2);assert.equal(calls[0].count,8);assert.equal(calls[1].count,2);assert.equal(calls[1].exclude.length,8);assert.equal(h.state.cards.length,10);
});
test('over-capacity requests and cancelled accounts stop before creating a ring',async()=>{
 const h=harness();await assert.rejects(h.createRequestedRing(options({manual:false,count:201})),/1–200/);
 const controller=new AbortController();controller.abort();await assert.rejects(h.createRequestedRing(options({signal:controller.signal})),{name:'AbortError'});assert.equal(h.state.cards.length,0);
});
