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
