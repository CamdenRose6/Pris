const test=require('node:test');
const assert=require('node:assert/strict');
const phonics=require('../public/phonics.js');

test('cat uses letter sounds rather than letter names',()=>{
 assert.deepEqual(phonics.segments('cat').map(p=>p.sound),['k','a','t']);
 assert.deepEqual(phonics.letters('CAT').map(p=>p.letter),['C','A','T']);
});
test('both letters of sh share one sound and highlight group',()=>{
 const letters=phonics.letters('fish');
 assert.equal(letters[2].sound,'sh');
 assert.equal(letters[3].sound,'sh');
 assert.equal(letters[2].group,letters[3].group);
});
test('context matters: long vowels and silent letters are explicit',()=>{
 assert.equal(phonics.letters('cake')[1].sound,'ay');
 assert.equal(phonics.letters('cake')[3].sound,'silent');
 assert.equal(phonics.letters('put')[1].sound,'book');
 assert.equal(phonics.letters('sun')[1].sound,'u');
});
test('unknown words never receive guessed phonics',()=>{
 assert.equal(phonics.segments('read'),null);
 assert.ok(phonics.letters('read').every(p=>p.sound===null));
});
test('every mapped word covers its spelling and uses valid sound IDs',()=>{
 for(const [word,groups] of Object.entries(phonics.words)){
  assert.equal(groups.map(p=>p.letters).join('').toLowerCase(),word);
  assert.equal(phonics.letters(word).length,word.length);
  assert.ok(groups.every(p=>Object.hasOwn(phonics.sounds,p.sound)),word);
 }
});

test('exceptions and inflections follow spoken sounds, not spelling rules',()=>{
 for(const [word,expected] of Object.entries({have:['h','a','v','silent'],said:['s','e','d'],dogs:['d','o','g','z'],jumped:['j','u','m','p','t'],played:['p','l','ay','d'],knee:['silent','n','ee'],phone:['f','oh','n','silent']})){
  assert.deepEqual(phonics.segments(word).map(p=>p.sound),expected,word);
 }
 for(const word of ['read','wind','lead','bow'])assert.equal(phonics.segments(word),null);
});
test('sound hints distinguish vowel teams without coaching narration',()=>{
 assert.match(phonics.hint(phonics.letters('cat')[0],'cat'),/as in cat/);
 assert.match(phonics.hint(phonics.letters('book')[1],'book'),/as in book/);
 assert.match(phonics.hint(phonics.letters('moon')[1],'moon'),/as in moon/);
 for(const groups of Object.values(phonics.words))for(const part of groups){
  assert.ok(!phonics.hint(part,'word').includes('undefined'));
 }
});
