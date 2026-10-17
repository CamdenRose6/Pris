const test=require('node:test');
const assert=require('node:assert/strict');
const progress=require('../public/student-progress.js');
const student=(name,correct,total)=>({name,words:Array.from({length:total},(_,i)=>({correct:i<correct}))});
test('class comparison uses completion percentages and excludes unassigned students',()=>{
 const report=progress.summarize([student('Alex',1,2),student('Bailey',1,4),student('Casey',0,0)]);
 assert.equal(report.average,37.5);assert.equal(report.eligible,2);
 assert.deepEqual(report.rows.map(row=>row.status),['on-track','attention','unassigned']);
});
test('equal completion is on track and no reading data is ready to start',()=>{
 assert.deepEqual(progress.summarize([student('A',1,2),student('B',2,4)]).rows.map(row=>row.status),['on-track','on-track']);
 assert.equal(progress.summarize([student('A',0,6)]).rows[0].status,'ready');
 assert.equal(progress.summarize([]).average,null);
 assert.equal(progress.summarize([student('A',0,0)]).rows[0].status,'unassigned');
});
test('timeline counts saved successes on their dates and carries older progress forward',()=>{
 const now=new Date(2026,9,17,12).getTime();
 const seconds=(day)=>new Date(2026,9,day,10).getTime()/1000;
 const words=[{correct:true,earnedAt:seconds(1)},{correct:true,earnedAt:seconds(15)},
              {correct:true,earnedAt:seconds(17)},{correct:false,earnedAt:seconds(16)}];
 const history=progress.timeline(words,now);
 assert.equal(history.points.length,14);assert.equal(history.points[0].count,1);
 assert.equal(history.points[11].count,2);assert.equal(history.points[13].count,3);
 assert.equal(history.assigned,4);assert.equal(history.missing,0);
});
test('undated, invalid, or future successes never invent historical progress',()=>{
 const now=new Date(2026,9,17,12).getTime();
 const history=progress.timeline([{correct:true},{correct:true,earnedAt:NaN},{correct:true,earnedAt:now/1000+10000}],now);
 assert.ok(history.points.every(point=>point.count===0));assert.equal(history.missing,3);
});
test('empty history stays at zero without fabricated growth',()=>{
 assert.ok(progress.timeline([],Date.now()).points.every(point=>point.count===0));
});
test('rendered card highlights attention and preserves accessible chart and word details',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const make=tag=>({tag,children:[],attributes:{},className:'',textContent:'',append(...children){this.children.push(...children);},setAttribute(key,value){this.attributes[key]=value;}});
 const context={WordRingProgress:progress,document:{createElement:make,createElementNS:(_ns,tag)=>make(tag)},Intl,Date,Math};
 const source=fs.readFileSync('public/classroom-ui.js','utf8');
 vm.runInNewContext(source.slice(source.indexOf('function progressPercent(')),context);
 const report=progress.summarize([{name:'Alex <test>',username:'alex',words:[{word:'cat',correct:false,attempts:1}]},student('Bailey',1,1)]);
 const card=context.studentProgressCard(report.rows[0],0);
 const flatten=node=>[node,...node.children.flatMap(flatten)];const nodes=flatten(card);
 assert.match(card.className,/attention/);
 assert.ok(nodes.some(n=>n.tag==='strong'&&n.textContent==='Needs attention'));
 assert.ok(nodes.some(n=>n.tag==='button'&&n.textContent==='Alex <test>'));
 assert.ok(nodes.some(n=>n.tag==='svg'&&n.attributes.role==='img'));
 assert.ok(nodes.some(n=>n.tag==='summary'&&n.textContent==='View assigned words (1)'));
});

test('student name expands snapshot rings and removal failures remain visible',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const make=tag=>({tag,children:[],attributes:{},className:'',textContent:'',append(...children){this.children.push(...children);},setAttribute(key,value){this.attributes[key]=value;}});
 const context={WordRingProgress:progress,document:{createElement:make,createElementNS:(_ns,tag)=>make(tag)},Intl,Date,Math};
 const source=fs.readFileSync('public/classroom-ui.js','utf8');vm.runInNewContext(source.slice(source.indexOf('function progressPercent(')),context);
 const row=progress.summarize([{id:'reader',name:'Alex',username:'alex',words:[{folder:'Deleted teacher ring',word:'cat'},{folder:'Deleted teacher ring',word:'dog'},{folder:'Space',word:'sun'}]}]).rows[0];
 let requested;const panel=context.studentProgressCard(row,0,{onRemove:async ring=>{requested=ring;throw Error('Could not save. Try again.');}});
 const flatten=node=>[node,...node.children.flatMap(flatten)],nodes=flatten(panel);
 const name=nodes.find(n=>n.className==='student-name-button'),rings=nodes.find(n=>n.className==='student-assigned-rings');
 assert.equal(rings.hidden,true);name.onclick();assert.equal(rings.hidden,false);assert.equal(name.attributes['aria-expanded'],'true');
 const remove=nodes.find(n=>n.attributes['aria-label']==='Remove Deleted teacher ring from Alex');
 await remove.onclick();assert.equal(requested,'Deleted teacher ring');assert.equal(remove.disabled,false);
 assert.ok(nodes.some(n=>n.className==='assigned-ring-error'&&n.textContent==='Could not save. Try again.'));
 assert.ok(nodes.some(n=>n.textContent==='Deleted teacher ring · 2 words'));
});
