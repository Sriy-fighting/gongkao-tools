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
function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
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
document.addEventListener('DOMContentLoaded', function () {
  renderAll();
  setupForm();
  setupReviewClicks();
  setupHistoryClicks();
  setupExportImport();
  setupSearch();
  setupUndo();
});
