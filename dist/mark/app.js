const phases = ['Bull','20','Bull','19','Bull','18','Bull','17','Bull','16','Bull','15','Bull'];
const targets = [...new Set(phases)];
const $ = id => document.getElementById(id);
const sum = values => values.reduce((a,b) => a+b,0);
const format = ms => {
  const cs = Math.floor(Math.max(0,ms)/10);
  return Math.floor(cs/6000)+':'+String(Math.floor(cs/100)%60).padStart(2,'0')+'.'+String(cs%100).padStart(2,'0');
};
const key = 'oche.sessions.v1';
function readSessions() {
  return JSON.parse(localStorage.getItem(key) ?? '[]');
}
let sessions = [];
try { sessions = readSessions(); } catch { $('status').textContent = 'Saved history could not be loaded.'; }
let run, finished, unsaved;
const bestTotal = () => Math.min(...sessions.map(s => sum(s.splits)));
function table(headers,rows) {
  return '<table><thead><tr>'+headers.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+
    rows.map(row=>'<tr>'+row.map((cell,i)=>i===0?'<th scope="row">'+cell+'</th>':'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
}
function splitsTable(session,reference) {
  const headers = reference ? ['Phase','Time','vs. previous'] : ['Phase','Time'];
  return table(headers,session.splits.map((ms,i)=>{
    const row = [String(i+1).padStart(2,'0')+' · '+phases[i],format(ms)];
    if(reference) {
      const diff = ms-reference.splits[i];
      row.push((diff<0?'−':diff>0?'+':'')+format(Math.abs(diff)));
    }
    return row;
  }));
}
function renderHistory() {
  const ordered = [...sessions].sort((a,b)=>b.date-a.date);
  if (!ordered.length) {
    $('historyBody').innerHTML = '<div class="summary">Finish your first drill to start tracking times.</div>';
    return;
  }
  const stats = targets.map(target=>{
    const values = ordered.flatMap(s=>s.splits.filter((_,i)=>phases[i]===target)).sort((a,b)=>a-b);
    const mid = Math.floor(values.length/2);
    const median = values.length%2 ? values[mid] : (values[mid-1]+values[mid])/2;
    return [target,format(values[0]),format(sum(values)/values.length),format(median)];
  });
  $('historyBody').innerHTML = '<div class="summary"><span>Personal best</span><strong class="badge">'+format(bestTotal())+'</strong></div>'+
    '<h2>Target stats</h2><p>All completed splits. Bull pools all seven bull phases.</p><div class="stats">'+table(['Target','Best','Average','Median'],stats)+'</div>'+
    '<h2>Sessions · '+ordered.length+'</h2><p>Open a session to compare splits with the previous run.</p>'+
    ordered.map((s,i)=>'<details><summary>'+new Date(s.date).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})+
      '<time>'+format(sum(s.splits))+(sum(s.splits)===bestTotal()?' <span class="badge">PB</span>':'')+'</time></summary>'+
      splitsTable(s,ordered[i+1])+'</details>').join('');
}
function showHistory(show) {
  $('drill').hidden=show;
  $('history').hidden=!show;
  $('drillTab').setAttribute('aria-pressed',!show);
  $('historyTab').setAttribute('aria-pressed',show);
  if(show) renderHistory();
}
function renderDrill() {
  const i = run?.splits.length ?? 0;
  const target = phases[i];
  $('phaseLabel').textContent = finished ? '13 / 13 COMPLETE' : 'PHASE '+String(i+1).padStart(2,'0')+' / 13';
  $('progress').innerHTML = phases.map((_,n)=>'<i class="'+(finished||n<i?'done':n===i?'current':'')+'"></i>').join('');
  $('target').textContent = finished ? 'Finished' : target;
  $('rule').textContent = finished ? (unsaved?'Session needs saving':finished.pb?'Personal best':'Session saved') : target==='Bull'?'2 bulls':'5 marks · T'+target+' + O'+target+' + O'+target;
  $('advance').textContent = unsaved?'Retry save':finished?'New drill':!run?'Start drill':i===12?'Finish drill':'Next phase';
  $('next').textContent = finished ? '' : phases[i+1] ? 'Up next · '+phases[i+1] : 'Final phase';
  $('runningTools').hidden = !run;
  $('results').innerHTML = finished ? '<h2>Phase times</h2><div class="stats">'+splitsTable(finished)+'</div>' : '';
  updateClock();
}
function updateClock() {
  const now = performance.now();
  $('split').textContent = format(run?now-run.lap:finished?sum(finished.splits):0);
  $('total').textContent = format(run?now-run.start:finished?sum(finished.splits):0);
}
function saveFinished() {
  try {
    const latest = readSessions();
    const updated = [...latest.filter(s=>s.id!==finished.id),finished];
    localStorage.setItem(key,JSON.stringify(updated));
    sessions = updated;
    unsaved = false;
    $('status').textContent = '';
  } catch {
    unsaved = true;
    $('status').textContent = 'Could not save this session. Keep this page open and retry.';
  }
}
$('advance').onclick = () => {
  const now = performance.now();
  if (unsaved) saveFinished();
  else if (finished) finished = null;
  else if (!run) run = {start:now,lap:now,splits:[]};
  else {
    run.splits.push(now-run.lap);
    run.lap=now;
    if(run.splits.length===phases.length) {
      finished={id:crypto.randomUUID(),date:Date.now(),splits:run.splits,pb:sum(run.splits)<bestTotal()};
      run=null;
      saveFinished();
    }
  }
  renderDrill();
};
$('discard').onclick = () => {
  if(confirm('Discard this unfinished drill?')) { run=null; renderDrill(); }
};
$('drillTab').onclick = () => showHistory(false);
$('historyTab').onclick = () => showHistory(true);
addEventListener('storage', event => {
  if(event.key===key || event.key===null) {
    try { sessions=readSessions(); if(!$('history').hidden) renderHistory(); } catch {}
  }
});
addEventListener('beforeunload', event => {
  if(run || unsaved) { event.preventDefault(); event.returnValue=true; }
});
setInterval(()=>{if(run && !$('drill').hidden)updateClock();},33);
renderDrill();
