/* =========================================================
   Constants & State
   ========================================================= */
const STORAGE_KEY = 'ebbinghaus_entries';
const INTERVALS = [1, 2, 4, 7, 15, 30];
let _undoData = null;

/* =========================================================
   Data Persistence (LocalStorage)
   ========================================================= */
function loadEntries() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    data.forEach(migrateEntry);
    return data;
  } catch { return []; }
}

/* Async cloud sync: tries to pull from Supabase on init */
function cloudSync() {
  if (window.SyncStore && window.SyncStore.isConfigured()) {
    window.SyncStore.readData(STORAGE_KEY, function(cloudData) {
      if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
        cloudData.forEach(migrateEntry);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));
        renderAll();
      }
    });
  }
}
function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  if (window.SyncStore) window.SyncStore.writeData(STORAGE_KEY, entries);
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* =========================================================
   Migration
   ========================================================= */
function migrateEntry(entry) {
  if (!entry.reviewHistory) entry.reviewHistory = {};
  return entry;
}

/* =========================================================
   Date Utilities
   ========================================================= */
function getToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function parseDate(str) {
  const p = str.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function formatISODate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function formatDateShort(str) {
  const d = parseDate(str);
  return (d.getMonth() + 1) + '/' + d.getDate();
}
function formatChineseDate(d) {
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}
const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
function getDayName(d) { return '星期' + DAY_NAMES[d.getDay()]; }

/* =========================================================
   Core Logic
   ========================================================= */
function getDueIntervals(entry, today) {
  const start = parseDate(entry.createdAt);
  const due = [];
  for (const interval of INTERVALS) {
    if (entry.completedIntervals.includes(interval)) continue;
    const dueDate = new Date(start);
    dueDate.setDate(dueDate.getDate() + interval);
    if (dueDate <= today) due.push({ interval, dueDate });
  }
  return due;
}

function createEntry(content, tag) {
  const entries = loadEntries();
  const today = formatISODate(getToday());
  entries.unshift({
    id: generateId(),
    content: content.trim(),
    tag: tag.trim() || '',
    createdAt: today,
    completedIntervals: [],
    reviewHistory: {}
  });
  saveEntries(entries);
}

function completeReview(entryId) {
  const entries = loadEntries();
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return;
  const today = getToday();
  const start = parseDate(entry.createdAt);
  for (const interval of INTERVALS) {
    if (entry.completedIntervals.includes(interval)) continue;
    const dueDate = new Date(start);
    dueDate.setDate(dueDate.getDate() + interval);
    if (dueDate <= today) {
      entry.completedIntervals.push(interval);
      entry.completedIntervals.sort((a, b) => a - b);
      entry.reviewHistory[interval] = formatISODate(today);
      _undoData = { action: 'complete', snapshot: JSON.stringify(entries) };
      break;
    }
  }
  saveEntries(entries);
}

function deleteEntry(entryId) {
  const entries = loadEntries();
  const filtered = entries.filter(e => e.id !== entryId);
  _undoData = { action: 'delete', snapshot: JSON.stringify(entries) };
  saveEntries(filtered);
}

function editEntry(entryId, content, tag) {
  const entries = loadEntries();
  const entry = entries.find(e => e.id === entryId);
  if (!entry) return;
  entry.content = content.trim();
  entry.tag = tag.trim() || '';
  saveEntries(entries);
}

/* =========================================================
   Stats
   ========================================================= */
function calculateStats(entries) {
  const today = formatISODate(getToday());
  let totalCompleted = 0;
  let reviewsToday = 0;
  const allReviewDates = new Set();
  for (const entry of entries) {
    totalCompleted += entry.completedIntervals.length;
    for (const date of Object.values(entry.reviewHistory)) {
      allReviewDates.add(date);
      if (date === today) reviewsToday++;
    }
  }
  const totalPossible = entries.length * INTERVALS.length;
  const completionRate = totalPossible > 0 ? Math.round(totalCompleted / totalPossible * 100) : 0;
  let streak = 0;
  const todayDate = getToday();
  const todayStr = formatISODate(todayDate);
  const startFrom = allReviewDates.has(todayStr) ? 0 : 1;
  for (let i = startFrom; ; i++) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    if (allReviewDates.has(formatISODate(d))) streak++;
    else break;
  }
  return { totalEntries: entries.length, totalCompleted, totalPossible, completionRate, reviewsToday, streak };
}

/* =========================================================
   Weekly Preview
   ========================================================= */
function getWeeklyDue(entries) {
  const today = getToday();
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() + i);
    let count = 0;
    for (const entry of entries) {
      if (i === 0 && getDueIntervals(entry, day).length > 0) {
        count++;
      } else if (i > 0) {
        const start = parseDate(entry.createdAt);
        for (const interval of INTERVALS) {
          if (entry.completedIntervals.includes(interval)) continue;
          const dueDate = new Date(start);
          dueDate.setDate(dueDate.getDate() + interval);
          if (formatISODate(dueDate) === formatISODate(day)) { count++; break; }
        }
      }
    }
    weekDays.push({ date: day, count });
  }
  return weekDays;
}

/* =========================================================
   Search
   ========================================================= */
function filterByQuery(entries, query) {
  if (!query.trim()) return entries;
  const q = query.trim().toLowerCase();
  return entries.filter(e =>
    e.content.toLowerCase().includes(q) ||
    (e.tag && e.tag.toLowerCase().includes(q))
  );
}

/* =========================================================
   Export / Import
   ========================================================= */
function exportData() {
  const data = loadEntries();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ebbinghaus-backup-' + formatISODate(getToday()) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!Array.isArray(data)) throw new Error();
    for (const e of data) {
      if (!e.id || !e.content || !e.createdAt) throw new Error();
      migrateEntry(e);
    }
    saveEntries(data);
    renderAll();
    showToast('导入成功，共 ' + data.length + ' 条记录');
  } catch {
    alert('导入失败：文件格式不正确');
  }
}

/* =========================================================
   Undo
   ========================================================= */
function performUndo() {
  if (!_undoData) return;
  try { saveEntries(JSON.parse(_undoData.snapshot)); } catch {}
  _undoData = null;
  hideUndoToast();
  renderAll();
}

/* =========================================================
   Toast
   ========================================================= */
let _toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('undoToast');
  const msgEl = document.getElementById('toastMsg');
  const btn = document.getElementById('undoBtn');
  msgEl.textContent = msg;
  btn.style.display = 'none';
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2500);
}

function showUndoToast() {
  const toast = document.getElementById('undoToast');
  const msgEl = document.getElementById('toastMsg');
  const btn = document.getElementById('undoBtn');
  msgEl.textContent = '已标记完成';
  btn.style.display = '';
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { toast.classList.remove('show'); _undoData = null; }, 5000);
}
function hideUndoToast() {
  document.getElementById('undoToast').classList.remove('show');
  clearTimeout(_toastTimer);
}

/* =========================================================
   HTML Escaping
   ========================================================= */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* =========================================================
   Build Timeline HTML
   ========================================================= */
function buildTimeline(entry) {
  const start = parseDate(entry.createdAt);
  const today = getToday();
  let html = '';
  html += '<div class="timeline-row"><span class="tl-dot done"></span><span class="tl-label">创建</span><span>' + formatDateShort(entry.createdAt) + '</span></div>';
  for (const interval of INTERVALS) {
    const dueDate = new Date(start);
    dueDate.setDate(dueDate.getDate() + interval);
    let dotClass = '';
    let suffix = '';
    if (entry.completedIntervals.includes(interval)) { dotClass = 'done'; suffix = ' &#10003;'; }
    else if (dueDate <= today) { dotClass = 'overdue-dot'; }
    html += '<div class="timeline-row"><span class="tl-dot ' + dotClass + '"></span><span class="tl-label">第' + interval + '轮</span><span class="tl-date">' + formatDateShort(formatISODate(dueDate)) + '</span>' + suffix + '</div>';
  }
  return html;
}

/* =========================================================
   Build Progress Dots
   ========================================================= */
function buildProgressDots(entry) {
  const completed = entry.completedIntervals;
  let html = '<span class="progress-dots">';
  for (let i = 0; i < INTERVALS.length; i++) {
    const interval = INTERVALS[i];
    let cls = 'dot';
    if (completed.includes(interval)) cls += ' done';
    else if (i === completed.length) cls += ' current';
    html += '<span class="' + cls + '"></span>';
  }
  html += '</span>';
  return html;
}

/* =========================================================
   Render: Header Date
   ========================================================= */
function renderHeaderDate() {
  const now = new Date();
  document.getElementById('headerDate').textContent = formatChineseDate(now) + ' ' + getDayName(now);
}

/* =========================================================
   Render: Stats Bar
   ========================================================= */
function renderStatsBar(entries) {
  const stats = calculateStats(entries);
  document.getElementById('statTotal').textContent = stats.totalEntries;
  document.getElementById('statToday').textContent = stats.reviewsToday;
  document.getElementById('statRate').textContent = stats.completionRate + '%';
  document.getElementById('statStreak').textContent = stats.streak;
}

/* =========================================================
   Render: Review Section
   ========================================================= */
function renderReviewSection(entries) {
  const today = getToday();
  const list = document.getElementById('reviewList');
  const empty = document.getElementById('reviewEmpty');
  const badge = document.getElementById('reviewBadge');

  const dueEntries = [];
  for (const entry of entries) {
    const due = getDueIntervals(entry, today);
    if (due.length > 0) dueEntries.push({ entry, due });
  }

  if (dueEntries.length > 0) {
    badge.textContent = dueEntries.length + ' 项待复习';
    badge.style.display = '';
  } else {
    badge.textContent = '';
    badge.style.display = 'none';
  }

  if (dueEntries.length === 0) {
    list.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  let html = '';
  for (const { entry, due } of dueEntries) {
    const isOverdue = due.some(function (d) { return (today - d.dueDate) / 86400000 > 0; });
    const dueLabels = due.map(function (d) { return '第' + d.interval + '轮'; }).join('、');
    html += '<div class="review-card' + (isOverdue ? ' has-overdue' : '') + '">';
    html += '<div class="review-card-top"><div class="review-content">';
    html += '<div class="rc-text">' + escapeHtml(entry.content) + '</div>';
    html += '<div class="rc-meta"><span>' + formatDateShort(entry.createdAt) + ' 创建</span>';
    if (entry.tag) html += '<span class="tag">' + escapeHtml(entry.tag) + '</span>';
    html += buildProgressDots(entry);
    html += '</div></div>';
    html += '<span class="rc-badge' + (isOverdue ? ' overdue' : '') + '">第' + due[0].interval + '轮</span>';
    html += '</div><div class="review-card-bottom">';
    html += '<div class="due-info">待复习: <strong>' + dueLabels + '</strong></div>';
    html += '<button class="btn-review" data-id="' + entry.id + '">';
    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    html += '标记完成</button></div></div>';
  }
  list.innerHTML = html;
}

/* =========================================================
   Render: Weekly Preview
   ========================================================= */
function renderWeeklyPreview(entries) {
  const weekDays = getWeeklyDue(entries);
  const today = getToday();
  const grid = document.getElementById('weeklyGrid');
  let html = '';
  for (const day of weekDays) {
    const isToday = formatISODate(day.date) === formatISODate(today);
    const dayName = isToday ? '今天' : DAY_NAMES[day.date.getDay()];
    html += '<div class="weekly-day' + (isToday ? ' today' : '') + '">';
    html += '<span class="wd-name">' + dayName + '</span>';
    html += '<span class="wd-count' + (day.count > 0 ? ' has-items' : '') + '">' + day.count + '</span>';
    html += '</div>';
  }
  grid.innerHTML = html;
}

/* =========================================================
   Render: History Section
   ========================================================= */
function renderHistorySection(entries) {
  const query = (document.getElementById('searchInput') && document.getElementById('searchInput').value) || '';
  const filtered = filterByQuery(entries, query);
  const list = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  const badge = document.getElementById('historyBadge');

  const sorted = [...filtered].sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
  badge.textContent = '共 ' + sorted.length + ' 项' + (query ? ' (筛选)' : '');

  if (sorted.length === 0) {
    list.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  let html = '';
  for (const entry of sorted) {
    const firstLine = entry.content.split('\n')[0] || '(无内容)';
    const completed = entry.completedIntervals.length;
    const total = INTERVALS.length;
    html += '<div class="history-item" data-id="' + entry.id + '">';
    html += '<div class="history-header"><div class="hh-text">';
    html += '<div class="hh-title">' + escapeHtml(firstLine) + '</div>';
    html += '<div class="hh-meta">' + formatDateShort(entry.createdAt);
    if (entry.tag) html += ' · ' + escapeHtml(entry.tag);
    html += '</div></div><div class="hh-right">';
    html += '<span class="hh-progress">' + completed + '/' + total + '</span>';
    html += '<svg class="hh-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
    html += '</div></div>';
    html += '<div class="history-body"><div class="history-body-inner">';
    html += '<div class="hb-content">' + escapeHtml(entry.content) + '</div>';
    html += '<div class="hb-timeline">' + buildTimeline(entry) + '</div>';
    html += '<div class="hb-actions">';
    html += '<button class="btn-edit-item" data-id="' + entry.id + '">编辑</button>';
    html += '<button class="btn-delete" data-id="' + entry.id + '">删除</button>';
    html += '</div></div></div></div>';
  }
  list.innerHTML = html;
}

/* =========================================================
   Render All
   ========================================================= */
function renderAll() {
  const entries = loadEntries();
  renderHeaderDate();
  renderStatsBar(entries);
  renderReviewSection(entries);
  renderWeeklyPreview(entries);
  renderHistorySection(entries);
}

/* =========================================================
   Event Handlers
   ========================================================= */
function setupForm() {
  document.getElementById('addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const content = document.getElementById('contentInput');
    const tag = document.getElementById('tagInput');
    if (!content.value.trim()) return;
    createEntry(content.value, tag.value);
    content.value = '';
    tag.value = '';
    content.focus();
    _undoData = null;
    renderAll();
  });
}

function setupReviewClicks() {
  document.getElementById('reviewList').addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-review');
    if (!btn) return;
    const id = btn.dataset.id;
    completeReview(id);
    renderAll();
    showUndoToast();
  });
}

function setupHistoryClicks() {
  document.getElementById('historyList').addEventListener('click', function (e) {
    const header = e.target.closest('.history-header');
    if (header) {
      const item = header.closest('.history-item');
      if (item) {
        document.querySelectorAll('.history-item.expanded').forEach(function (el) {
          if (el !== item) el.classList.remove('expanded');
        });
        item.classList.toggle('expanded');
      }
      return;
    }
    const delBtn = e.target.closest('.btn-delete');
    if (delBtn && confirm('确定删除此学习记录？')) {
      const id = delBtn.dataset.id;
      deleteEntry(id);
      renderAll();
      showUndoToast();
      return;
    }
    const editBtn = e.target.closest('.btn-edit-item');
    if (editBtn) { enterEditMode(editBtn.dataset.id); return; }
    const saveBtn = e.target.closest('.btn-save-edit');
    if (saveBtn) {
      const id = saveBtn.dataset.id;
      const content = document.getElementById('edit-content-' + id);
      const tag = document.getElementById('edit-tag-' + id);
      if (content && content.value.trim()) {
        editEntry(id, content.value, tag ? tag.value : '');
        renderAll();
      }
      return;
    }
    const cancelBtn = e.target.closest('.btn-cancel-edit');
    if (cancelBtn) { renderAll(); }
  });
}

function enterEditMode(entryId) {
  const items = document.querySelectorAll('.history-item');
  for (const item of items) {
    if (item.dataset.id !== entryId) continue;
    item.classList.add('expanded');
    requestAnimationFrame(function () {
      const inner = item.querySelector('.history-body-inner');
      if (!inner) return;
      inner.innerHTML =
        '<div class="history-edit-area">' +
        '<textarea id="edit-content-' + entryId + '" rows="3"></textarea>' +
        '<div class="edit-row">' +
        '<input type="text" id="edit-tag-' + entryId + '" placeholder="标签（可选）">' +
        '<button class="btn-save-edit" data-id="' + entryId + '">保存</button>' +
        '<button class="btn-cancel-edit" data-id="' + entryId + '">取消</button>' +
        '</div></div>';
      document.getElementById('edit-content-' + entryId).focus();
    });
    break;
  }
}

function setupExportImport() {
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', function () {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) { importData(ev.target.result); };
    reader.readAsText(file);
    this.value = '';
  });
}

function setupSearch() {
  document.getElementById('searchInput').addEventListener('input', function () {
    renderHistorySection(loadEntries());
  });
}

function setupUndo() {
  document.getElementById('undoBtn').addEventListener('click', performUndo);
}

/* =========================================================
   Init
   ========================================================= */

/* =========================================================
   Plan System - Month/Week/Day Study Planner
   ========================================================= */
const PLAN_KEY = 'study_plans';
let _currentPlanMonth = '';
let _planHolidays = {
  '2026-01-01':'\u5143\u65e6','2026-02-17':'\u9664\u5915','2026-02-18':'\u6625\u8282',
  '2026-02-19':'\u521d\u4e8c','2026-02-20':'\u521d\u4e09','2026-04-04':'\u6e05\u660e',
  '2026-04-05':'\u6e05\u660e\u8282','2026-05-01':'\u52b3\u52a8\u8282',
  '2026-05-04':'\u9752\u5e74\u8282','2026-06-19':'\u7aef\u5348\u8282',
  '2026-09-27':'\u4e2d\u79cb\u8282','2026-10-01':'\u56fd\u5e86\u8282',
  '2026-10-02':'\u56fd\u5e86','2026-10-03':'\u56fd\u5e86'
};

function getMonthStart(year, month) {
  return new Date(year, month - 1, 1);
}
function getMonthEnd(year, month) {
  return new Date(year, month, 0);
}
function getWeeksInMonth(year, month) {
  const start = getMonthStart(year, month);
  const end = getMonthEnd(year, month);
  const weeks = [];
  let current = new Date(start);
  // Adjust to Monday of the week containing the 1st
  const dayOfWeek = current.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  current.setDate(current.getDate() + mondayOffset);
  
  let weekNum = 1;
  while (current <= end || (current.getDay() === 1 && weekNum === 1)) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      days.push(formatISODate(date));
    }
    weeks.push({ weekNum: weekNum, startDate: formatISODate(weekStart), endDate: formatISODate(weekEnd), days: days });
    current.setDate(current.getDate() + 7);
    weekNum++;
    if (weekNum > 6) break;
  }
  return weeks;
}

function loadPlans() {
  try { return JSON.parse(localStorage.getItem(PLAN_KEY)) || []; } catch { return []; }
}
function savePlans(plans) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plans));
  if (window.SyncStore) window.SyncStore.writeData(PLAN_KEY, plans);
}
function getPlan(month) {
  const plans = loadPlans();
  return plans.find(function(p) { return p.month === month; }) || null;
}
function getOrCreatePlan(month) {
  let plan = getPlan(month);
  if (plan) return plan;
  const p = month.split('-');
  const year = parseInt(p[0], 10);
  const mon = parseInt(p[1], 10);
  const weeks = getWeeksInMonth(year, mon);
  plan = { id: generateId(), month: month, weeks: [] };
  weeks.forEach(function(w) {
    const weekDays = [];
    w.days.forEach(function(dateStr) {
      // Only include days that belong to this month
      if (dateStr >= month + '-01' && dateStr <= getMonthEnd(year, mon)) {
        weekDays.push({ date: dateStr, tasks: [] });
      }
    });
    // Filter: only keep days in this month
    plan.weeks.push({ id: generateId(), weekNum: w.weekNum, goal: '', days: weekDays.filter(function(d) { return d.date >= month + '-01' && d.date <= formatISODate(getMonthEnd(year, mon)); }) });
  });
  // Remove empty weeks at the end
  while (plan.weeks.length > 0 && plan.weeks[plan.weeks.length - 1].days.length === 0) {
    plan.weeks.pop();
  }
  return plan;
}
function savePlan(plan) {
  const plans = loadPlans();
  const idx = plans.findIndex(function(p) { return p.id === plan.id; });
  if (idx >= 0) plans[idx] = plan;
  else plans.push(plan);
  savePlans(plans);
}
function deletePlan(planId) {
  let plans = loadPlans();
  plans = plans.filter(function(p) { return p.id !== planId; });
  savePlans(plans);
}

function getHoliday(dateStr) {
  return _planHolidays[dateStr] || null;
}
function getDateTag(dateStr) {
  const d = parseDate(dateStr);
  const day = d.getDay();
  const holiday = getHoliday(dateStr);
  const today = formatISODate(getToday());
  if (holiday) return { type: 'holiday', label: holiday };
  if (day === 0 || day === 6) return { type: 'weekend', label: day === 0 ? '\u5468\u65e5' : '\u5468\u516d' };
  if (dateStr === today) return { type: 'today', label: '\u4eca\u5929' };
  return { type: 'weekday', label: '\u5de5\u4f5c\u65e5' };
}

/* =========================================================
   Tab Switching
   ========================================================= */
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
  var tabBtn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
  if (tabBtn) tabBtn.classList.add('active');
  var tabContent = document.getElementById('tab-' + tabName);
  if (tabContent) tabContent.classList.add('active');
  if (tabName === 'plan') renderPlan();
}

/* =========================================================
   Plan Render
   ========================================================= */
function renderPlan() {
  var monthEl = document.getElementById('planMonthTitle');
  var weeksEl = document.getElementById('planWeeklyList');
  var emptyEl = document.getElementById('planEmpty');
  if (!monthEl || !weeksEl || !emptyEl) return;
  
  var month = _currentPlanMonth || formatISODate(getToday()).slice(0, 7);
  _currentPlanMonth = month;
  var p = month.split('-');
  var year = parseInt(p[0], 10);
  var mon = parseInt(p[1], 10);
  monthEl.textContent = year + '\u5e74' + mon + '\u6708';
  
  var plan = getPlan(month);
  if (!plan) {
    weeksEl.innerHTML = '';
    emptyEl.style.display = '';
    document.getElementById('planTotal').textContent = '0';
    document.getElementById('planDone').textContent = '0';
    document.getElementById('planRate').textContent = '0%';
    document.getElementById('planProgressFill').style.width = '0%';
    return;
  }
  emptyEl.style.display = 'none';
  
  // Stats
  var totalTasks = 0, doneTasks = 0;
  plan.weeks.forEach(function(w) {
    w.days.forEach(function(d) {
      d.tasks.forEach(function(t) {
        totalTasks++;
        if (t.done) doneTasks++;
      });
    });
  });
  document.getElementById('planTotal').textContent = totalTasks;
  document.getElementById('planDone').textContent = doneTasks;
  var rate = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
  document.getElementById('planRate').textContent = rate + '%';
  document.getElementById('planProgressFill').style.width = rate + '%';
  
  // Weekly list
  var html = '';
  plan.weeks.forEach(function(w, wi) {
    html += '<div class="week-card" id="week-' + w.id + '">';
    html += '<div class="week-header" onclick="toggleWeek(\'' + w.id + '\')">';
    html += '<span class="week-num">\u7b2c' + w.weekNum + '\u5468</span>';
    var goalText = w.goal || '\u70b9\u51fb\u7f16\u8f91\u672c\u5468\u76ee\u6807';
    html += '<span class="week-goal' + (w.goal ? '' : ' empty') + '" ondblclick="editWeekGoal(\'' + plan.id + '\',' + wi + ',this)">' + escHtml(goalText) + '</span>';
    // Week progress
    var wt = 0, wd = 0;
    w.days.forEach(function(d) { d.tasks.forEach(function(t) { wt++; if (t.done) wd++; }); });
    var wp = wt > 0 ? Math.round(wd / wt * 100) : 0;
    html += '<span class="week-progress">' + wd + '/' + wt + ' ' + wp + '%</span>';
    html += '<button class="week-del-btn" onclick="event.stopPropagation();deleteWeekConfirm(\'' + plan.id + '\',' + wi + ')" title="\u5220\u9664\u672c\u5468">\u2715</button>';
    html += '<svg class="week-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
    html += '</div>';
    html += '<div class="week-body"><div class="week-body-inner">';
    // Week goal editor
    html += '<div class="week-goal-edit-row">';
    html += '<input type="text" class="week-goal-input" placeholder="\u8f93\u5165\u672c\u5468\u76ee\u6807..." value="' + escAttr(w.goal || '') + '">';
    html += '<button onclick="saveWeekGoal(\'' + plan.id + '\',' + wi + ')">\u4fdd\u5b58</button>';
    html += '</div>';
    // Daily tasks
    w.days.forEach(function(d) {
      var tag = getDateTag(d.date);
      html += '<div class="day-row">';
      html += '<div class="day-header">';
      html += '<span class="day-name">' + getDayName(parseDate(d.date)) + ' ' + formatDateShort(d.date) + '</span>';
      html += '<span class="day-tag ' + tag.type + '">' + tag.label + '</span>';
      html += '</div>';
      html += '<div class="task-list" id="task-list-' + escAttr(d.date) + '">';
      d.tasks.forEach(function(t) {
        html += '<div class="task-item">';
        html += '<input type="checkbox" class="task-check" ' + (t.done ? 'checked' : '') + ' onchange="toggleTask(\'' + plan.id + '\',' + wi + ',\'' + d.date + '\',\'' + t.id + '\')">';
        html += '<span class="task-text' + (t.done ? ' done' : '') + '" ondblclick="editTaskText(\'' + plan.id + '\',' + wi + ',\'' + d.date + '\',\'' + t.id + '\',this)">' + escHtml(t.content) + '</span>';
        html += '<button class="task-del" onclick="deleteTask(\'' + plan.id + '\',' + wi + ',\'' + d.date + '\',\'' + t.id + '\')" title="\u5220\u9664">\u2715</button>';
        html += '</div>';
      });
      html += '</div>';
      html += '<div class="task-add-row">';
      html += '<input type="text" placeholder="\u6dfb\u52a0\u4efb\u52a1..." onkeydown="if(event.key===\'Enter\')addTaskFromInput(this,\'' + plan.id + '\',' + wi + ',\'' + d.date + '\')">';
      html += '<button onclick="addTaskFromInput(this.previousElementSibling,\'' + plan.id + '\',' + wi + ',\'' + d.date + '\')">\u6dfb\u52a0</button>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div></div></div>';
  });
  weeksEl.innerHTML = html;
  
  // Restore expanded state if needed
  var expanded = sessionStorage.getItem('planExpandedWeek');
  if (expanded) {
    var weekEl = document.getElementById('week-' + expanded);
    if (weekEl) { weekEl.classList.add('expanded'); }
  }
}

function escHtml(s) {
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(s || ''));
  return d.innerHTML;
}
function escAttr(s) {
  return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* =========================================================
   Plan Actions
   ========================================================= */
function toggleWeek(weekId) {
  var el = document.getElementById('week-' + weekId);
  if (!el) return;
  el.classList.toggle('expanded');
  if (el.classList.contains('expanded')) {
    sessionStorage.setItem('planExpandedWeek', weekId);
  } else {
    sessionStorage.removeItem('planExpandedWeek');
  }
}

function saveWeekGoal(planId, weekIdx) {
  var plan = getPlanFromList(planId);
  if (!plan) return;
  var input = document.querySelector('#week-' + plan.weeks[weekIdx].id + ' .week-goal-input');
  if (!input) return;
  plan.weeks[weekIdx].goal = input.value.trim();
  savePlan(plan);
  renderPlan();
}

function editWeekGoal(planId, weekIdx, el) {
  var plan = getPlanFromList(planId);
  if (!plan) return;
  var input = document.createElement('input');
  input.type = 'text';
  input.value = plan.weeks[weekIdx].goal || '';
  input.style.cssText = 'font:inherit;font-size:.88rem;border:none;border-bottom:1px solid #4f46e5;outline:none;background:transparent;flex:1;min-width:0;color:inherit;';
  el.style.display = 'none';
  el.parentNode.insertBefore(input, el);
  input.focus();
  input.select();
  input.addEventListener('blur', function() {
    plan.weeks[weekIdx].goal = input.value.trim();
    savePlan(plan);
    renderPlan();
  });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { renderPlan(); }
  });
}

function addTaskFromInput(inputEl, planId, weekIdx, date) {
  if (!inputEl || !inputEl.value.trim()) return;
  var plan = getPlanFromList(planId);
  if (!plan) return;
  var day = plan.weeks[weekIdx].days.find(function(d) { return d.date === date; });
  if (!day) return;
  day.tasks.push({ id: generateId(), content: inputEl.value.trim(), done: false });
  savePlan(plan);
  inputEl.value = '';
  renderPlan();
}

function toggleTask(planId, weekIdx, date, taskId) {
  var plan = getPlanFromList(planId);
  if (!plan) return;
  var day = plan.weeks[weekIdx].days.find(function(d) { return d.date === date; });
  if (!day) return;
  var task = day.tasks.find(function(t) { return t.id === taskId; });
  if (task) { task.done = !task.done; savePlan(plan); renderPlan(); }
}

function deleteTask(planId, weekIdx, date, taskId) {
  var plan = getPlanFromList(planId);
  if (!plan) return;
  var day = plan.weeks[weekIdx].days.find(function(d) { return d.date === date; });
  if (!day) return;
  day.tasks = day.tasks.filter(function(t) { return t.id !== taskId; });
  savePlan(plan);
  renderPlan();
}

function editTaskText(planId, weekIdx, date, taskId, el) {
  var plan = getPlanFromList(planId);
  if (!plan) return;
  var day = plan.weeks[weekIdx].days.find(function(d) { return d.date === date; });
  if (!day) return;
  var task = day.tasks.find(function(t) { return t.id === taskId; });
  if (!task) return;
  var input = document.createElement('input');
  input.type = 'text';
  input.value = task.content;
  input.className = 'task-edit-input';
  el.style.display = 'none';
  el.parentNode.insertBefore(input, el);
  input.focus();
  input.select();
  input.addEventListener('blur', function() {
    if (input.value.trim()) { task.content = input.value.trim(); savePlan(plan); }
    renderPlan();
  });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') renderPlan();
  });
}

function deleteWeekConfirm(planId, weekIdx) {
  if (!confirm('\u786e\u5b9a\u5220\u9664\u8fd9\u4e00\u5468\u7684\u8ba1\u5212\u5417\uff1f')) return;
  var plan = getPlanFromList(planId);
  if (!plan) return;
  plan.weeks.splice(weekIdx, 1);
  if (plan.weeks.length === 0) {
    deletePlan(planId);
  } else {
    savePlan(plan);
  }
  renderPlan();
}

function getPlanFromList(planId) {
  var plans = loadPlans();
  var plan = plans.find(function(p) { return p.id === planId; });
  return plan ? JSON.parse(JSON.stringify(plan)) : null;
}

/* =========================================================
   Month Navigation
   ========================================================= */
function planMonthChange(delta) {
  if (!_currentPlanMonth) _currentPlanMonth = formatISODate(getToday()).slice(0, 7);
  var p = _currentPlanMonth.split('-');
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10) + delta;
  if (m > 12) { m = 1; y++; }
  if (m < 1) { m = 12; y--; }
  _currentPlanMonth = y + '-' + String(m).padStart(2, '0');
  renderPlan();
}
function planGoToday() {
  _currentPlanMonth = formatISODate(getToday()).slice(0, 7);
  renderPlan();
}
function initMonthPlan() {
  if (!_currentPlanMonth) _currentPlanMonth = formatISODate(getToday()).slice(0, 7);
  var existing = getPlan(_currentPlanMonth);
  if (existing) { renderPlan(); return; }
  var plan = getOrCreatePlan(_currentPlanMonth);
  savePlan(plan);
  renderPlan();
}

/* =========================================================
   Plan Export / Import
   ========================================================= */
function exportPlanData() {
  var data = loadPlans();
  var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'study-plans-backup-' + formatISODate(getToday()) + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function importPlanData(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) throw new Error();
      savePlans(data);
      renderPlan();
      alert('\u5bfc\u5165\u6210\u529f\uff0c\u5171 ' + data.length + ' \u4e2a\u6708\u8ba1\u5212');
    } catch(e) { alert('\u5bfc\u5165\u5931\u8d25\uff1a\u6587\u4ef6\u683c\u5f0f\u4e0d\u6b63\u786e'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

/* =========================================================
   Setup Plan Events
   ========================================================= */
function setupPlanEvents() {
  // Any additional plan-specific events can go here
}

document.addEventListener('DOMContentLoaded', function () {
  renderAll();
  cloudSync();
  setupForm();
  setupReviewClicks();
  setupHistoryClicks();
  setupExportImport();
  setupSearch();
  setupUndo();

  // Plan system
  _currentPlanMonth = formatISODate(getToday()).slice(0, 7);
  setupPlanEvents();
  // Start on review tab
  switchTab('review');});