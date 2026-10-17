const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const learning=require('../public/learning-content.js');
const source=fs.readFileSync('public/app.js','utf8');
function setup(grade){
 const elements={grade:{value:grade},folderSelect:{value:'Demo'},createDialog:{close(){}}};
 const context={WordRingLearning:learning,classroomAccount:{isStudent:()=>false},isTeacher:()=>true,state:{cards:[]},crypto:{randomUUID:()=>String(Math.random())},$:(id)=>elements[id],save(){},showReading(){},toast(){},currentCards:()=>context.state.cards,openActivityEditor:card=>context.edited=card};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function addCards('),source.indexOf('function manualCards(')),context);
 return context;
}
test('K and Grade 1 content contains pronunciation words without question activities',()=>{
 for(const grade of ['K','1']){
  const c=setup(grade);c.addCards([{word:'cat',quiz:{},comprehension:{}}],'manual');
  assert.equal(c.state.cards[0].grade,grade);assert.equal(c.state.cards[0].word,'cat');
  assert.equal('quiz' in c.state.cards[0],false);assert.equal('comprehension' in c.state.cards[0],false);assert.equal(c.edited,undefined);
 }
});
test('Grade 2+ manual content opens the editor and sample content includes reading questions',()=>{
 for(const grade of ['2','3','4','5']){
  const c=setup(grade);c.addCards([{word:'fox'}],'manual');assert.equal(c.edited,c.state.cards[0]);
 }
 const c=setup('2');
 vm.runInContext(source.slice(source.indexOf('const samples ='),source.indexOf('let state;')),c);
 c.sampleLesson();
 assert.equal(c.state.cards.length,5);
 for(const card of c.state.cards)assert.doesNotThrow(()=>learning.content(card.comprehension));
});

test('selecting grades 4 and 5 loads the harder sample activities',()=>{
 for(const grade of ['4','5']){
  const c=setup(grade);c.sampleLesson();
  assert.equal(c.state.cards.length,3);
  for(const card of c.state.cards){
   assert.equal(card.grade,grade);
   assert.equal(card.comprehension.questions.length,2);
   assert.ok(card.comprehension.passage.split(/\s+/).length>=100);
  }
 }
});
