const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function harness({fail=false,teacher=true}={}){
 const elements=new Map();
 function $(id){if(!elements.has(id))elements.set(id,{disabled:false,hidden:false,handlers:{},textContent:'',close(){this.closed=true;this.handlers.close?.();},addEventListener(name,fn){this.handlers[name]=fn;},contains(){return false;},focus(){}});return elements.get(id);}
 const context={$,state:{folders:['Keep','Delete'],cards:[{id:'one',folder:'Keep'},{id:'two',folder:'Delete'}]},
  ringDeleteTarget:{name:'Delete',userId:'teacher'},ringDeleteBusy:false,ringMenuTarget:null,activeFolder:'Delete',readingIndex:1,workspaceGeneration:0,
  isTeacher:()=>teacher,stopSpeech(){},imageJobs:new Map(),render(){context.rendered=true;},toast(message){context.message=message;},
  classroomAccount:{user:()=>({id:'teacher'}),async persist(next){context.persisted=next;if(fail)throw Error('Offline');},async refresh(){context.refreshed=true;}},
  document:{addEventListener(){}},window:{addEventListener(){}}};
 const source=fs.readFileSync('public/app.js','utf8');
 vm.runInNewContext(source.slice(source.indexOf('function closeRingMenu('),source.indexOf('let activityEditorCard=')),context);
 return {context,$};
}
test('teacher deletion waits for persistence, removes only the chosen ring, and refreshes assignment choices',async()=>{
 const {context:c,$}=harness();let resolveSave;
 c.classroomAccount.persist=next=>{c.persisted=next;return new Promise(resolve=>resolveSave=resolve);};
 const pending=$('confirmDeleteRing').onclick();
 assert.equal(c.state.folders.length,2);assert.equal($('confirmDeleteRing').disabled,true);
 resolveSave();await pending;
 assert.equal(c.state.folders.join(','),'Keep');assert.equal(c.state.cards[0].id,'one');assert.equal(c.state.cards.length,1);
 assert.equal(c.activeFolder,'');assert.equal(c.refreshed,true);assert.equal($('deleteRingDialog').closed,true);
});
test('failed deletion preserves the ring and permits another try',async()=>{
 const {context:c,$}=harness({fail:true});const previous=c.state;
 await $('confirmDeleteRing').onclick();
 assert.equal(c.state,previous);assert.equal($('deleteRingDialog').closed,undefined);
 assert.match($('deleteRingError').textContent,/Offline/);assert.equal($('confirmDeleteRing').disabled,false);
});
test('student or changed account cannot submit teacher deletion',async()=>{
 const student=harness({teacher:false});await student.$('confirmDeleteRing').onclick();assert.equal(student.context.persisted,undefined);
 const changed=harness();changed.context.ringDeleteTarget.userId='other';await changed.$('confirmDeleteRing').onclick();assert.equal(changed.context.persisted,undefined);
});
test('cancel closes the dialog without changing or saving the library',()=>{
 const {context:c,$}=harness();$('cancelDeleteRing').onclick();assert.equal(c.persisted,undefined);assert.equal(c.state.folders.length,2);assert.equal(c.ringDeleteTarget,null);
});
