'use strict';

const byId = id => document.getElementById(id);
const modes = {
  perfect: { label: 'PERFECT 501' },
  solo: { label: '501 Solo' },
  '301': { label: '301 Checkout' },
  ladder: { label: '121 Checkout' },
  counter: { label: 'Bull Counter' },
  mark: { label: 'Bull & Mark' },
  race: { label: 'Bull Race' }
};
const phases = ['Bull 1', '20', 'Bull 2', '19', 'Bull 3', '18', 'Bull 4', '17', 'Bull 5', '16', 'Bull 6', '15', 'Bull 7'];
const sum = values => values.reduce((total, value) => total + value, 0);

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); }
  catch { return null; }
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

// The original drills retain their save formats. Normalize them on read so
// undo, deletion and legacy saves appear immediately without duplicate writes.
function sessions() {
  const perfect = array(read('oche-perfect-v1')?.history).map(session => {
    const legs = [...array(session.legs), session.game].filter(Boolean);
    return {
      id: session.id, mode: 'perfect', date: Date.parse(session.date),
      result: session.complete ? session.game?.status === 'won' ? 'Cleared' : 'Failed' : 'Incomplete',
      complete: !!session.complete, variant: session.mode, assisted: session.assisted,
      visits: sum(legs.map(leg => array(leg.visits).length)), attempts: legs.length,
      points: sum(legs.flatMap(leg => array(leg.visits).map(v => v.score))),
      darts: sum(legs.flatMap(leg => array(leg.throws).map(d => d.darts || 1)))
    };
  });
  const mark = array(read('oche.sessions.v1')).filter(session =>
    Array.isArray(session.splits) && session.splits.length === phases.length &&
    session.splits.every(split => Number.isFinite(split) && split >= 0)
  ).map(session => ({
    id: session.id, mode: 'mark', date: Number(session.date), result: 'Completed', complete: true,
    durationMs: sum(session.splits), phaseTimes: phases.map((target, index) => ({
      target, durationMs: session.splits[index]
    }))
  }));
  const race = array(read('ocheHistory')).map((session, index) => {
    const [day, month, year] = String(session.date).split('/').map(Number);
    const [hour, minute] = String(session.time || '00:00').split(':').map(Number);
    return {
      id: session.id ?? `race-${index}`, mode: 'race',
      date: new Date(year, month - 1, day, hour, minute).getTime(),
      result: session.bulls >= session.target ? 'Target reached' : 'Ended early',
      complete: session.bulls >= session.target, durationMs: session.durationSecs * 1000,
      visits: session.rounds, hits: session.bulls, target: session.target,
      blanks: session.miss, hatTricks: session.hats
    };
  });
  const unified = array(read('oche-unified-v1'));
  const keys = new Set(unified.map(s => s.mode + ':' + s.id));
  const legacy = [...perfect, ...mark, ...race].filter(s => !keys.has(s.mode + ':' + s.id));
  return [...unified, ...legacy].sort((a, b) => (b.date || 0) - (a.date || 0));
}

function duration(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${String(Math.floor(ms / 10) % 100).padStart(2, '0')}`;
}

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function sessionMode(s) {
  if (s.mode === 'perfect') return s.variant === 'exam' ? 'perfect' : s.variant;
  return s.variant === 'counter' ? 'counter' : s.mode;
}

function showHistory(records) {
  const best = Math.min(...records.filter(s => s.mode === 'mark').map(s => s.durationMs));
  const entries = records.map(session => {
    const row = document.createElement('details');
    const summary = element('summary', (modes[sessionMode(session)] || modes[session.mode]).label);
    const date = Number.isFinite(session.date) ? new Date(session.date).toLocaleString() : 'Date unavailable';
    summary.append(element('span', `${date} · ${session.result}`));
    row.append(summary);
    if (session.mode === 'perfect') {
      row.append(element('p', `${({exam:'Mock exam',solo:'501 solo','301':'301 checkout',ladder:'121 ladder'})[session.variant] || 'Single leg'} · ${session.attempts} attempts · ${session.visits} visits${session.assisted ? ' · Assisted' : ''}`));
      if (session.highestCheckout) row.append(element('p', `Highest checkout · ${session.highestCheckout}`));
    } else if (session.mode === 'race') {
      if (session.variant === 'counter') row.append(element('p', `${session.hits} bulls · Simple counter`));
      else row.append(element('p', `${session.hits}/${session.target} bulls · ${session.visits} visits · ${session.visits ? (session.hits / session.visits).toFixed(2) : '—'} BPV`));
      if (Number.isFinite(session.durationMs)) row.append(element('p', duration(session.durationMs)));
    } else {
      summary.append(element('span', duration(session.durationMs) + (session.durationMs === best ? ' · PB' : '')));
      const splits = document.createElement('dl');
      session.phaseTimes.forEach(phase => splits.append(element('dt', phase.target), element('dd', duration(phase.durationMs))));
      row.append(splits);
    }
    return row;
  });
  byId('log').replaceChildren(...(entries.length ? entries : [element('p', 'No sessions yet.')]));
}

function showInsights(records) {
  const exams = records.filter(s => sessionMode(s) === 'perfect');
  const complete = exams.filter(s => s.complete);
  const unassisted = complete.filter(s => !s.assisted);
  const clears = complete.filter(s => s.result === 'Cleared');
  const scored = exams.filter(s => Number.isFinite(s.points) && s.darts > 0);
  const drills = records.filter(s => s.mode === 'mark');
  const races = records.filter(s => sessionMode(s) === 'race' && s.visits > 0);
  const counters = records.filter(s => sessionMode(s) === 'counter');
  const visits = sum(races.map(s => s.visits));
  const metrics = [];
  if (exams.length) {
    const lines = [`${clears.length}/${complete.length} completed exams cleared · ${exams.length - complete.length} incomplete`];
    if (unassisted.length) lines.push(`Unassisted: ${unassisted.filter(s => s.result === 'Cleared').length}/${unassisted.length} cleared`);
    if (clears.length) lines.push(`Best clear: attempt ${Math.min(...clears.map(s => s.attempts))}`);
    if (scored.length) lines.push(`Three-dart average: ${(3 * sum(scored.map(s => s.points)) / sum(scored.map(s => s.darts))).toFixed(1)}`);
    metrics.push(['PERFECT 501', lines]);
  }
  for (const mode of ['solo', '301', 'ladder']) {
    const results = records.filter(s => sessionMode(s) === mode);
    if (!results.length) continue;
    const best = Math.max(0, ...results.map(s => s.highestCheckout || 0));
    const lines = mode === 'ladder'
      ? [`${results.length} saved ladders · Best checkout ${best || '—'}`]
      : [`${results.filter(s => s.result === 'Cleared').length} cleared · ${results.length} saved legs`];
    metrics.push([modes[mode].label, lines]);
  }
  if (drills.length) metrics.push(['Bull & Mark', [`Best ${duration(Math.min(...drills.map(s => s.durationMs)))} · Average ${duration(sum(drills.map(s => s.durationMs)) / drills.length)} · ${drills.length} runs`]]);
  if (visits) metrics.push(['Bull Race', [`${(sum(races.map(s => s.hits)) / visits).toFixed(2)} bulls per visit · ${Math.round(100 * sum(races.map(s => s.blanks || 0)) / visits)}% blank visits`, `${sum(races.map(s => s.hatTricks || 0))} hat tricks · ${races.filter(s => s.complete).length} targets reached`]]);
  if (counters.length) metrics.push(['Bull Counter', [`${sum(counters.map(s => s.hits))} bulls · ${counters.length} sessions · Best ${Math.max(...counters.map(s => s.hits))}`]]);
  if (!metrics.length) metrics.push(['No stats yet', ['Save a session in this mode to see your stats.']]);
  byId('metrics').replaceChildren(...metrics.map(([label, value]) => {
    const card = document.createElement('article');
    card.append(element('strong', label), ...value.map(line => element('p', line)));
    return card;
  }));
  const recent = complete.slice(0, 10);
  if (recent.length) {
    const card = element('article', '');
    card.append(element('strong', 'PERFECT · Recent exams'));
    const wins = recent.filter(s => s.result === 'Cleared').length;
    card.append(element('p', `${wins}/${recent.length} cleared (${Math.round(100 * wins / recent.length)}%) · latest ${recent.length} completed exams`));
    const trend = document.createElement('ol');
    trend.className = 'insight-trend';
    for (const session of [...recent].reverse()) {
      const avg = Number.isFinite(session.points) && session.darts > 0
        ? (3 * session.points / session.darts).toFixed(1) : '—';
      const date = Number.isFinite(session.date) ? new Date(session.date).toLocaleDateString() : 'Unknown date';
      const item = element('li', '');
      item.append(element('span', `${date} · ${session.result}${session.assisted ? ' · Assisted' : ''}`), element('strong', avg));
      trend.append(item);
    }
    card.append(element('p', 'Three-dart average · oldest to newest'), trend);
    byId('metrics').append(card);
  }
  const timed = drills.filter(s => Number.isFinite(s.durationMs) && s.phaseTimes?.length === phases.length);
  if (timed.length >= 2) {
    const latest = timed[0];
    const best = timed.reduce((a, b) => b.durationMs < a.durationMs ? b : a);
    const card = element('article', '');
    card.append(element('strong', 'Bull & Mark · Latest vs PB'));
    const delta = ms => ms === 0 ? 'Even' : `${ms < 0 ? '−' : '+'}${duration(Math.abs(ms))}`;
    card.append(element('p', `Latest ${duration(latest.durationMs)} · PB ${duration(best.durationMs)}`));
    if (best === latest) card.append(element('p', 'Latest run is your PB.'));
    const rows = document.createElement('dl');
    rows.className = 'insight-trend split-trend';
    latest.phaseTimes.forEach((lap, i) => {
      const difference = lap.durationMs - best.phaseTimes[i].durationMs;
      const value = element('dd', delta(difference));
      value.className = difference > 0 ? 'slower' : difference < 0 ? 'faster' : '';
      rows.append(element('dt', lap.target), value);
    });
    card.append(element('p', 'Time difference by lap'), rows);
    byId('metrics').append(card);
  }

}


let current = 'home';
const pages = ['home', 'insights', 'settings', 'practice'];

function navigate(page, mode) {
  current = page;
  pages.forEach(name => { byId(name).hidden = name !== page; });
  byId('tabs').hidden = page === 'practice';
  byId('mode-label').textContent = mode ? modes[mode].label : '';
  document.querySelectorAll('#tabs [data-page]').forEach(button => {
    if (button.dataset.page === page) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (mode) renderPractice(mode);
  refresh();
}

function refresh() {
  if (current === 'insights') {
    const filter = byId('filter').value;
    const records = sessions().filter(s => !filter || sessionMode(s) === filter);
    showInsights(records);
    showHistory(records);
  }
  if (current === 'settings') {
    byId('target-setting').value = read('s_target') || 50;
    byId('audio-setting').checked = read('s_audio') !== 0;
    byId('hints-setting').checked = !!read('oche-hints');
    byId('darts-setting').checked = !!read('oche-dart-default');
    byId('laps-setting').checked = read('oche-show-lap') !== 0;
    byId('haptics-setting').checked = read('s_haptics') !== 0;
  }
}

document.querySelectorAll('[data-page]').forEach(button => {
  button.onclick = () => navigate(button.dataset.page);
});
document.querySelectorAll('[data-mode]').forEach(button => {
  button.onclick = () => navigate('practice', button.dataset.mode);
});
byId('filter').onchange = refresh;
window.addEventListener('storage', refresh);

for (const [id, key] of [
  ['target-setting', 's_target'],
  ['audio-setting', 's_audio'],
  ['haptics-setting', 's_haptics'],
  ['hints-setting', 'oche-hints'],
  ['darts-setting', 'oche-dart-default'],
  ['laps-setting', 'oche-show-lap']
]) {
  byId(id).onchange = event => {
    const input = event.target;
    const value = input.type === 'checkbox' ? input.checked :
      Math.min(999, Math.max(1, Math.round(Number(input.value) || 50)));
    try {
      localStorage.setItem(key, String(Number(value)));
      byId('settings-status').textContent = 'Saved.';
    } catch {
      byId('settings-status').textContent = 'Browser storage is unavailable.';
    }
    refresh();
  };
}

byId('backup').onclick = () => {
  const blob = new Blob([JSON.stringify({ version: 1, sessions: sessions() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = element('a', '');
  link.href = url;
  link.download = 'oche-history.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const resetDialog = byId('reset-dialog');
document.querySelectorAll('[data-reset-history]').forEach(button => {
  button.onclick = () => { resetDialog.returnValue = ''; resetDialog.showModal(); };
});
resetDialog.onclose = () => {
  if (resetDialog.returnValue !== 'reset') return;
  try {
    const legacy = read('oche-perfect-v1');
    if (legacy?.history) localStorage.setItem('oche-perfect-v1', JSON.stringify({ ...legacy, history: [] }));
    for (const key of ['oche-unified-v1', 'oche.sessions.v1', 'ocheHistory']) localStorage.removeItem(key);
    byId('settings-status').textContent = 'Practice history reset.';
  } catch {
    byId('settings-status').textContent = 'Browser storage is unavailable.';
  }
  refresh();
};
