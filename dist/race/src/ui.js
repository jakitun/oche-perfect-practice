/*
 * ui.js — ALL rendering, DOM updates, and chart drawing
 *
 * Owns (exposed on window where called from HTML or other files):
 *   Mode:       applyModeClass()
 *   Flash:      flashBtn(), getBullFlashClass(), handleBullTap(), handleCricketTap()
 *   Fast update: updateStats(), punchScore(), cycleMetric()
 *   Settings:   openSettings(), closeSettings(), toggleSetting(), buildToggleRow()
 *   Charts:     renderSessionChart(), renderMacroChart(), renderMicroChart(), toggleMicroChart()
 *   Helpers:    headerBarHTML(), buildBullGrid(), buildCricketNumpad(), buildTargetStrip()
 *   Render:     render()
 *
 * Rule: if it touches the DOM or builds HTML strings — it lives here.
 * Does NOT own: localStorage, business logic, data transformation
 */

window.smoothArray = function(data) {
  if (!data || data.length < 3) return data;
  var out = [data[0]];
  for (var i = 1; i < data.length - 1; i++) {
    out.push(0.25 * data[i - 1] + 0.5 * data[i] + 0.25 * data[i + 1]);
  }
  out.push(data[data.length - 1]);
  return out;
};

// ─── Module-level variables ───────────────────────────────────────────────────

var metricMode          = 0;      // 0=BPR/MPR, 1=Hit%(bull only), 2=blank
var insightHistoryTab   = 'bull'; // active tab on insights history list
var growthChartExpanded = false;  // growth chart section collapsed by default
var sessionChartInst    = null;   // Chart.js instance for summary chart
var macroChartInst      = null;   // Chart.js instance for macro growth chart
var microChartInst      = null;   // Chart.js instance for micro history card chart
var openMicroIndex      = -1;     // which history card has its chart expanded

// ─── applyModeClass ───────────────────────────────────────────────────────────

window.applyModeClass = function() {
  if (window.appMode === 'cricket') {
    document.body.classList.add('mode-cricket');
  } else {
    document.body.classList.remove('mode-cricket');
  }
};

// ─── Flash helpers ────────────────────────────────────────────────────────────

window.flashBtn = function(btn, cssClass) {
  if (!btn) return;
  btn.classList.add(cssClass);
  setTimeout(function() { btn.classList.remove(cssClass); }, 140);
};

window.getBullFlashClass = function(val) {
  if (val === 0) return 'flash-0';
  if (val === 1) return 'flash-1';
  if (val === 2) return 'flash-2';
  return 'flash-3';
};

// Called by bull button handlers — flash lives here, not in logic.js
window.handleBullTap = function(val, btn) {
  tapBull(val);
  flashBtn(btn, getBullFlashClass(val));
};

// Called by cricket button handlers
window.handleCricketTap = function(marks, btn) {
  tapCricket(marks);
  flashBtn(btn, marks === 0 ? 'flash-c-miss' : 'flash-c-hit');
};

// ─── updateStats ─────────────────────────────────────────────────────────────

window.updateStats = function() {
  var isBull = window.appMode === 'bull';
  var score  = isBull ? getTotalBulls()      : getTotalMarks();
  var rounds = isBull ? window.rounds.length : window.cricketRounds.length;

  // Score display — punch only when value actually changes
  var scoreEl = document.getElementById('score-display');
  if (scoreEl) {
    var prev = parseInt(scoreEl.textContent, 10);
    if (isNaN(prev) || prev !== score) {
      scoreEl.textContent = score;
      punchScore();
    }
  }

  // Rounds counter
  var roundsEl = document.getElementById('rounds-value');
  if (roundsEl) { roundsEl.textContent = rounds; }

  // Undo button state
  var undoBtn = document.getElementById('undo-btn');
  if (undoBtn) {
    var hasData = isBull ? window.rounds.length > 0 : window.cricketRounds.length > 0;
    if (hasData) {
      undoBtn.classList.remove('btn-disabled');
    } else {
      undoBtn.classList.add('btn-disabled');
    }
  }

  // Metric band visibility
  var leftEl  = document.getElementById('metric-left');
  var rightEl = document.getElementById('metric-right');
  if (leftEl)  { leftEl.style.visibility  = window.settings.zenMode ? 'hidden' : ''; }
  if (rightEl) { rightEl.style.visibility = window.settings.zenMode ? 'hidden' : ''; }
  if (window.settings.zenMode) { return; }

  // Metric label + value
  var metricLabelEl = document.getElementById('metric-label');
  var metricValueEl = document.getElementById('metric-value');
  if (!metricLabelEl || !metricValueEl) { return; }

  if (metricMode === 2) {
    metricLabelEl.textContent = '';
    metricValueEl.textContent = '—';
  } else if (metricMode === 1 && isBull) {
    metricLabelEl.textContent = 'HIT%';
    metricValueEl.textContent = rounds === 0 ? '—' : Math.round(getHitPercent()) + '%';
  } else {
    metricLabelEl.textContent = isBull ? 'BPR' : 'MPR';
    var rate = isBull ? getBPR() : getCricketMPR();
    metricValueEl.textContent = rounds === 0 ? '—' : rate.toFixed(2);
  }
};

// ─── punchScore ───────────────────────────────────────────────────────────────

window.punchScore = function() {
  var el = document.getElementById('score-display');
  if (!el) return;
  el.classList.remove('score-punch');
  void el.offsetWidth; // force reflow so animation restarts
  el.classList.add('score-punch');
};

// ─── cycleMetric ──────────────────────────────────────────────────────────────

window.cycleMetric = function() {
  if (window.appMode === 'bull') {
    metricMode = (metricMode + 1) % 3; // 0→1→2→0
  } else {
    metricMode = metricMode === 0 ? 2 : 0; // cricket: 0→2→0 (no Hit%)
  }
  updateStats();
};

// ─── Settings modal ───────────────────────────────────────────────────────────

window.buildToggleRow = function(label, sublabel, key) {
  var isOn = window.settings[key];
  return '<div class="settings-row">'
    + '<div class="settings-row-text">'
    + '<div class="settings-label font-label">' + label + '</div>'
    + (sublabel ? '<div class="settings-sublabel">' + sublabel + '</div>' : '')
    + '</div>'
    + '<button class="toggle-btn' + (isOn ? ' toggle-on' : '') + '"'
    + ' ontouchstart="toggleSetting(\'' + key + '\');event.preventDefault()"'
    + ' onclick="toggleSetting(\'' + key + '\')">'
    + '<span class="toggle-thumb"></span>'
    + '</button>'
    + '</div>';
};

window.buildSettingsModal = function() {
  return '<div class="settings-backdrop"'
    + ' ontouchstart="closeSettings();event.preventDefault()" onclick="closeSettings()"></div>'
    + '<div class="settings-sheet">'
    + '<div class="settings-handle"></div>'
    + '<div class="settings-header">'
    + '<span class="settings-title font-label">SETTINGS</span>'
    + '<button class="settings-close" onclick="closeSettings()">✕</button>'
    + '</div>'
    + '<div class="settings-body">'
    + '<div class="settings-section-title font-label">PREFERENCES</div>'
    + '<div class="settings-row">'
    + '<div class="settings-row-text"><div class="settings-label font-label">NICKNAME</div></div>'
    + '<input type="text" class="settings-text-input" value="' + window.settings.nickname + '"'
    + ' onchange="window.settings.nickname=this.value.trim()||\'Player 1\';saveSettings()"'
    + ' onblur="window.settings.nickname=this.value.trim()||\'Player 1\';saveSettings()"'
    + ' onkeydown="if(event.key===\'Enter\'){window.settings.nickname=this.value.trim()||\'Player 1\';saveSettings();this.blur()}"'
    + ' />'
    + '</div>'
    + buildToggleRow('AUDIO', '', 'audio')
    + buildToggleRow('HAPTICS', '', 'haptics')
    + buildToggleRow('ZEN MODE', 'Hides BPR/MPR and rounds counter', 'zenMode')
    + '<div class="settings-section-title font-label">SESSION DEFAULTS</div>'
    + '<div class="settings-row">'
    + '<div class="settings-row-text">'
    + '<div class="settings-label font-label">BULL TARGET</div>'
    + '<div class="settings-sublabel">Session ends when bulls hit this number</div>'
    + '</div>'
    + '<input type="number" class="settings-num-input" min="1" max="999"'
    + ' value="' + window.settings.defaultTarget + '"'
    + ' onchange="window.settings.defaultTarget=Math.min(999,Math.max(1,parseInt(this.value,10)||50));saveSettings()"'
    + ' />'
    + '</div>'
    + '<div class="settings-row">'
    + '<div class="settings-row-text">'
    + '<div class="settings-label font-label">ROUNDS PER TARGET</div>'
    + '<div class="settings-sublabel">How many visits per target drill</div>'
    + '</div>'
    + '<input type="number" class="settings-num-input" min="1" max="999"'
    + ' value="' + window.settings.cricketRounds + '"'
    + ' onchange="window.settings.cricketRounds=Math.min(999,Math.max(1,parseInt(this.value,10)||10));saveSettings()"'
    + ' />'
    + '</div>'
    + '</div>'
    + '</div>';
};

window.openSettings = function() {
  var el = document.getElementById('settings-modal');
  if (!el) return;
  el.innerHTML = buildSettingsModal();
  el.classList.add('open');
};

window.closeSettings = function() {
  var el = document.getElementById('settings-modal');
  if (!el) return;
  el.classList.remove('open');
  updateStats();
};

window.toggleSetting = function(key) {
  window.settings[key] = !window.settings[key];
  saveSettings();
  openSettings();
};

// ─── Chart renderers ──────────────────────────────────────────────────────────

window.renderSessionChart = function(canvasId, rawRounds, isBullTarget) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (sessionChartInst) { sessionChartInst.destroy(); sessionChartInst = null; }
  var yMax       = isBullTarget ? 3 : (window.cricketTarget === 'B' ? 6 : 9);
  var lineColor  = isBullTarget ? 'rgba(249,115,22,0.85)' : 'rgba(168,85,247,0.85)';
  var trendBorder = isBullTarget ? 'rgba(251,191,36,0.75)' : 'rgba(216,180,254,0.75)';
  var glowColor   = isBullTarget ? 'rgba(251,191,36,0.45)' : 'rgba(216,180,254,0.45)';
  var grad = canvas.getContext('2d').createLinearGradient(0, 0, 0, canvas.offsetHeight || 200);
  grad.addColorStop(0, isBullTarget ? 'rgba(251,191,36,0.10)' : 'rgba(216,180,254,0.10)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  var labels = [];
  for (var i = 0; i < rawRounds.length; i++) { labels.push(i + 1); }
  var datasets = [{
    data:                 rawRounds,
    borderColor:          lineColor,
    borderWidth:          2,
    pointRadius:          3,
    pointBackgroundColor: lineColor,
    tension:              0.3,
    fill:                 false,
    order:                1
  }];
  var maRaw      = movingAverage(rawRounds);
  var maSmoothed = maRaw ? smoothArray(maRaw) : null;
  if (maSmoothed) {
    datasets.push({
      data:            maSmoothed,
      borderColor:     trendBorder,
      borderWidth:     1.5,
      pointRadius:     0,
      fill:            true,
      backgroundColor: grad,
      tension:         0.5,
      borderCapStyle:  'round',
      borderJoinStyle: 'round',
      order:           2
    });
  }
  var glowPlugin = {
    id: 'trendGlow',
    beforeDatasetDraw: function(chart, args) {
      if (args.index !== 1) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.shadowColor   = glowColor;
      ctx.shadowBlur    = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    },
    afterDatasetDraw: function(chart, args) {
      if (args.index !== 1) return;
      chart.ctx.restore();
    }
  };
  sessionChartInst = new Chart(canvas, {
    type:    'line',
    plugins: [glowPlugin],
    data:    { labels: labels, datasets: datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           { duration: 400 },
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          min:    0,
          max:    yMax,
          ticks:  { color: '#6b6b6b', stepSize: 1 },
          grid:   { color: 'rgba(255,255,255,0.05)' },
          border: { color: 'transparent' }
        }
      }
    }
  });
};

window.renderMacroChart = function(canvasId, historyArr, isCricket) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (macroChartInst) { macroChartInst.destroy(); macroChartInst = null; }
  if (!historyArr || historyArr.length === 0) return;
  var lineColor  = isCricket ? 'rgba(168,85,247,0.85)' : 'rgba(249,115,22,0.85)';
  var trendColor = isCricket ? 'rgba(168,85,247,0.4)'  : 'rgba(249,115,22,0.4)';
  var vals       = [];
  var labels     = [];
  for (var i = 0; i < historyArr.length; i++) {
    vals.push(isCricket ? historyArr[i].mpr : historyArr[i].bpr);
    labels.push(i + 1);
  }
  var datasets = [{
    data:                 vals,
    borderColor:          lineColor,
    borderWidth:          2,
    pointRadius:          3,
    pointBackgroundColor: lineColor,
    tension:              0.3,
    fill:                 false
  }];
  var trendDs = makeTrendDataset(vals, trendColor);
  if (trendDs) { datasets.push(trendDs); }
  macroChartInst = new Chart(canvas, {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           { duration: 400 },
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          ticks:  { color: '#6b6b6b' },
          grid:   { color: 'rgba(255,255,255,0.05)' },
          border: { color: 'transparent' }
        }
      }
    }
  });
};

window.renderMicroChart = function(canvasId, rawRounds, isBullTarget, yMaxOverride) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (microChartInst) { microChartInst.destroy(); microChartInst = null; }
  var yMax        = yMaxOverride !== undefined ? yMaxOverride : (isBullTarget ? 3 : 9);
  var lineColor   = isBullTarget ? 'rgba(249,115,22,0.85)' : 'rgba(168,85,247,0.85)';
  var trendBorder = isBullTarget ? 'rgba(251,191,36,0.75)'  : 'rgba(216,180,254,0.75)';
  var glowColor   = isBullTarget ? 'rgba(251,191,36,0.45)'  : 'rgba(216,180,254,0.45)';
  var grad = canvas.getContext('2d').createLinearGradient(0, 0, 0, canvas.offsetHeight || 200);
  grad.addColorStop(0, isBullTarget ? 'rgba(251,191,36,0.10)' : 'rgba(216,180,254,0.10)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  var labels = [];
  for (var i = 0; i < rawRounds.length; i++) { labels.push(i + 1); }
  var datasets = [{
    data:                 rawRounds,
    borderColor:          lineColor,
    borderWidth:          2,
    pointRadius:          2,
    pointBackgroundColor: lineColor,
    tension:              0.3,
    fill:                 false,
    order:                1
  }];
  var maRaw      = movingAverage(rawRounds);
  var maSmoothed = maRaw ? smoothArray(maRaw) : null;
  if (maSmoothed) {
    datasets.push({
      data:            maSmoothed,
      borderColor:     trendBorder,
      borderWidth:     1.5,
      pointRadius:     0,
      fill:            true,
      backgroundColor: grad,
      tension:         0.5,
      borderCapStyle:  'round',
      borderJoinStyle: 'round',
      order:           2
    });
  }
  var glowPlugin = {
    id: 'trendGlow',
    beforeDatasetDraw: function(chart, args) {
      if (args.index !== 1) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.shadowColor   = glowColor;
      ctx.shadowBlur    = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    },
    afterDatasetDraw: function(chart, args) {
      if (args.index !== 1) return;
      chart.ctx.restore();
    }
  };
  microChartInst = new Chart(canvas, {
    type:    'line',
    plugins: [glowPlugin],
    data:    { labels: labels, datasets: datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           { duration: 200 },
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          min:    0,
          max:    yMax,
          ticks:  { color: '#6b6b6b', stepSize: 1 },
          grid:   { color: 'rgba(255,255,255,0.05)' },
          border: { color: 'transparent' }
        }
      }
    }
  });
};

window.toggleMicroChart = function(index) {
  if (openMicroIndex === index) {
    openMicroIndex = -1;
    var el = document.getElementById('micro-chart-' + index);
    if (el) { el.style.display = 'none'; }
    if (microChartInst) { microChartInst.destroy(); microChartInst = null; }
    return;
  }
  if (openMicroIndex !== -1) {
    var prev = document.getElementById('micro-chart-' + openMicroIndex);
    if (prev) { prev.style.display = 'none'; }
    if (microChartInst) { microChartInst.destroy(); microChartInst = null; }
  }
  openMicroIndex = index;
  var container = document.getElementById('micro-chart-' + index);
  if (!container) return;
  container.style.display = 'block';
  var isBull  = insightHistoryTab === 'bull';
  var arr     = isBull ? window.ocheHistory : window.cricketHistory;
  if (!arr || !arr[index]) return;
  var record  = arr[index];
  var yMax    = isBull ? 3 : (record.target === 'B' ? 6 : 9);
  renderMicroChart('micro-canvas-' + index, record.rawRounds, isBull, yMax);
};

// ─── Render helpers & action handlers ────────────────────────────────────────

window.setMode = function(mode) {
  if (mode === window.appMode) return;
  if (window.currentView === 'summary') {
    window.rounds           = [];
    window.cricketRounds    = [];
    window.sessionStartTime = null;
    window.currentView      = 'practice';
    window.appMode          = mode;
    saveMode();
    applyModeClass();
    render();
    return;
  }
  var isBull  = window.appMode === 'bull';
  var hasData = isBull ? window.rounds.length > 0 : window.cricketRounds.length > 0;
  if (hasData && !confirm('Switch mode? Current session will be lost.')) return;
  window.rounds        = [];
  window.cricketRounds = [];
  window.sessionStartTime = null;
  window.appMode = mode;
  saveMode();
  applyModeClass();
  render();
};

window.confirmEndSession = function() {
  var isBull  = window.appMode === 'bull';
  var hasData = isBull ? window.rounds.length > 0 : window.cricketRounds.length > 0;
  if (!hasData) { restartSession(); return; }
  if (confirm('End session?')) { endSession(); }
};

window.confirmCricketTarget = function(target) {
  if (target === window.cricketTarget) return;
  if (window.cricketRounds.length > 0) {
    if (!confirm('Change target? Current session will be lost.')) return;
  }
  selectCricketTarget(target);
  render();
};

window.switchInsightTab = function(tab) {
  insightHistoryTab = tab;
  if (microChartInst) { microChartInst.destroy(); microChartInst = null; }
  openMicroIndex = -1;
  render();
};

window.toggleGrowthChart = function() {
  growthChartExpanded = !growthChartExpanded;
  render();
};

window.startEditNickname = function() {
  window.editingNickname = true;
  render();
};

window.saveNickname = function(val) {
  window.settings.nickname = val ? val.trim() || 'Player 1' : 'Player 1';
  window.editingNickname   = false;
  saveSettings();
  render();
};

window.deleteSession = function(index) {
  var isBull = insightHistoryTab === 'bull';
  if (isBull) {
    window.ocheHistory.splice(index, 1);
    saveHistory();
  } else {
    window.cricketHistory.splice(index, 1);
    saveCricketHistory();
  }
  if (microChartInst) { microChartInst.destroy(); microChartInst = null; }
  openMicroIndex = -1;
  render();
};

window.clearHistory = function() {
  var isBull = insightHistoryTab === 'bull';
  if (!confirm('Clear all ' + (isBull ? 'bull' : 'cricket') + ' history?')) return;
  if (isBull) {
    window.ocheHistory = [];
    saveHistory();
  } else {
    window.cricketHistory = [];
    saveCricketHistory();
  }
  if (microChartInst) { microChartInst.destroy(); microChartInst = null; }
  openMicroIndex = -1;
  render();
};

window.openBackupMenu = function() {
  var choice = confirm('OK = Export backup\nCancel = Import backup');
  if (choice) {
    exportBackup();
  } else {
    var input = document.getElementById('import-input');
    if (input) { input.click(); }
  }
};

window.handleImport = function(inputEl) {
  if (!inputEl.files || !inputEl.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    if (!importBackup(e.target.result)) { alert('Invalid backup file.'); }
  };
  reader.readAsText(inputEl.files[0]);
};

window.headerBarHTML = function() {
  if (window.currentView === 'insights') {
    return '<div class="top-bar">'
      + '<button class="btn-back font-label"'
      + ' ontouchstart="window.currentView=\'practice\';render();event.preventDefault()"'
      + ' onclick="window.currentView=\'practice\';render()">← BACK</button>'
      + '<span class="top-bar-title font-label">INSIGHTS</span>'
      + '<button class="btn-icon"'
      + ' ontouchstart="openBackupMenu();event.preventDefault()"'
      + ' onclick="openBackupMenu()">⬇</button>'
      + '</div>';
  }
  var isBull = window.appMode === 'bull';
  return '<div class="top-bar">'
    + '<div class="mode-pill">'
    + '<button class="mode-btn' + (isBull ? ' mode-active' : '') + '"'
    + ' ontouchstart="setMode(\'bull\');event.preventDefault()" onclick="setMode(\'bull\')"'
    + '>BULL</button>'
    + '<button class="mode-btn' + (!isBull ? ' mode-active' : '') + '"'
    + ' ontouchstart="setMode(\'cricket\');event.preventDefault()" onclick="setMode(\'cricket\')"'
    + '>CRICKET</button>'
    + '</div>'
    + '<div class="top-bar-icons">'
    + '<button class="btn-icon"'
    + ' ontouchstart="window.currentView=\'insights\';render();event.preventDefault()"'
    + ' onclick="window.currentView=\'insights\';render()">◎</button>'
    + '<button class="btn-icon"'
    + ' ontouchstart="openSettings();event.preventDefault()"'
    + ' onclick="openSettings()">⚙</button>'
    + '</div>'
    + '</div>';
};

window.buildBullGrid = function() {
  var html = '<div class="bull-grid">';
  for (var v = 0; v <= 3; v++) {
    html += '<button class="btn-tap"'
      + ' ontouchstart="handleBullTap(' + v + ',this);event.preventDefault()"'
      + ' onclick="handleBullTap(' + v + ',this)">'
      + v
      + '</button>';
  }
  html += '</div>';
  return html;
};

window.buildCricketNumpad = function() {
  var isBullTarget = window.cricketTarget === 'B';
  var rows = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  var html = '<div class="cricket-numpad">';
  for (var r = 0; r < rows.length; r++) {
    html += '<div class="numpad-row">';
    for (var c = 0; c < rows[r].length; c++) {
      var m        = rows[r][c];
      var disabled = isBullTarget && (m === 7 || m === 8 || m === 9);
      html += '<button class="btn-cricket' + (disabled ? ' btn-disabled' : '') + '"'
        + (disabled ? ' disabled' : '')
        + (disabled ? '' : ' ontouchstart="handleCricketTap(' + m + ',this);event.preventDefault()"')
        + (disabled ? '' : ' onclick="handleCricketTap(' + m + ',this)"')
        + '>'
        + m
        + '</button>';
    }
    html += '</div>';
  }
  html += '<div class="numpad-row numpad-row-zero">'
    + '<button class="btn-cricket btn-cricket-zero"'
    + ' ontouchstart="handleCricketTap(0,this);event.preventDefault()"'
    + ' onclick="handleCricketTap(0,this)">0</button>'
    + '</div>';
  html += '</div>';
  return html;
};

window.buildTargetStrip = function() {
  var html = '<div class="target-strip">';
  for (var i = 0; i < window.CRICKET_TARGETS.length; i++) {
    var t      = window.CRICKET_TARGETS[i];
    var active = t === window.cricketTarget;
    html += '<button class="target-item' + (active ? ' target-active' : '') + '"'
      + ' ontouchstart="confirmCricketTarget(\'' + t + '\');event.preventDefault()"'
      + ' onclick="confirmCricketTarget(\'' + t + '\')">'
      + t
      + '</button>';
  }
  html += '</div>';
  return html;
};

// ─── Render ───────────────────────────────────────────────────────────────────

function renderPractice() {
  var isBull       = window.appMode === 'bull';
  var score        = isBull ? getTotalBulls()      : getTotalMarks();
  var rounds       = isBull ? window.rounds.length : window.cricketRounds.length;
  var undoDisabled = rounds === 0;

  var metricLabel = '', metricValue = '—';
  if (metricMode === 2) {
    metricLabel = '';
    metricValue = '—';
  } else if (metricMode === 1 && isBull) {
    metricLabel = 'HIT%';
    metricValue = rounds === 0 ? '—' : Math.round(getHitPercent()) + '%';
  } else {
    metricLabel = isBull ? 'BPR' : 'MPR';
    var rate    = isBull ? getBPR() : getCricketMPR();
    metricValue = rounds === 0 ? '—' : rate.toFixed(2);
  }

  var metricBand = '<div id="metric-band" class="metric-band">'
    + '<div id="metric-left" class="metric-left"'
    + (window.settings.zenMode ? ' style="visibility:hidden"' : '')
    + ' ontouchstart="cycleMetric();event.preventDefault()" onclick="cycleMetric()">'
    + '<div id="metric-label" class="metric-label font-label">' + metricLabel + '</div>'
    + '<div id="metric-value" class="metric-value score-display">' + metricValue + '</div>'
    + '</div>'
    + '<div id="score-display" class="score-hero">' + score + '</div>'
    + '<div id="metric-right" class="metric-right"'
    + (window.settings.zenMode ? ' style="visibility:hidden"' : '') + '>'
    + '<div class="metric-r-label font-label">R</div>'
    + '<div id="rounds-value" class="metric-r-value score-display">' + rounds + '</div>'
    + '</div>'
    + '</div>';

  var inputArea = isBull
    ? buildBullGrid()
    : (buildTargetStrip() + buildCricketNumpad());

  return headerBarHTML()
    + metricBand
    + inputArea
    + '<div class="bottom-bar">'
    + '<button id="undo-btn" class="btn-undo' + (undoDisabled ? ' btn-disabled' : '') + '"'
    + ' ontouchstart="undoLast();event.preventDefault()" onclick="undoLast()"'
    + '>↩</button>'
    + '<button class="btn-end font-label"'
    + ' ontouchstart="confirmEndSession();event.preventDefault()"'
    + ' onclick="confirmEndSession()">END</button>'
    + '</div>';
}

function renderSummary() {
  var isBull    = window.appMode === 'bull';
  var heroVal   = isBull
    ? (window.rounds.length === 0 ? '0.00' : getBPR().toFixed(2))
    : (window.cricketRounds.length === 0 ? '0.00' : getCricketMPR().toFixed(2));
  var heroLabel = isBull ? 'BPR' : 'MPR';

  var s1l, s1v, s2l, s2v, s3l, s3v;
  if (isBull) {
    s1l = 'BULLS';  s1v = getTotalBulls();
    s2l = 'ROUNDS'; s2v = window.rounds.length;
    s3l = 'TIME';   s3v = getSessionDuration();
  } else {
    s1l = 'MARKS';  s1v = getTotalMarks();
    s2l = 'ROUNDS'; s2v = window.cricketRounds.length;
    s3l = 'TARGET'; s3v = window.cricketTarget;
  }

  return headerBarHTML()
    + '<div class="summary-content">'
    + '<div class="hero-section">'
    + '<div class="hero-label font-label">' + heroLabel + '</div>'
    + '<div id="score-display" class="score-hero">' + heroVal + '</div>'
    + '</div>'
    + '<div class="stat-boxes">'
    + '<div class="stat-box">'
    + '<div class="stat-box-label font-label">' + s1l + '</div>'
    + '<div class="stat-box-val score-display">' + s1v + '</div>'
    + '</div>'
    + '<div class="stat-box">'
    + '<div class="stat-box-label font-label">' + s2l + '</div>'
    + '<div class="stat-box-val score-display">' + s2v + '</div>'
    + '</div>'
    + '<div class="stat-box">'
    + '<div class="stat-box-label font-label">' + s3l + '</div>'
    + '<div class="stat-box-val score-display">' + s3v + '</div>'
    + '</div>'
    + '</div>'
    + '<div class="chart-wrap"><canvas id="session-chart"></canvas></div>'
    + '<div class="bottom-bar">'
    + '<button class="btn-secondary font-label"'
    + ' ontouchstart="restartSession();event.preventDefault()"'
    + ' onclick="restartSession()">RESTART</button>'
    + '<button class="btn-primary font-label"'
    + ' ontouchstart="window.currentView=\'insights\';render();event.preventDefault()"'
    + ' onclick="window.currentView=\'insights\';render()">STATS</button>'
    + '</div>'
    + '</div>';
}

function buildHistoryCard(record, index, isBull) {
  var rateVal   = isBull ? record.bpr.toFixed(2) : record.mpr.toFixed(2);
  var rateLabel = isBull ? 'BPR' : 'MPR';
  var summaryLine = isBull
    ? (record.bulls + '/' + record.target + ' BULLS · ' + record.rounds + ' ROUNDS')
    : (record.marks + ' MARKS · ' + record.rounds + ' ROUNDS · TARGET ' + record.target);

  var breakdownHtml = '';
  if (isBull) {
    breakdownHtml = '<div class="breakdown-row">'
      + '<span class="bd-miss">'   + record.miss   + ' MISS</span>'
      + '<span class="bd-single">' + record.single + ' SINGLE</span>'
      + '<span class="bd-tons">'   + record.tons   + ' TONS</span>'
      + '<span class="bd-hats">'   + record.hats   + ' HATS</span>'
      + '</div>';
  }

  var microOpen = openMicroIndex === index;
  var microHtml = '<div id="micro-chart-' + index + '" class="micro-chart-wrap"'
    + ' style="display:' + (microOpen ? 'block' : 'none') + '">'
    + '<canvas id="micro-canvas-' + index + '" height="80"></canvas>'
    + '</div>';

  return '<div class="history-card">'
    + '<div class="card-header">'
    + '<span class="card-meta">' + record.date + ' ' + record.time + ' · ' + record.duration + '</span>'
    + '<div class="card-actions">'
    + '<button class="btn-micro" onclick="toggleMicroChart(' + index + ')">'
    + '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<polyline points="1,12 5,7 8,9 11,4 15,6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>'
    + '</button>'
    + '<button class="btn-del" onclick="deleteSession(' + index + ')">✕</button>'
    + '</div>'
    + '</div>'
    + '<div class="card-rate">'
    + '<span class="card-rate-val score-display" style="color:' + (isBull ? '#f97316' : '#a855f7') + '">' + rateVal + '</span>'
    + '<span class="card-rate-label font-label"> ' + rateLabel + '</span>'
    + '</div>'
    + '<div class="card-summary font-label">' + summaryLine + '</div>'
    + breakdownHtml
    + microHtml
    + '</div>';
}

function renderInsights() {
  var isBull  = insightHistoryTab === 'bull';
  var arr     = isBull ? window.ocheHistory : window.cricketHistory;
  var allBPR  = getAllTimeBPR();
  var allMPR  = getAllTimeMPR();
  var sesTime = getTotalSessionTime();

  var nicknameHtml = window.editingNickname
    ? ('<input type="text" id="nickname-input" class="nickname-input"'
      + ' value="' + window.settings.nickname + '"'
      + ' onblur="saveNickname(this.value)"'
      + ' onkeydown="if(event.key===\'Enter\'){saveNickname(this.value)}"'
      + ' autofocus />')
    : ('<div class="nickname-display font-label" onclick="startEditNickname()">'
      + window.settings.nickname
      + '</div>');

  var profileCard = '<div class="profile-card">'
    + nicknameHtml
    + '<div class="profile-stats">'
    + '<div class="profile-stat">'
    + '<div class="profile-stat-val score-display" style="color:#f97316">' + allBPR.toFixed(2) + '</div>'
    + '<div class="profile-stat-label font-label">ALL-TIME BPR</div>'
    + '</div>'
    + '<div class="profile-stat">'
    + '<div class="profile-stat-val score-display" style="color:#a855f7">' + allMPR.toFixed(2) + '</div>'
    + '<div class="profile-stat-label font-label">ALL-TIME MPR</div>'
    + '</div>'
    + '<div class="profile-stat">'
    + '<div class="profile-stat-val score-display">' + sesTime + '</div>'
    + '<div class="profile-stat-label font-label">SESSION TIME</div>'
    + '</div>'
    + '</div>'
    + '<div class="growth-toggle font-label"'
    + ' ontouchstart="toggleGrowthChart();event.preventDefault()"'
    + ' onclick="toggleGrowthChart()">'
    + (growthChartExpanded ? '▲' : '▼') + ' GROWTH CHART'
    + '</div>'
    + (growthChartExpanded
      ? '<div class="growth-chart-wrap"><canvas id="macro-chart" height="140"></canvas></div>'
      : '')
    + '</div>';

  var tabsHtml = '<div class="history-tabs">'
    + '<button class="tab-btn' + (isBull ? ' tab-active' : '') + '"'
    + ' onclick="switchInsightTab(\'bull\')">BULL</button>'
    + '<button class="tab-btn' + (!isBull ? ' tab-active' : '') + '"'
    + ' onclick="switchInsightTab(\'cricket\')">CRICKET</button>'
    + '</div>';

  var cardsHtml = '';
  if (arr.length === 0) {
    cardsHtml = '<div class="no-history font-label">No sessions recorded yet</div>';
  } else {
    for (var i = arr.length - 1; i >= 0; i--) {
      cardsHtml += buildHistoryCard(arr[i], i, isBull);
    }
  }

  return headerBarHTML()
    + '<div class="insights-scroll">'
    + profileCard
    + tabsHtml
    + '<div class="history-list">' + cardsHtml + '</div>'
    + '<button class="btn-clear-history font-label" onclick="clearHistory()">CLEAR HISTORY</button>'
    + '</div>'
    + '<input type="file" id="import-input" accept=".json" style="display:none"'
    + ' onchange="handleImport(this)">';
}

window.render = function() {
  applyModeClass();
  var app = document.getElementById('app');
  if (!app) return;

  if (window.currentView === 'practice') {
    var bullDone    = window.appMode === 'bull'    && getTotalBulls()              >= window.settings.defaultTarget;
    var cricketDone = window.appMode === 'cricket' && window.cricketRounds.length >= window.settings.cricketRounds;
    if (bullDone || cricketDone) {
      window.rounds           = [];
      window.cricketRounds    = [];
      window.sessionStartTime = null;
    }
  }

  if (sessionChartInst) { sessionChartInst.destroy(); sessionChartInst = null; }
  if (macroChartInst)   { macroChartInst.destroy();   macroChartInst   = null; }
  if (microChartInst)   { microChartInst.destroy();   microChartInst   = null; }
  openMicroIndex = -1;

  if (window.currentView === 'practice') {
    app.innerHTML = renderPractice();
  } else if (window.currentView === 'summary') {
    app.innerHTML = renderSummary();
  } else {
    app.innerHTML = renderInsights();
  }

  app.classList.remove('view-enter');
  void app.offsetWidth;
  app.classList.add('view-enter');

  if (window.currentView === 'summary') {
    var isBull    = window.appMode === 'bull';
    var rawRounds = isBull ? window.rounds : window.cricketRounds;
    if (rawRounds.length > 0) {
      renderSessionChart('session-chart', rawRounds, isBull);
    }
    setTimeout(function() { punchScore(); }, 50);
  }

  if (window.currentView === 'insights' && growthChartExpanded) {
    var isCricket = insightHistoryTab === 'cricket';
    renderMacroChart('macro-chart', isCricket ? window.cricketHistory : window.ocheHistory, isCricket);
  }

  if (window.currentView === 'insights' && window.editingNickname) {
    var ni = document.getElementById('nickname-input');
    if (ni) { ni.focus(); ni.select(); }
  }
};
