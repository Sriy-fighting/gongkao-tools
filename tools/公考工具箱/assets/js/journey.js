/* Unified focus + journey + AI plan experience. No credentials are stored here. */
(function () {
  'use strict';

  var KEY = 'gk-focus-journey';
  var STAGES = [
    { name: '晨读驿', minutes: 0, story: '卷轴初启，先把今天走稳。' },
    { name: '申论渡', minutes: 300, story: '渡口的题纲已点亮。' },
    { name: '数理关', minutes: 900, story: '算筹与思路在关隘汇合。' },
    { name: '政治理论坊', minutes: 1800, story: '理论的脉络愈发清晰笃定。' },
    { name: '金榜台', minutes: 3000, story: '登台之前，每一步都算数。' }
  ];
  var state = freshState();
  var taskOptions = [];
  var tickId = null;

  function freshState() {
    return { version: 1, active: null, settledIds: [], sessions: [], totalMinutes: 0, stamps: 0, streak: 0, unlocked: ['晨读驿'] };
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function id() { return 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function format(ms) { var seconds = Math.ceil(Math.max(0, ms) / 1000); return pad(Math.floor(seconds / 60)) + ':' + pad(seconds % 60); }

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && typeof raw === 'object') state = Object.assign(freshState(), raw);
    } catch (e) {}
    if (!Array.isArray(state.sessions)) state.sessions = [];
    if (!Array.isArray(state.settledIds)) state.settledIds = [];
    state.totalMinutes = Math.max(0, parseInt(state.totalMinutes, 10) || 0);
    state.stamps = Math.max(0, parseInt(state.stamps, 10) || 0);
    recoverActive();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      if (window.SyncStore) window.SyncStore.writeData(KEY, state);
    } catch (e) {}
  }

  function elapsed(active) {
    if (!active) return 0;
    var value = Math.max(0, parseInt(active.elapsedBeforeMs, 10) || 0);
    if (active.running && active.startedAt) value += Math.max(0, Date.now() - active.startedAt);
    return Math.min(value, active.targetMinutes * 60000);
  }

  function recoverActive() {
    if (!state.active) return;
    var active = state.active;
    active.targetMinutes = clamp(parseInt(active.targetMinutes, 10) || 25, 5, 180);
    active.elapsedBeforeMs = Math.max(0, parseInt(active.elapsedBeforeMs, 10) || 0);
    if (active.running && (!active.startedAt || active.startedAt > Date.now())) {
      active.running = false;
      active.startedAt = 0;
    }
    if (elapsed(active) >= active.targetMinutes * 60000) {
      active.elapsedBeforeMs = active.targetMinutes * 60000;
      active.running = false;
      active.startedAt = 0;
      save();
    }
  }

  function currentStage() {
    var result = STAGES[0];
    for (var i = 0; i < STAGES.length; i++) if (state.totalMinutes >= STAGES[i].minutes) result = STAGES[i];
    return result;
  }

  function updateUnlocked() {
    state.unlocked = STAGES.filter(function (stage) { return state.totalMinutes >= stage.minutes; }).map(function (stage) { return stage.name; });
  }

  function calculateStreak() {
    var dates = {};
    state.sessions.forEach(function (session) { if (session.minutes > 0 && /^\d{4}-\d{2}-\d{2}$/.test(session.date || '')) dates[session.date] = true; });
    var cursor = new Date(); cursor.setHours(0, 0, 0, 0);
    var count = 0;
    while (dates[cursor.getFullYear() + '-' + pad(cursor.getMonth() + 1) + '-' + pad(cursor.getDate())]) {
      count++; cursor.setDate(cursor.getDate() - 1);
    }
    state.streak = count;
  }

  function renderTasks() {
    var select = document.getElementById('journey-task');
    if (!select) return;
    taskOptions = window.PortalPlan ? window.PortalPlan.getTodayTasks() : [];
    var previous = select.value;
    select.textContent = '';
    var none = document.createElement('option'); none.value = ''; none.textContent = '不关联任务，自由专注'; select.appendChild(none);
    taskOptions.forEach(function (task, index) {
      var option = document.createElement('option'); option.value = String(index);
      option.textContent = (task.done ? '✓ ' : '') + task.text + (task.subject ? ' · ' + task.subject : '');
      select.appendChild(option);
    });
    if (previous && select.querySelector('option[value="' + previous + '"]')) select.value = previous;
  }

  function renderMap() {
    var container = document.getElementById('journey-stops');
    if (!container) return;
    container.textContent = '';
    STAGES.forEach(function (stage) {
      var stop = document.createElement('div');
      stop.className = 'journey-stop' + (state.totalMinutes >= stage.minutes ? ' reached' : '');
      var icon = document.createElement('span'); icon.className = 'journey-stop-icon'; icon.textContent = state.totalMinutes >= stage.minutes ? '◆' : '○';
      var label = document.createElement('span'); label.textContent = stage.name;
      stop.title = stage.name + '：' + stage.story + '（' + stage.minutes + ' 分钟）';
      stop.appendChild(icon); stop.appendChild(label); container.appendChild(stop);
    });
  }

  function render() {
    var active = state.active;
    var target = active ? active.targetMinutes * 60000 : selectedMinutes() * 60000;
    var remaining = active ? Math.max(0, target - elapsed(active)) : target;
    var clock = document.getElementById('journey-clock');
    var start = document.getElementById('journey-start');
    var finish = document.getElementById('journey-finish');
    var custom = document.getElementById('journey-custom-minutes');
    var stage = currentStage();
    if (clock) clock.textContent = format(remaining);
    if (start) start.textContent = active ? (active.running ? '暂停专注' : '继续专注') : '开始专注';
    if (finish) finish.disabled = !active;
    if (custom && !active) custom.value = selectedMinutes();
    var stageEl = document.getElementById('journey-stage'); if (stageEl) stageEl.textContent = stage.name;
    var total = document.getElementById('journey-total'); if (total) total.textContent = '已行 ' + state.totalMinutes + ' 分钟';
    var streak = document.getElementById('journey-streak'); if (streak) streak.textContent = '连续 ' + state.streak + ' 天';
    var stamps = document.getElementById('journey-stamps'); if (stamps) stamps.textContent = state.stamps + ' 枚行程印记';
    var hint = document.getElementById('journey-hint'); if (hint) hint.textContent = active ? (active.running ? '专注进行中，暂停也会安全保存。' : '行程已暂停，随时可以继续。') : stage.story;
    document.querySelectorAll('.journey-duration button').forEach(function (button) { button.classList.toggle('active', parseInt(button.dataset.minutes, 10) === selectedMinutes()); });
    renderMap();
  }

  function selectedMinutes() {
    var input = document.getElementById('journey-custom-minutes');
    return clamp(parseInt(input && input.value, 10) || 25, 5, 180);
  }

  function refreshTick() {
    if (tickId) clearInterval(tickId);
    if (state.active && state.active.running) tickId = setInterval(function () {
      if (state.active && elapsed(state.active) >= state.active.targetMinutes * 60000) {
        state.active.running = false; state.active.elapsedBeforeMs = state.active.targetMinutes * 60000; state.active.startedAt = 0; save();
      }
      render();
    }, 500);
  }

  function startOrPause() {
    if (!state.active) {
      state.active = { id: id(), startedAt: Date.now(), elapsedBeforeMs: 0, running: true, targetMinutes: selectedMinutes(), taskRef: selectedTaskRef(), createdAt: new Date().toISOString() };
    } else if (state.active.running) {
      state.active.elapsedBeforeMs = elapsed(state.active); state.active.running = false; state.active.startedAt = 0;
    } else if (elapsed(state.active) < state.active.targetMinutes * 60000) {
      state.active.running = true; state.active.startedAt = Date.now();
    }
    save(); refreshTick(); render();
  }

  function selectedTaskRef() {
    var select = document.getElementById('journey-task');
    var idx = select && select.value !== '' ? parseInt(select.value, 10) : -1;
    return idx >= 0 && taskOptions[idx] ? taskOptions[idx].ref : null;
  }

  function openCompletion() {
    if (!state.active) return;
    if (state.active.running) { state.active.elapsedBeforeMs = elapsed(state.active); state.active.running = false; state.active.startedAt = 0; save(); refreshTick(); }
    var minutes = Math.floor(elapsed(state.active) / 60000);
    var summary = document.getElementById('journey-complete-summary');
    if (summary) summary.textContent = '本次共专注 ' + minutes + ' 分钟。' + (minutes >= 5 ? '一枚行程印记将在保存后入册。' : '满 5 分钟可获得行程印记。');
    var modal = document.getElementById('journey-complete-modal'); if (modal) modal.classList.add('open');
  }

  function closeCompletion() { var modal = document.getElementById('journey-complete-modal'); if (modal) modal.classList.remove('open'); }

  function confirmCompletion() {
    var active = state.active;
    if (!active || state.settledIds.indexOf(active.id) !== -1) { closeCompletion(); return; }
    var minutes = Math.floor(elapsed(active) / 60000);
    var note = document.getElementById('journey-reflection');
    var mark = document.getElementById('journey-mark-done');
    var reflection = note ? note.value.trim().slice(0, 300) : '';
    if (active.taskRef && window.PortalPlan) window.PortalPlan.addFocus(active.taskRef, minutes, !!(mark && mark.checked));
    state.sessions.unshift({ id: active.id, date: today(), startedAt: active.createdAt, minutes: minutes, targetMinutes: active.targetMinutes, taskRef: active.taskRef || null, reflection: reflection });
    state.sessions = state.sessions.slice(0, 300);
    state.settledIds.push(active.id); state.settledIds = state.settledIds.slice(-500);
    state.totalMinutes += minutes;
    if (minutes >= 5) state.stamps++;
    state.active = null; updateUnlocked(); calculateStreak(); save();
    if (note) note.value = ''; if (mark) mark.checked = false;
    closeCompletion(); renderTasks(); render();
  }

  function init() {
    load(); renderTasks(); render(); refreshTick();
    document.getElementById('journey-start').addEventListener('click', startOrPause);
    document.getElementById('journey-finish').addEventListener('click', openCompletion);
    document.querySelectorAll('.journey-duration button').forEach(function (button) { button.addEventListener('click', function () { if (state.active) return; document.getElementById('journey-custom-minutes').value = button.dataset.minutes; render(); }); });
    document.getElementById('journey-custom-minutes').addEventListener('change', function () { if (!state.active) { this.value = selectedMinutes(); render(); } });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { recoverActive(); render(); } });
    window.addEventListener('beforeunload', save);
  }

  window.Journey = { closeCompletion: closeCompletion, confirmCompletion: confirmCompletion, refresh: function () { renderTasks(); render(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
