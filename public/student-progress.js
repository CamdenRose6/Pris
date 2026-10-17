/* Teacher completion summaries derived only from assigned cards and saved reading dates. */
(function(root){
 function summarize(students){
  const rows=students.map(student=>{
   const assigned=student.words.length, completed=student.words.filter(word=>word.correct).length;
   return {student,assigned,completed,percent:assigned?completed/assigned*100:null};
  });
  const eligible=rows.filter(row=>row.assigned>0);
  const average=eligible.length?eligible.reduce((sum,row)=>sum+row.percent,0)/eligible.length:null;
  const hasProgress=eligible.some(row=>row.completed>0);
  return {average,eligible:eligible.length,rows:rows.map(row=>({...row,average,
   status:!row.assigned?'unassigned':!hasProgress?'ready':row.percent+1e-9<average?'attention':'on-track'}))};
 }
 function timeline(words,now=Date.now(),days=14){
  const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-days+1);
  const earned=words.filter(word=>word.correct);
  const dated=earned.filter(word=>typeof word.earnedAt==='number'&&Number.isFinite(word.earnedAt)&&word.earnedAt>0&&word.earnedAt*1000<=now);
  const points=[];
  for(let i=0;i<days;i++){
   const day=new Date(start);day.setDate(day.getDate()+i);
   const end=new Date(day);end.setDate(end.getDate()+1);
   const cutoff=Math.min(now,end.getTime()-1);
   points.push({date:day.getTime(),count:dated.filter(word=>word.earnedAt*1000<=cutoff).length});
  }
  return {points,missing:earned.length-dated.length,assigned:words.length};
 }
 const api={summarize,timeline};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.WordRingProgress=api;
})(typeof window!=='undefined'?window:globalThis);
