/* Pure scoring and arrange engine. A bust restores the entire visit. */
(function(root){
const targets=[];for(let n=1;n<=20;n++){targets.push({label:'S'+n,value:n,double:false},{label:'D'+n,value:n*2,double:true},{label:'T'+n,value:n*3,double:false});}targets.push({label:'25',value:25,double:false},{label:'BULL',value:50,double:true},{label:'MISS',value:0,double:false});
const get=l=>targets.find(t=>t.label===l);
function fresh(){return {remaining:501,round:1,visitStart:501,dart:0,throws:[],visits:[],status:'playing'};}
function throwDart(game,label,aim=null,hinted=false){
 const t=get(label);if(!t||game.status!=='playing')return game;
 const g=structuredClone(game),before=g.remaining,left=before-t.value;
 const bust=left<0||left===1||(left===0&&!t.double),win=left===0&&t.double;
 g.throws.push({label,value:t.value,before,aim,hinted,bust,checkoutChance:!!targets.find(x=>x.double&&x.value===before),round:g.round,dart:g.dart+1});g.dart++;
 if(bust)g.remaining=g.visitStart;else g.remaining=left;
 if(win)g.status='won';
 if(bust||win||g.dart===3){g.visits.push({round:g.round,start:g.visitStart,end:g.remaining,score:g.visitStart-g.remaining,bust,labels:g.throws.filter(x=>x.round===g.round).map(x=>x.label)});if(!win){if(g.round===8)g.status='lost';else{g.round++;g.dart=0;g.visitStart=g.remaining;}}}
 return g;
}
const preference=[32,40,16,24,20,8,12,36,50];const rank=n=>preference.includes(n)?preference.indexOf(n):20+n;
const finishes=targets.filter(t=>t.double).sort((a,b)=>rank(a.value)-rank(b.value));
const scoring=targets.filter(t=>t.value>0).sort((a,b)=>b.value-a.value);
function route(score,darts){
 if(score<2||darts<1)return null;
 for(const f of finishes)if(f.value===score)return [f.label];
 if(darts>=2)for(const t of scoring){const f=finishes.find(f=>f.value===score-t.value);if(f)return [t.label,f.label];}
 if(darts>=3)for(const a of scoring)for(const b of scoring){const f=finishes.find(f=>f.value===score-a.value-b.value);if(f)return [a.label,b.label,f.label];}
 return null;
}
function arrange(score,darts){const out=route(score,darts);if(out)return {labels:out,type:'checkout'};let best=null;
 for(const t of scoring){const left=score-t.value;if(left<2)continue;const next=route(left,darts>1?darts-1:3);const quality=(next?1000-next.length*60:0)+t.value+(left===32?70:0)+(left===40?60:0)-(left%2?3:0);if(!best||quality>best.quality)best={labels:[t.label],type:'setup',leave:left,quality};}return best||{labels:[],type:'none'};}
function reachable(score,darts){let sums=new Set([0]);for(let i=0;i<darts;i++){const next=new Set();for(const a of sums)for(const t of targets)next.add(a+t.value);sums=next;}return sums.has(score);}
function visitTotal(game,total,{bust=false,checkout=false,darts=3,hinted=false}={}){
 if(game.status!=='playing'||game.dart!==0)throw new Error('Finish the current round before switching input.');
 if(!Number.isInteger(total)||total<0||total>180)throw new Error('Enter a score from 0 to 180.');
 const left=game.remaining-total;
 if(checkout){if(left!==0||!Number.isInteger(darts)||darts<1||darts>3||!route(total,darts))throw new Error('That checkout is not possible in the selected darts.');}
 else if(!bust&&(!reachable(total,3)||left<2))throw new Error(left<2?'Confirm a double-out finish, or record a bust.':'That score is not possible with three darts.');
 const g=structuredClone(game);g.throws.push({label:bust?'BUST':String(total),value:total,before:g.remaining,aim:null,hinted,bust,checkoutChance:false,round:g.round,dart:1,darts:checkout?darts:3,aggregate:true});g.remaining=bust?game.remaining:left;g.visits.push({round:g.round,start:g.visitStart,end:g.remaining,score:bust?0:total,bust,labels:[bust?'BUST':String(total)],aggregate:true});
 if(checkout){g.status='won';g.dart=darts;}else if(g.round===8){g.status='lost';g.dart=3;}else{g.round++;g.visitStart=g.remaining;g.dart=0;}return g;
}
const api={targets,get,fresh,throwDart,route,arrange,reachable,visitTotal};if(typeof module!=='undefined')module.exports=api;root.Darts=api;
})(globalThis);
