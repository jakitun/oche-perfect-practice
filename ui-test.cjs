const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',classList:{toggle(){}},showModal(){this.open=true},close(){this.open=false}});return elements.get(id);};
const context=vm.createContext({document:{getElementById:get,querySelectorAll:()=>[],querySelector:()=>get("entry")},localStorage:{getItem:()=>null,setItem(){}},structuredClone,crypto:require('node:crypto').webcrypto,console,Blob,URL,setTimeout});
for(const name of ['engine.js','app.js'])vm.runInContext(fs.readFileSync('dist/'+name,'utf8'),context);
const run=code=>vm.runInContext(code,context);
assert.equal(get('score').textContent,501);
run("record('T20')");assert.equal(get('score').textContent,441);get('undo').onclick();assert.equal(get('score').textContent,501);
for(let leg=0;leg<5;leg++){run("for(let i=0;i<24;i++) record('MISS')");if(leg<4)get('next').onclick();}
assert.equal(run('data.history.length'),1);assert.equal(run('terminal(data.session)'),true);assert.equal(run('data.session.legs.length'),4);assert.equal(run('data.history[0].complete'),true);
get('next').onclick();run("for(const hit of ['T20','T20','T20','T20','T20','T20','T20','T19','D12']) record(hit)");assert.equal(run('data.session.game.status'),'won');assert.equal(run('data.history.length'),2);get('undo').onclick();assert.equal(run('data.history.length'),1);assert.equal(run('data.session.game.remaining'),24);
get('hints').checked=true;get('hints').onchange();run("record('D12')");assert.equal(run('data.history[0].assisted'),true);
console.log('PASS: UI initialization, scoring, undo, five-attempt exam, pass, archive rollback and assisted classification.');
get('next').onclick();run("switchEntry('total'); typed='100'; enterTotal()");assert.equal(run('data.session.game.remaining'),401);assert.equal(run('stat(data.session.game).avg'),'100.0');get('undo').onclick();assert.equal(run('data.session.game.remaining'),501);
run("typed='179'; enterTotal()");assert.equal(run('data.session.game.remaining'),501);assert.match(get('feedback').textContent,/not possible/);
run("data.session.game={...D.fresh(),remaining:32,visitStart:32};typed='32';enterTotal()");assert.equal(get('checkoutDialog').open,true);assert.equal(run('data.session.game.status'),'playing');run('enterTotal({checkout:true,darts:1})');assert.equal(run('data.session.game.status'),'won');assert.equal(run('dartsUsed(data.session.game)'),1);
console.log('PASS: total-entry UI, weighted averages, undo, invalid totals and explicit checkout confirmation.');
