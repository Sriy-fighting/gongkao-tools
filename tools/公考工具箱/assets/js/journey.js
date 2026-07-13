/* Unified focus + journey + AI plan experience. No credentials are stored here. */
(function () {
  'use strict';

  var KEY = 'gk-focus-journey';
  var PROFILE_KEY = 'gk-ai-plan-profile';
  var STAGES = [
    { name: '晨读驿', minutes: 0, story: '卷轴初启，先把今天走稳。' },
    { name: '申论渡', minutes: 300, story: '渡口的题纲已点亮。' },
    { name: '数理关', minutes: 900, story: '算筹与思路在关隘汇合。' },
    { name: '行测坊', minutes: 1800, story: '坊间的节奏愈发笃定。' },
    { name: '金榜台', minutes: 3000, story: '登台之前，每一步都算数。' }
  ];
  var state = freshState();
  var taskOptions = [];
  var draft = null;
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

  function getProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch (e) { return {}; } }
  function saveProfile(profile) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); if (window.SyncStore) window.SyncStore.writeData(PROFILE_KEY, profile); } catch (e) {} }
  function setError(message) { var el = document.getElementById('ai-plan-error'); if (el) el.textContent = message || ''; }
  function value(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  function openAiPlanner() {
    var auth = window.SyncStore && window.SyncStore.getAuthInfo ? window.SyncStore.getAuthInfo() : null;
    if (!auth || !auth.isLoggedIn) { if (window.openAccountModal) window.openAccountModal(); return; }
    var profile = getProfile();
    ['exam', 'examDate', 'subjects', 'weekdayMinutes', 'weekendMinutes', 'restDays', 'notes'].forEach(function (key) {
      var el = document.getElementById('ai-plan-' + key.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); })); if (el && profile[key] != null) el.value = profile[key];
    });
    setError(''); document.getElementById('ai-plan-modal').classList.add('open');
  }
  function closeAiPlanner() { var el = document.getElementById('ai-plan-modal'); if (el) el.classList.remove('open'); }

  function planPayload() {
    var profile = {
      exam: value('ai-plan-exam').slice(0, 80), examDate: value('ai-plan-exam-date'), subjects: value('ai-plan-subjects').slice(0, 500),
      weekdayMinutes: clamp(parseInt(value('ai-plan-weekday'), 10) || 120, 15, 720), weekendMinutes: clamp(parseInt(value('ai-plan-weekend'), 10) || 240, 15, 720),
      restDays: value('ai-plan-rest-days').slice(0, 80), notes: value('ai-plan-notes').slice(0, 500)
    };
    if (!profile.exam || !profile.subjects) throw new Error('请填写考试目标和科目优先级');
    saveProfile(profile);
    return profile;
  }

  function validateDraft(plan) {
    if (!plan || typeof plan !== 'object' || !Array.isArray(plan.days) || plan.days.length === 0 || plan.days.length > 31) throw new Error('AI 返回的计划格式无效，请重试');
    plan.days = plan.days.filter(function (day) { return day && /^\d{4}-\d{2}-\d{2}$/.test(day.date || '') && Array.isArray(day.tasks); }).slice(0, 30).map(function (day) {
      return { date: day.date, weekGoal: String(day.weekGoal || '').slice(0, 240), tasks: day.tasks.slice(0, 8).map(function (task) { return { text: String(task && task.text || '').slice(0, 160), subject: String(task && task.subject || '').slice(0, 40), estimateMinutes: clamp(parseInt(task && task.estimateMinutes, 10) || 0, 0, 720) }; }).filter(function (task) { return task.text.trim(); }) };
    });
    if (!plan.days.length) throw new Error('AI 未生成可用的每日任务');
    plan.monthTitle = String(plan.monthTitle || '').slice(0, 80); plan.monthFocus = String(plan.monthFocus || '').slice(0, 300);
    return plan;
  }

  function generateAiPlan() {
    var payload;
    try { payload = planPayload(); } catch (error) { setError(error.message); return; }
    var button = document.getElementById('ai-plan-generate'); button.disabled = true; button.textContent = '正在生成…'; setError('');
    window.SyncStore.invokeFunction('ai-study-plan', payload).then(function (data) {
      draft = validateDraft(data && data.plan); closeAiPlanner(); renderDraft(); document.getElementById('ai-draft-modal').classList.add('open');
    }).catch(function (error) { setError(error && error.message ? error.message : '生成失败，请检查网络后重试'); }).finally(function () { button.disabled = false; button.textContent = '生成草案'; });
  }

  function renderDraft() {
    var root = document.getElementById('ai-draft-content'); if (!root || !draft) return;
    root.textContent = '';
    var title = document.createElement('input'); title.className = 'ai-draft-title'; title.value = draft.monthTitle || '30 天学习计划'; title.maxLength = 80; title.addEventListener('input', function () { draft.monthTitle = title.value; }); root.appendChild(title);
    var focus = document.createElement('textarea'); focus.className = 'ai-draft-focus'; focus.value = draft.monthFocus || ''; focus.maxLength = 300; focus.rows = 2; focus.placeholder = '本月重点'; focus.addEventListener('input', function () { draft.monthFocus = focus.value; }); root.appendChild(focus);
    draft.days.forEach(function (day, dayIndex) {
      var dayEl = document.createElement('section'); dayEl.className = 'ai-draft-day';
      var heading = document.createElement('h4'); heading.textContent = day.date + (day.weekGoal ? ' · ' + day.weekGoal : ''); dayEl.appendChild(heading);
      day.tasks.forEach(function (task, taskIndex) {
        var row = document.createElement('div'); row.className = 'ai-draft-task';
        var input = document.createElement('input'); input.value = task.text; input.maxLength = 160; input.setAttribute('aria-label', day.date + '任务'); input.addEventListener('input', function () { draft.days[dayIndex].tasks[taskIndex].text = input.value; });
        var meta = document.createElement('span'); meta.textContent = [task.subject, task.estimateMinutes ? task.estimateMinutes + ' 分钟' : ''].filter(Boolean).join(' · ');
        var remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除'; remove.addEventListener('click', function () { draft.days[dayIndex].tasks.splice(taskIndex, 1); renderDraft(); });
        row.appendChild(input); row.appendChild(meta); row.appendChild(remove); dayEl.appendChild(row);
      }); root.appendChild(dayEl);
    });
  }
  function closeDraft() { var el = document.getElementById('ai-draft-modal'); if (el) el.classList.remove('open'); }
  function applyDraft() {
    try { var count = window.PortalPlan.applyAiDraft(validateDraft(draft)); closeDraft(); renderTasks(); render(); alert('已应用 ' + count + ' 项 AI 建议，可在学习计划中继续编辑。'); }
    catch (error) { alert(error && error.message ? error.message : '应用失败'); }
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

  window.Journey = { openAiPlanner: openAiPlanner, closeAiPlanner: closeAiPlanner, generateAiPlan: generateAiPlan, closeDraft: closeDraft, applyDraft: applyDraft, closeCompletion: closeCompletion, confirmCompletion: confirmCompletion, refresh: function () { renderTasks(); render(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
