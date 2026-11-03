'use strict';

const practice = byId('practice');
let activeMode;
let error = '';
let feedbackMotion = '';
let undo = [];
let multiplier = 'S';
let typed = '';
let inputMode = 'total';
const gameFor = (variant, target = 121) => variant === "ladder" ? Darts.fresh(target, 3) : variant === "301" ? Darts.fresh(301, Number.MAX_SAFE_INTEGER) : Darts.fresh();
const freshExam = variant => ({
  id: crypto.randomUUID(), start: null, variant, legs: [], game: gameFor(variant), target: 121, assisted: false
});
let exam = read('oche-active-perfect') || (() => {
  const legacy = read('oche-perfect-v1')?.session;
  if (!legacy?.game || legacy.game.status === 'won' ||
      (legacy.game.status === 'lost' && (legacy.mode === 'solo' || legacy.legs.length >= 4))) {
    return freshExam('exam');
  }
  return { ...legacy, start: Date.parse(legacy.date), variant: legacy.mode };
})();
if (exam.game.dart && exam.game.status === 'playing') inputMode = 'dart';
let mark = read('oche-active-mark');
let race = read('oche-active-race');

function storeValue(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { error = 'Could not save on this device. Keep this page open and try again.'; }
}

function archive(record) {
  const history = array(read('oche-unified-v1')).filter(s => s.mode !== record.mode || s.id !== record.id);
  storeValue('oche-unified-v1', [{ date: Date.now(), ...record }, ...history]);
}

function control(label, action, className = '') {
  const button = element('button', label);
  button.className = className;
  button.onclick = () => {
    error = '';
    try { action(); }
    catch (failure) { error = failure.message; }
    renderPractice(activeMode);
  };
  return button;
}

function group(className, ...children) {
  const node = document.createElement('div');
  node.className = className;
  node.append(...children);
  return node;
}

function hero(kicker, value, caption) {
  return group('practice-hero', element('p', kicker), element('h1', value), element('p', caption));
}

const scoringModes = { perfect: 'exam', solo: 'solo', '301': '301', ladder: 'ladder' };
const scoringDrafts = new Map();
function renderPractice(mode) {
  const variant = scoringModes[mode];
  if (activeMode !== mode) {
    if (scoringModes[activeMode]) scoringDrafts.set(exam.variant, { exam, undo, typed, inputMode });
    if (variant) {
      const draft = scoringDrafts.get(variant);
      const stored = read('oche-active-perfect-' + variant);
      const fallback = read('oche-active-perfect');
      exam = draft?.exam || stored || (fallback?.variant === variant ? fallback : exam.variant === variant ? exam : freshExam(variant));
      undo = draft?.undo || [];
      typed = draft?.typed || '';
      inputMode = draft?.inputMode || ((exam.game.dart && exam.game.status === 'playing') || read('oche-dart-default') ? 'dart' : 'total');
    }
    error = '';
  }
  activeMode = mode;
  const content = (variant ? perfectScreen : { mark: markScreen, race: raceScreen, counter: counterScreen }[mode])();
  const status = element('p', error);
  status.className = 'practice-status';
  status.setAttribute('role', 'status');
  if (feedbackMotion) content.classList.add(feedbackMotion);
  feedbackMotion = '';
  practice.replaceChildren(content, status);
}

function examTerminal() {
  return exam.variant !== 'ladder' && (exam.game.status === 'won' ||
    (exam.game.status === 'lost' && (exam.variant === 'solo' || exam.legs.length === 4)));
}

function examRecord(result, complete) {
  const legs = [...exam.legs, exam.game];
  return {
    id: exam.id, mode: 'perfect', result, complete, variant: exam.variant,
    assisted: exam.assisted, durationMs: exam.start ? Date.now() - exam.start : null,
    visits: sum(legs.map(leg => leg.visits.length)), attempts: legs.length,
    points: sum(legs.flatMap(leg => leg.visits.map(visit => visit.score))),
    darts: sum(legs.flatMap(leg => leg.throws.map(dart => dart.darts || 1))),
    highestCheckout: exam.variant === 'ladder' ? Math.max(0, ...legs.filter(leg => leg.status === 'won').map(leg => leg.visits[0].start)) : undefined
  };
}

function saveExam() {
  if (examTerminal()) archive(examRecord(exam.game.status === 'won' ? 'Cleared' : 'Failed', true));
  storeValue('oche-active-perfect-' + exam.variant, exam);
}

function score(next) {
  feedbackMotion = next.status === 'won' || next.visits.at(-1)?.score === 180 && next.visits.length > exam.game.visits.length ? 'milestone' : 'score-commit';
  undo.push(structuredClone(exam));
  exam.start ||= Date.now();
  exam.game = next;
  exam.assisted ||= !!read('oche-hints');
  typed = '';
  saveExam();
}

function undoScore() {
  if (!undo.length) return;
  const wasTerminal = examTerminal();
  exam = undo.pop();
  feedbackMotion = 'score-commit';
  if (wasTerminal) {
    storeValue('oche-unified-v1', array(read('oche-unified-v1')).filter(s => s.mode !== 'perfect' || s.id !== exam.id));
  }
  if (exam.game.dart && exam.game.status === 'playing') inputMode = 'dart';
  typed = '';
  saveExam();
}

function startExam(variant) {
  const hasProgress = exam.legs.length || exam.game.throws.length;
  if (hasProgress && !examTerminal()) {
    if (!confirm('End this practice and save it as incomplete?')) return;
    archive(examRecord('Incomplete', false));
  }
  exam = freshExam(variant);
  undo = [];
  typed = '';
  saveExam();
}

function perfectScreen() {
  const game = exam.game;
  const hints = !!read('oche-hints');
  const screen = group('practice-stack', hero(
    exam.variant === 'exam' ? `MOCK EXAM · ATTEMPT ${exam.legs.length + 1} / 5` : exam.variant === 'ladder' ? `121 CHECKOUT · TARGET ${exam.target}` : `SINGLE LEG · ${exam.variant === '301' ? '301' : '501'}`,
    game.remaining,
    `Round ${game.round}${exam.variant === "301" ? "" : " / " + (game.maxRounds ?? 8)} · Open in / double out · Split bull`
  ));
  if (game.status !== 'playing') {
    screen.append(group('practice-panel',
      element('h2', game.status === 'won' ? 'Cleared' : examTerminal() ? 'Practice complete' : 'Attempt ended'),
      control(examTerminal() ? 'New session' : exam.variant === 'ladder' ? `Next · ${game.status === 'won' ? exam.target + 1 : 121}` : 'Next attempt', () => {
        if (examTerminal()) startExam(exam.variant);
        else {
          undo.push(structuredClone(exam));
          exam.legs.push(game);
          if (exam.variant === 'ladder') exam.target = game.status === 'won' ? exam.target + 1 : 121;
          exam.game = gameFor(exam.variant, exam.target);
          saveExam();
        }
      }, 'primary')));
  } else {
    screen.append(group('control-row',
      control('Round total', () => {
        if (game.dart) throw new Error('Finish this visit before switching entry.');
        inputMode = 'total';
      }, inputMode === 'total' ? 'selected' : ''),
      control('Each dart', () => { inputMode = 'dart'; }, inputMode === 'dart' ? 'selected' : '')
    ));
    if (hints) {
      const hint = Darts.arrange(game.remaining, 3 - game.dart);
      const labels = hint.labels.join(' · ');
      screen.append(group('hint-strip', element('strong', hint.type === 'checkout' ? 'Checkout' : 'Setup'), element('span', hint.leave ? `${labels} → ${hint.leave} left` : labels || '—')));
    }
    if (inputMode === 'total') screen.append(totalPad(game, hints));
    else screen.append(dartPad(game, hints));
  }
  const undoButton = control('Undo', undoScore);
  undoButton.disabled = !undo.length;
  screen.append(group('control-row', undoButton,
    control(hints ? 'Hints on' : 'Hints off', () => {
      storeValue('oche-hints', !hints);
      if (!hints && game.status === 'playing') {
        exam.assisted = true;
        saveExam();
      }
    }),
    ...(exam.variant === 'ladder' ? [control('Save ladder', () => {
      if (!exam.legs.length && !game.visits.length) return;
      archive(examRecord('Ladder finished', true));
      exam = freshExam('ladder'); undo = []; typed = ''; saveExam();
    })] : []),
    control('Restart', () => startExam(exam.variant))
  ));
  if (game.visits.length) {
    const rounds = document.createElement('details');
    rounds.append(element('summary', 'This leg'));
    game.visits.forEach(visit => rounds.append(element('p', `Round ${visit.round} · ${visit.bust ? 'Bust' : visit.score} · ${visit.end} left`)));
    screen.append(rounds);
  }
  return screen;
}

function totalPad(game, hints) {
  const total = Number(typed);
  const enter = control('Record visit', () => score(Darts.visitTotal(game, total, { hinted: hints })), 'primary');
  enter.disabled = !typed;
  const panel = group('practice-panel',
    group('entry-readout', element('span', 'VISIT SCORE'), element('strong', typed || '0')),
    group('control-row quick-scores', ...[26, 60, 85, 100, 140].map(n => control(n, () => { typed = String(n); }))),
    group('score-grid', ...['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(key => {
      const button = control(key, () => {
        if (key === 'C') typed = '';
        else if (key === '⌫') typed = typed.slice(0, -1);
        else if (typed.length < 3) typed += key;
      });
      if (key === 'C') button.setAttribute('aria-label', 'Clear score');
      if (key === '⌫') button.setAttribute('aria-label', 'Delete last digit');
      return button;
    })),
    group('control-row', control('Bust', () => score(Darts.visitTotal(game, 0, { bust: true, hinted: hints }))), enter)
  );
  if (typed && total === game.remaining && Darts.route(total, 3)) {
    panel.append(element('p', 'Confirm double out'));
    panel.append(group('control-row', ...[1, 2, 3].filter(n => Darts.route(total, n)).map(n =>
      control(`${n} dart${n === 1 ? '' : 's'}`, () => score(Darts.visitTotal(game, total, { checkout: true, darts: n, hinted: hints })), 'selected')
    )));
  }
  return panel;
}

function dartPad(game, hints) {
  const record = label => score(Darts.throwDart(game, label, null, hints));
  return group('practice-panel',
    element('p', `Dart ${game.dart + 1} / 3`),
    group('control-row', ...[['S','Single'], ['D','Double'], ['T','Triple']].map(([key, label]) =>
      control(label, () => { multiplier = key; }, multiplier === key ? 'selected' : ''))),
    group('dart-grid', ...Array.from({ length: 20 }, (_, index) =>
      control(index + 1, () => record(multiplier + (index + 1))))),
    group('control-row', control('Miss', () => record('MISS')), control('Outer 25', () => record('25')), control('Bull 50', () => record('BULL'), 'selected'))
  );
}

function markScreen() {
  const index = mark?.splits.length || 0;
  const finished = index === phases.length;
  const target = phases[index];
  const elapsed = finished ? sum(mark.splits) : mark ? (mark.pausedAt || Date.now()) - mark.start : 0;
  const screen = group('practice-stack', hero(
    finished ? '13 / 13 COMPLETE' : `PHASE ${index + 1} / 13`,
    finished ? 'Finished' : target.startsWith('Bull') ? 'Bull' : target,
    finished ? 'Bull & Mark' : ''
  ));
  const timer = element('strong', duration(elapsed));
  timer.id = 'mark-clock';
  const clock = group('practice-panel drill-clock', element('span', 'SESSION TIME'), timer);
  if (mark && !finished && read('oche-show-lap') !== 0) {
    const lap = element('span', duration(Math.max(0, (mark.pausedAt || Date.now()) - mark.lap)));
    lap.id = 'lap-clock';
    clock.append(group('lap-clock-row', element('span', 'Current lap'), lap));
  }
  screen.append(clock);
  const advance = control(finished ? 'New drill' : !mark ? 'Start drill' : index === phases.length - 1 ? 'Finish drill' : 'Next phase', () => {
    const now = Date.now();
    if (!mark || finished) {
      mark = { id: crypto.randomUUID(), start: now, lap: now, splits: [] };
    } else {
      feedbackMotion = index === phases.length - 1 ? 'milestone' : 'lap-commit';
      mark.splits.push(Math.max(0, now - mark.lap));
      mark.lap = now;
    }
    if (mark.splits.length === phases.length) {
      archive({
        id: mark.id, mode: 'mark', result: 'Completed', complete: true,
        durationMs: sum(mark.splits),
        phaseTimes: phases.map((phase, i) => ({ target: phase, durationMs: mark.splits[i] }))
      });
    }
    storeValue('oche-active-mark', mark);
  }, 'primary big-action');
  advance.disabled = !!mark?.pausedAt;
  screen.append(advance);
  if (mark && !finished) screen.append(control(mark.pausedAt ? 'Resume timer' : 'Pause timer', () => {
    const now = Date.now();
    if (mark.pausedAt) {
      const pausedFor = now - mark.pausedAt;
      mark.start += pausedFor; mark.lap += pausedFor; delete mark.pausedAt;
    } else mark.pausedAt = now;
    storeValue('oche-active-mark', mark);
  }));
  if (mark?.splits.length) {
    const times = document.createElement('dl');
    times.className = 'lap-list';
    mark.splits.map((time, i) => [time, i]).reverse().forEach(([time, i]) => {
      times.append(element('dt', `Lap ${i + 1} · ${phases[i]}`), element('dd', duration(time)));
    });
    screen.append(group('lap-panel', element('h2', 'Laps'), times));
  }
  if (mark && !finished) screen.append(control('Discard run', () => {
    if (!confirm('Discard this run?')) return;
    mark = null;
    storeValue('oche-active-mark', mark);
  }, 'quiet-action'));
  return screen;
}

setInterval(() => {
  const clock = byId('mark-clock');
  if (current === 'practice' && activeMode === 'mark' && clock && mark && !mark.pausedAt && mark.splits.length < phases.length) {
    const now = Date.now();
    clock.textContent = duration(Math.max(0, now - mark.start));
    const lap = byId('lap-clock');
    if (lap) lap.textContent = duration(Math.max(0, now - mark.lap));
  }
}, 100);

let raceAudio;
function raceFeedback(bulls) {
  if (read('s_haptics') !== 0) navigator.vibrate?.(bulls ? 35 : 15);
  if (read('s_audio') === 0 || !window.AudioContext) return;
  try {
    raceAudio ||= new AudioContext();
    void raceAudio.resume().catch(() => {});
    const tone = raceAudio.createOscillator();
    const gain = raceAudio.createGain();
    tone.frequency.value = 260 + bulls * 150;
    gain.gain.setValueAtTime(0.08, raceAudio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, raceAudio.currentTime + 0.12);
    tone.connect(gain).connect(raceAudio.destination);
    tone.start();
    tone.stop(raceAudio.currentTime + 0.12);
  } catch {
    // Scoring remains available when browser audio is unavailable.
  }
}

function saveRace() {
  if (race.end) {
    const hits = sum(race.rounds);
    archive({
      id: race.id, mode: 'race', result: hits >= race.target ? 'Target reached' : 'Ended early',
      complete: hits >= race.target, hits, target: race.target, visits: race.rounds.length,
      durationMs: race.end - race.start, blanks: race.rounds.filter(n => n === 0).length,
      hatTricks: race.rounds.filter(n => n === 3).length, rounds: race.rounds
    });
  }
  storeValue('oche-active-race', race);
}

let counter = read('oche-active-counter') || { hits: 0, start: null };
function counterScreen() {
  const save = () => storeValue('oche-active-counter', counter);
  const screen = group('practice-stack', hero('BULL COUNTER', counter.hits, 'Tap once for each bull'),
    control('+1 Bull', () => { counter.start ||= Date.now(); counter.hits++; feedbackMotion = 'score-commit'; save(); raceFeedback(1); }, 'big-action counter-button'));
  const undo = control('Undo', () => { counter.hits--; save(); });
  const end = control('Save & reset', () => {
    archive({ id: crypto.randomUUID(), mode: 'race', variant: 'counter', result: 'Count saved', complete: true, hits: counter.hits, durationMs: Date.now() - counter.start });
    counter = { hits: 0, start: null }; save();
  });
  undo.disabled = end.disabled = !counter.hits;
  screen.append(group('control-row', undo, end));
  return screen;
}

function raceScreen() {
  const target = race?.target || read('s_target') || 50;
  const rounds = race?.rounds || [];
  const hits = sum(rounds);
  const screen = group('practice-stack', hero(
    race?.end ? (hits >= target ? 'TARGET REACHED' : 'SESSION ENDED') : `RACE TO ${target}`,
    hits, `${Math.max(0, target - hits)} bulls to go`
  ));
  const progress = document.createElement('progress');
  progress.max = target;
  progress.value = hits;
  progress.setAttribute('aria-label', 'Bull Race progress');
  screen.append(progress, group('race-stats',
    group('practice-panel', element('strong', rounds.length), element('span', 'Visits')),
    group('practice-panel', element('strong', rounds.length ? (hits / rounds.length).toFixed(2) : '—'), element('span', 'Bulls / visit')),
    group('practice-panel', element('strong', rounds.filter(n => n === 3).length), element('span', 'Hat tricks'))
  ));
  if (race?.end) {
    screen.append(control('New race', () => {
      race = null;
      storeValue('oche-active-race', null);
    }, 'primary big-action'));
  } else {
    screen.append(element('p', 'Bulls this visit'));
    screen.append(group('race-pad', ...[0, 1, 2, 3].map(n => control(n, () => {
      race ||= { id: crypto.randomUUID(), start: Date.now(), target, rounds: [], end: null };
      race.rounds.push(n);
      if (sum(race.rounds) >= target) race.end = Date.now();
      feedbackMotion = race.end || n === 3 ? 'milestone' : 'score-commit';
      saveRace();
      raceFeedback(n);
    }))));
    const undoVisit = control('Undo visit', () => {
      race.rounds.pop();
      if (!race.rounds.length) race = null;
      storeValue('oche-active-race', race);
    });
    const end = control('End race', () => {
      if (!confirm('End this race and save your visits?')) return;
      race.end = Date.now();
      saveRace();
    });
    undoVisit.disabled = end.disabled = !rounds.length;
    screen.append(group('control-row', undoVisit, end));
  }
  return screen;
}
