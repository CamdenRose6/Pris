const test=require('node:test'),assert=require('node:assert/strict');
const learning=require('../public/learning-content.js');
const card={grade:'2',comprehension:{passage:'The fox sits by a tree.',questions:[{question:'Where is the fox?',choices:['A tree','A bed','A shop'],answer:0},{question:'What does the fox do?',choices:['Runs','Sits','Swims'],answer:1}]}};
test('Grade 2+ cards require spelling then every comprehension question',()=>{
 assert.equal(learning.advanced(card),true);assert.equal(learning.advanced({grade:'K'}),false);assert.equal(learning.advanced({grade:'1'}),false);
 let state=learning.initial(card);assert.equal(learning.phase(card,state),'spelling');
 state.spellingCorrect=true;assert.equal(learning.phase(card,state),'comprehension');
 state.questionsCorrect[0]=true;assert.equal(learning.phase(card,state),'comprehension');
 state.questionsCorrect[1]=true;assert.equal(learning.phase(card,state),'done');
});
test('passages need one or two valid three-choice questions',()=>{
 assert.equal(learning.content(card.comprehension).questions.length,2);
 for(const invalid of [{passage:'',questions:card.comprehension.questions},{passage:'A fox.',questions:[]},
                       {passage:'A fox.',questions:[{question:'Where?',choices:['Here'],answer:0}]}])assert.throws(()=>learning.content(invalid));
});

test('upper-grade samples use longer passages and two reasoning questions',()=>{
 for(const grade of ['4','5']){
  const cards=learning.upperSamples(grade);assert.equal(cards.length,3);
  for(const card of cards){
   const content=learning.content(card.comprehension);
   assert.equal(content.questions.length,2);
   assert.ok(content.passage.split(/\s+/).length>=(grade==='4'?100:140));
   assert.ok(content.passage.includes('\n\n'));
   for(const q of content.questions)assert.equal(new Set(q.choices).size,3);
  }
 }
 assert.notDeepEqual(learning.upperSamples('4')[0].comprehension.questions,learning.upperSamples('5')[0].comprehension.questions);
});
