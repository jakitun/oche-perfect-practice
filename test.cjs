const assert=require('node:assert/strict'),D=require('./dist/engine.js');
let g=D.fresh();for(const x of ['T20','T20','T20','T20','T20','T20','T20','T19','D12'])g=D.throwDart(g,x);assert.equal(g.status,'won');assert.equal(g.remaining,0);assert.equal(g.throws.length,9);
g={...D.fresh(),remaining:40,visitStart:40};g=D.throwDart(g,'S20');g=D.throwDart(g,'S20');assert.equal(g.remaining,40);assert.equal(g.round,2);assert.equal(g.visits[0].score,0);assert.equal(g.visits[0].bust,true);
g={...D.fresh(),remaining:50,visitStart:50};assert.equal(D.throwDart(g,'BULL').status,'won');assert.equal(D.throwDart(g,'25').remaining,25);
g={...D.fresh(),remaining:2,visitStart:2};assert.equal(D.throwDart(g,'S1').remaining,2);assert.equal(D.throwDart(g,'D1').status,'won');
g=D.fresh();for(let i=0;i<24;i++)g=D.throwDart(g,'MISS');assert.equal(g.status,'lost');assert.equal(g.visits.length,8);assert.equal(D.throwDart(g,'T20').throws.length,24);
g={...D.fresh(),round:8,dart:2,remaining:32,visitStart:100};assert.equal(D.throwDart(g,'D16').status,'won');
for(let s=2;s<=501;s++)for(let n=1;n<=3;n++){const route=D.route(s,n);if(route){assert.ok(route.length<=n);assert.equal(route.reduce((a,x)=>a+D.get(x).value,0),s);assert.equal(D.get(route.at(-1)).double,true);let left=s;for(const x of route.slice(0,-1)){left-=D.get(x).value;assert.ok(left>1);}}const h=D.arrange(s,n);assert.ok(h.labels.every(x=>D.get(x)));}
assert.equal(D.route(169,3),null);assert.equal(D.route(170,2),null);assert.deepEqual(D.route(170,3),['T20','T20','BULL']);assert.equal(D.route(25,1),null);console.log('PASS: scoring, bust rollback, split bull, round limits, 24th-dart finish and all arrange routes 2–501.');
g=D.fresh();for(const n of [100,100,100,100])g=D.visitTotal(g,n);assert.equal(g.remaining,101);assert.equal(g.round,5);g=D.visitTotal(g,101,{checkout:true,darts:3});assert.equal(g.status,'won');assert.equal(g.remaining,0);assert.equal(g.throws.reduce((n,t)=>n+(t.darts||1),0),15);
g=D.fresh();assert.throws(()=>D.visitTotal(g,179));assert.throws(()=>D.visitTotal(g,181));g=D.visitTotal(g,0,{bust:true});assert.equal(g.remaining,501);assert.equal(g.round,2);assert.equal(g.visits[0].bust,true);
g={...D.fresh(),remaining:32,visitStart:32};assert.throws(()=>D.visitTotal(g,32));g=D.visitTotal(g,32,{checkout:true,darts:1});assert.equal(g.status,'won');assert.equal(g.dart,1);
g=D.fresh();for(let i=0;i<8;i++)g=D.visitTotal(g,0);assert.equal(g.status,'lost');assert.equal(g.round,8);
g=D.throwDart(D.fresh(),'T20');assert.throws(()=>D.visitTotal(g,100));console.log('PASS: round totals, impossible scores, double-out confirmation, darts used, busts and mixed-input boundaries.');
