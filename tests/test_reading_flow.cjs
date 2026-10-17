const test=require('node:test');
const assert=require('node:assert/strict');
const flow=require('../public/reading-flow.js');

test('letters are always available, one miss unlocks picture, two unlock audio',()=>{
 let state=flow.fresh();
 assert.deepEqual(flow.help(state),{picture:false,audio:false,letters:true});
 state=flow.apply(state,{outcome:'retry',message:'Try again.'});
 assert.deepEqual(flow.help(state),{picture:true,audio:false,letters:true});
 state=flow.apply(state,{outcome:'retry',message:'Try again.'});
 assert.deepEqual(flow.help(state),{picture:true,audio:true,letters:true});
});
test('unclear speech and service errors do not unlock help',()=>{
 let state=flow.fresh();
 for(let i=0;i<5;i++)state=flow.apply(state,{outcome:'unclear',message:'No speech heard.'});
 assert.equal(state.misses,0);
 assert.equal(flow.help(state).picture,false);
});
test('success preserves the number of unsuccessful attempts',()=>{
 let state=flow.apply(flow.fresh(),{outcome:'retry'});
 state=flow.apply(state,{outcome:'correct',message:'Great reading!'});
 assert.equal(state.correct,true);
 assert.equal(state.misses,1);
 assert.deepEqual(flow.apply(state,{outcome:'retry'}),state);
});
test('each new card starts with an independent attempt',()=>{
 const first=flow.apply(flow.fresh(),{outcome:'retry'});
 const second=flow.fresh();
 assert.equal(first.misses,1);assert.equal(second.misses,0);
});
