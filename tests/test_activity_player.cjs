const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const learning=require('../public/learning-content.js');
function harness(){
 function node(tag){return {tag,children:[],attributes:{},value:'',textContent:'',append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},setAttribute(key,value){this.attributes[key]=value;},focus(){this.focused=true;}};}
 const root=node('section');
 const all=n=>[n,...n.children.flatMap(all)];
 const card={id:'fox',word:'fox',grade:'2',emoji:'🦊',comprehension:{passage:'A fox sits by a tree.',questions:[{question:'Where is the fox?',choices:['A tree','A bed','A shop'],answer:0}]}};
 const spoken=[],requests=[];let complete=false,result;
 const context={window:{},document:{createElement:node,getElementById:id=>id==='advancedActivities'?root:all(root).find(n=>n.id===id)},WordRingLearning:learning,WordRingImages:{approvedURL:()=>null},AbortController,setTimeout,clearTimeout,
 fetch:async(_url,init)=>{requests.push(JSON.parse(init.body));return {ok:true,json:async()=>result};}};
 vm.runInNewContext(fs.readFileSync('public/activities.js','utf8'),context);
 let player;player=context.window.WordRingActivities.create({getUser:()=>({id:'student'}),stopSpeech(){},speak:word=>spoken.push(word),onResult:(_card,r)=>complete=r.progress.correct,render:()=>player.show(card,complete)});
 player.show(card,false);
 return {root,all:()=>all(root),card,player,spoken,requests,result:value=>result=value,flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('wrong spelling speaks the word and allows retry; success advances to comprehension and completion',async()=>{
 const h=harness();
 const response=(spellingCorrect,done=false)=>({outcome:spellingCorrect?'correct':'retry',message:'Try again.',activityProgress:{spellingCorrect,spellingMisses:1,questionsCorrect:[done],comprehensionMisses:0},progress:{correct:done}});
 h.result(response(false));h.all().find(n=>n.id==='spellingAnswer').value='foks';h.all().find(n=>n.tag==='form').onsubmit({preventDefault(){}});await h.flush();
 assert.deepEqual(h.spoken,['fox']);assert.ok(h.all().some(n=>n.textContent==='Hear the word again'));
 assert.equal(h.requests[0].cardId,'fox');assert.equal(h.requests[0].answer,'foks');assert.equal(h.requests[0].word,undefined);
 h.result(response(true));h.all().find(n=>n.id==='spellingAnswer').value='fox';h.all().find(n=>n.tag==='form').onsubmit({preventDefault(){}});await h.flush();
 assert.ok(h.all().some(n=>n.textContent==='Read and understand'));assert.equal(h.all().some(n=>n.id==='spellingAnswer'),false);
 h.result(response(true,true));await h.all().find(n=>n.tag==='button'&&n.textContent==='A tree').onclick();await h.flush();
 assert.ok(h.all().some(n=>n.textContent==='Great work!'));
});
test('leaving an activity discards a late UI response',async()=>{
 const h=harness();h.result({outcome:'retry',message:'Try again.',activityProgress:learning.initial(h.card),progress:{correct:false}});
 h.all().find(n=>n.id==='spellingAnswer').value='foks';h.all().find(n=>n.tag==='form').onsubmit({preventDefault(){}});h.player.cancel();await h.flush();
 assert.equal(h.spoken.length,0);assert.equal(h.card.activityProgress,undefined);
});
