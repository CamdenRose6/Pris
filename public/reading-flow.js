(function(root){
  function fresh(){return {misses:0,correct:false,feedback:'Try reading this word aloud.'};}
  function apply(state,result){
    if(state.correct)return {...state};
    if(result.outcome==='correct')return {...state,correct:true,feedback:result.message};
    if(result.outcome==='retry')return {...state,misses:state.misses+1,feedback:result.message};
    return {...state,feedback:result.message||'Please try again. This attempt won’t count.'};
  }
  function help(state){return {picture:state.misses>=1,audio:state.misses>=2,letters:true};}
  const api={fresh,apply,help};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.WordRingReading=api;
})(typeof window!=='undefined'?window:globalThis);
