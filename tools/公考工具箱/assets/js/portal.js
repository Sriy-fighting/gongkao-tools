(function () {
  'use strict';

  var TOOLS = {
    dashboard: { name: '首页', path: null },
    exam:      { name: '套卷分数计算',   path: '../公考助手/index.html' },
    essay:     { name: '申论方格纸', path: '../申论方格纸/index.html' },
    speed:     { name: '资料速算',   path: '../资料训练/index.html' },
    curve:     { name: '遗忘曲线', path: '../遗忘曲线/index.html' }
  };

  var currentView = 'dashboard';
  var els = {};
  var syncInfo = { hasConfig: false, syncKey: '', isLoggedIn: false, email: '' };

  var timerState = { mode: 'stopwatch', running: false, elapsed: 0, laps: [], startTime: 0, tickId: null };
  var cdState = { name: '', date: '', milestones: [] };
  var links = [];
  var PLAN_STORAGE_KEY = 'gk-study-plan-v2';
  var PLAN_SUBJECTS = ['行测', '申论', '资料分析', '常识', '判断推理', '言语理解', '数量关系', '复盘', '其他'];
  var planData = { version: 3, tasks: [], monthPlans: {} };
  var planCurrentMonth = '';
  var planEditContext = {};
  var planSyncInterval = null;

  function init() {
    if (window.SyncStore) syncInfo = window.SyncStore.init();
    els.sidebar = document.querySelector('.sidebar');
    els.navItems = document.querySelectorAll('.nav-item');
    els.dashboard = document.getElementById('dashboard-view');
    els.toolContainer = document.getElementById('tool-container');
    els.toolFrame = document.getElementById('tool-frame');
    els.pageTitle = document.getElementById('page-title');
    els.mobileBtn = document.getElementById('mobile-menu-btn');
    els.sidebarOverlay = document.getElementById('sidebar-overlay');
    els.themeToggle = document.getElementById('theme-toggle');
    els.syncBtn = document.getElementById('sidebar-sync-btn');
    els.accountBtn = document.getElementById('sidebar-account-btn');
    els.planView = document.getElementById('plan-view');
    var savedTheme = localStorage.getItem('gk-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    els.navItems.forEach(function (item) {
      item.addEventListener('click', function () { navigateTo(item.dataset.view); closeMobileMenu(); });
    });
    els.mobileBtn.addEventListener('click', toggleMobileMenu);
    els.sidebarOverlay.addEventListener('click', closeMobileMenu);
    els.themeToggle.addEventListener('click', toggleTheme);
    if (els.syncBtn) els.syncBtn.addEventListener('click', openSyncConfig);
    if (els.accountBtn) els.accountBtn.addEventListener('click', openAccountModal);
    if (window.SyncStore && window.SyncStore.onAuthChange) {
      window.SyncStore.onAuthChange(function (info) {
        syncInfo.hasConfig = !!info.hasConfig;
        syncInfo.isLoggedIn = !!info.isLoggedIn;
        syncInfo.email = info.email || '';
        renderSyncStatus();
        renderAccountStatus();
      });
    }
    document.querySelectorAll('.tool-card').forEach(function (card) {
      card.addEventListener('click', function () { var v = card.dataset.view; if (v) navigateTo(v); });
    });
    initPlan();
    startPeriodicSync();
    loadAllData();
    setGreeting();
    navigateTo('dashboard');
  }

  function loadAllData() {
    var savedTheme = localStorage.getItem('gk-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    if (window.SyncStore && syncInfo.hasConfig) {
      window.SyncStore.fetchAllKeys(function (rows) {
        if (rows && rows.length > 0) {
          rows.forEach(function (row) {
            if (row.data_value != null) { try { localStorage.setItem(row.data_key, typeof row.data_value === 'string' ? row.data_value : JSON.stringify(row.data_value)); } catch(e) {} }
          });
        }
        loadFromLocal();
      });
    } else { loadFromLocal(); }
  }

  function loadFromLocal() {
    try {
      var td = JSON.parse(localStorage.getItem('gk-timer'));
      if (td) {
        timerState.elapsed = td.elapsed || 0;
        timerState.laps = td.laps || [];
        timerState.mode = td.mode || 'stopwatch';
        if (td.running && td.startTime) {
          var diff = Date.now() - td.startTime;
          if (diff < 60000) { timerState.running = true; timerState.startTime = td.startTime; }
          else { timerState.running = false; timerState.startTime = 0; timerState.elapsed = (td.elapsed || 0) + diff; }
        }
      }
    } catch(e) {}
    try { var cdd = JSON.parse(localStorage.getItem('gk-countdown')); if (cdd) { cdState.name = cdd.name || ''; cdState.date = cdd.date || ''; cdState.milestones = cdd.milestones || []; } } catch(e) {}
    try { var ld = JSON.parse(localStorage.getItem('gk-links')); if (ld && Array.isArray(ld)) links = ld; } catch(e) {}
    try {
      var sp = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY));
      if (sp && Array.isArray(sp.tasks)) planData = normalizePlanData(sp);
      else planData = normalizePlanData({ version: 2, tasks: [] });
    } catch(e) {
      planData = normalizePlanData({ version: 2, tasks: [] });
    }
    renderPlan();
    renderTimer(); renderCountdown(); renderLinks(); renderSyncStatus(); renderAccountStatus();
  }

  function navigateTo(view) {
    if (view === currentView) return;
    var tool = TOOLS[view];
    if (!tool && view !== 'plan') return;
    if (timerState.running) saveTimerState();
    els.navItems.forEach(function (el) { el.classList.remove('active'); });
    var activeNav = document.querySelector('.nav-item[data-view="' + view + '"]');
    if (activeNav) activeNav.classList.add('active');
    if (view === 'dashboard') {
      els.dashboard.style.display = '';
      if (els.planView) els.planView.style.display = 'none';
      els.toolContainer.classList.remove('active');
      els.pageTitle.textContent = '首页';
      if (timerState.running && !timerState.tickId) timerState.tickId = setInterval(tickTimer, 100);
    } else if (view === 'plan') {
      els.dashboard.style.display = 'none';
      if (els.planView) els.planView.style.display = '';
      els.toolContainer.classList.remove('active');
      els.pageTitle.textContent = '学习计划';
      renderPlan();
    } else {
      els.dashboard.style.display = 'none';
      if (els.planView) els.planView.style.display = 'none';
      els.toolContainer.classList.add('active');
      els.pageTitle.textContent = tool.name;
      els.toolFrame.src = tool.path;
    }
    currentView = view;
  }

  function setGreeting() {
    var h = new Date().getHours();
    var greet;
    if (h < 6) greet = '夜深了，还在学习';
    else if (h < 9) greet = '早上好';
    else if (h < 12) greet = '上午好';
    else if (h < 14) greet = '中午好';
    else if (h < 18) greet = '下午好';
    else greet = '晚上好';
    var el = document.getElementById('greeting-text');
    if (el) el.textContent = greet;
    var dateEl = document.getElementById('greeting-date');
    if (dateEl) {
      var now = new Date();
      var y = now.getFullYear();
      var m = String(now.getMonth() + 1).padStart(2, '0');
      var d = String(now.getDate()).padStart(2, '0');
      var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      var wd = weekdays[now.getDay()];
      dateEl.textContent = y + '年' + m + '月' + d + '日 星期' + wd;
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('gk-theme', next); } catch(e) {}
    if (window.SyncStore) window.SyncStore.writeData('gk-theme', next);
    updateThemeIcon(next);
  }

  function updateThemeIcon(theme) {
    var icon = els.themeToggle && els.themeToggle.querySelector('.theme-icon');
    var label = els.themeToggle && els.themeToggle.querySelector('.theme-label');
    if (!icon || !label) return;
    if (theme === 'dark') {
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
      label.textContent = '浅色模式';
    } else {
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      label.textContent = '深色模式';
    }
  }

  function saveTimerState() {
    try {
      var data = { mode: timerState.mode, running: timerState.running, elapsed: timerState.elapsed, laps: timerState.laps, startTime: timerState.running ? Date.now() : 0 };
      localStorage.setItem('gk-timer', JSON.stringify(data));
      if (window.SyncStore && !timerState.running) window.SyncStore.writeData('gk-timer', data);
    } catch(e) {}
  }

  function formatMs(ms) {
    var ts = Math.floor(ms / 1000);
    return String(Math.floor(ts / 3600)).padStart(2,'0') + ':' + String(Math.floor((ts % 3600) / 60)).padStart(2,'0') + ':' + String(ts % 60).padStart(2,'0') + '.' + String(Math.floor((ms % 1000) / 10)).padStart(2,'0');
  }

  function formatSimple(ms) {
    var ts = Math.floor(Math.max(0, ms) / 1000);
    return String(Math.floor(ts / 3600)).padStart(2,'0') + ':' + String(Math.floor((ts % 3600) / 60)).padStart(2,'0') + ':' + String(ts % 60).padStart(2,'0');
  }

  function tickTimer() {
    if (!timerState.running) return;
    var elapsed = timerState.elapsed + (Date.now() - timerState.startTime);
    updateTimerDisplay(elapsed);
  }

  function updateTimerDisplay(elapsedMs) {
    var display = document.getElementById('timer-display');
    var lapList = document.getElementById('timer-laps');
    var lapTitle = document.getElementById('timer-laps-title');
    if (!display) return;
    if (timerState.mode === 'stopwatch') {
      display.textContent = formatMs(elapsedMs);
    } else {
      var cdRemaining = timerState.elapsed;
      if (timerState.running && timerState.startTime) cdRemaining = Math.max(0, timerState.elapsed - (Date.now() - timerState.startTime));
      display.textContent = formatSimple(cdRemaining);
      if (cdRemaining <= 0) {
        display.classList.add('countdown-warning');
        if (timerState.running) { timerState.running = false; clearInterval(timerState.tickId); timerState.tickId = null; saveTimerState(); playAlarm(); showSyncToast('倒计时结束！'); }
      } else if (cdRemaining < 60000) display.classList.add('countdown-warning');
      else display.classList.remove('countdown-warning');
    }
    if (lapList && timerState.mode === 'stopwatch') {
      if (timerState.laps.length > 0) {
        if (lapTitle) { lapTitle.classList.add('visible'); lapTitle.textContent = '分段记录'; }
        lapList.innerHTML = '';
        for (var i = timerState.laps.length - 1; i >= 0; i--) {
          var row = document.createElement('div'); row.className = 'timer-lap-row';
          row.innerHTML = '<span>第' + (i+1) + '段</span><span>' + formatMs(timerState.laps[i]) + '</span>';
          lapList.appendChild(row);
        }
      } else {
        if (lapTitle) lapTitle.classList.remove('visible');
        lapList.innerHTML = '<div class="timer-empty-laps">点击“记次”记录分段时间</div>';
      }
    }
  }

  function timerStartStop() {
    var btn = document.getElementById('timer-start-btn');
    if (timerState.mode === 'stopwatch') {
      if (timerState.running) {
        timerState.running = false; timerState.elapsed += Date.now() - timerState.startTime; timerState.startTime = 0;
        if (timerState.tickId) { clearInterval(timerState.tickId); timerState.tickId = null; }
        if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
        saveTimerState();
      } else {
        timerState.running = true; timerState.startTime = Date.now();
        if (timerState.tickId) clearInterval(timerState.tickId);
        timerState.tickId = setInterval(tickTimer, 100);
        if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      }
    } else {
      if (timerState.running) {
        timerState.running = false; timerState.startTime = 0;
        if (timerState.tickId) { clearInterval(timerState.tickId); timerState.tickId = null; }
        if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
        saveTimerState();
      } else {
        if (timerState.elapsed <= 0) {
          var hInp = document.getElementById('countdown-h'), mInp = document.getElementById('countdown-m'), sInp = document.getElementById('countdown-s');
          var hh = parseInt(hInp ? hInp.value : 0, 10) || 0, mm = parseInt(mInp ? mInp.value : 0, 10) || 0, ss = parseInt(sInp ? sInp.value : 0, 10) || 0;
          timerState.elapsed = ((hh * 3600) + (mm * 60) + ss) * 1000;
          if (timerState.elapsed <= 0) { showSyncToast('请设置倒计时时长'); return; }
        }
        timerState.running = true; timerState.startTime = Date.now();
        if (timerState.tickId) clearInterval(timerState.tickId);
        timerState.tickId = setInterval(tickTimer, 100);
        if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      }
    }
  }

  function timerReset() {
    timerState.running = false; timerState.elapsed = 0; timerState.laps = []; timerState.startTime = 0;
    if (timerState.tickId) { clearInterval(timerState.tickId); timerState.tickId = null; }
    var d = document.getElementById('timer-display'), b = document.getElementById('timer-start-btn');
    if (d) { d.textContent = timerState.mode === 'stopwatch' ? '00:00:00.00' : '00:00:00'; d.classList.remove('countdown-warning'); }
    if (b) b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    var lt = document.getElementById('timer-laps-title'), ll = document.getElementById('timer-laps');
    if (lt) lt.classList.remove('visible'); if (ll) ll.innerHTML = '';
    saveTimerState();
  }

  function timerLap() {
    if (!timerState.running || timerState.mode !== 'stopwatch') return;
    timerState.laps.push(timerState.elapsed + (Date.now() - timerState.startTime));
    updateTimerDisplay(timerState.elapsed + (Date.now() - timerState.startTime));
    saveTimerState();
  }

  function switchTimerMode(mode) {
    if (timerState.running) { timerState.running = false; if (timerState.tickId) { clearInterval(timerState.tickId); timerState.tickId = null; } }
    timerState.mode = mode; timerState.elapsed = 0; timerState.laps = []; timerState.startTime = 0;
    var display = document.getElementById('timer-display'), btn = document.getElementById('timer-start-btn');
    var lapBtn = document.getElementById('timer-lap-btn'), cdSetup = document.getElementById('countdown-setup');
    var swLaps = document.getElementById('sw-lap-area'), lapTitle = document.getElementById('timer-laps-title');
    if (display) { display.textContent = mode === 'stopwatch' ? '00:00:00.00' : '00:00:00'; display.classList.remove('countdown-warning'); }
    if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    if (lapBtn) lapBtn.style.display = mode === 'stopwatch' ? '' : 'none';
    if (cdSetup) cdSetup.style.display = mode === 'countdown' ? '' : 'none';
    if (swLaps) swLaps.style.display = mode === 'stopwatch' ? '' : 'none';
    if (lapTitle) lapTitle.classList.remove('visible');
    document.querySelectorAll('.timer-mode-tab').forEach(function(t){t.classList.remove('active');});
    var at = document.querySelector('.timer-mode-tab[data-mode="' + mode + '"]');
    if (at) at.classList.add('active');
    saveTimerState();
  }

  function playAlarm() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      for (var i = 0; i < 4; i++) {
        (function(d) { setTimeout(function() {
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; o.type = 'sine';
          g.gain.setValueAtTime(0.4, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
          o.start(ctx.currentTime); o.stop(ctx.currentTime + 1);
        }, d); })(i * 700);
      }
    } catch(e) {}
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('考公工具箱', { body: '倒计时已结束！' });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  function renderTimer() {
    if (timerState.running && timerState.startTime && !timerState.tickId) timerState.tickId = setInterval(tickTimer, 100);
    var elapsed = timerState.elapsed + (timerState.running && timerState.startTime ? Date.now() - timerState.startTime : 0);
    var display = document.getElementById('timer-display');
    if (!display) return;
    if (timerState.mode === 'stopwatch') display.textContent = formatMs(elapsed);
    else {
      var r = timerState.elapsed - (timerState.running && timerState.startTime ? Date.now() - timerState.startTime : 0);
      display.textContent = formatSimple(Math.max(0, r));
    }
    var btn = document.getElementById('timer-start-btn');
    if (btn) btn.innerHTML = timerState.running
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    var lapBtn = document.getElementById('timer-lap-btn'), cdSetup = document.getElementById('countdown-setup'), swLaps = document.getElementById('sw-lap-area');
    if (lapBtn) lapBtn.style.display = timerState.mode === 'stopwatch' ? '' : 'none';
    if (cdSetup) cdSetup.style.display = timerState.mode === 'countdown' ? '' : 'none';
    if (swLaps) swLaps.style.display = timerState.mode === 'stopwatch' ? '' : 'none';
    updateTimerDisplay(elapsed);
  }

  function renderCountdown() {
    var section = document.getElementById('countdown-section');
    if (!section) return;
    if (!cdState.name || !cdState.date) {
      section.innerHTML = '<div class="countdown-empty"><p>还没有设置考试目标</p><button onclick="window.openCountdownConfig()">设置考试</button></div>';
      return;
    }
    var targetDate = new Date(cdState.date + 'T00:00:00');
    var now = new Date(); now.setHours(0,0,0,0);
    var diffDays = Math.ceil((targetDate - now) / (1000*60*60*24));
    var firstMs = (cdState.milestones.length > 0 && cdState.milestones[0].date) ? new Date(cdState.milestones[0].date + 'T00:00:00').getTime() : targetDate.getTime();
    var totalDays = Math.max(1, Math.ceil((targetDate.getTime() - firstMs) / (1000*60*60*24)));
    var passedDays = Math.max(0, Math.ceil((now.getTime() - firstMs) / (1000*60*60*24)));
    var pct = Math.min(100, Math.round(passedDays / totalDays * 100));
    var done = 0;
    var mh = '';
    cdState.milestones.forEach(function(ms) {
      var md = new Date(ms.date + 'T00:00:00'), isDone = md <= now;
      if (isDone) done++;
      mh += '<div class="countdown-milestone ' + (isDone ? 'done' : 'upcoming') + '"><div class="ms-check">' + (isDone ? '✓' : '') + '</div><span class="ms-name">' + (ms.name||'') + '</span><span class="ms-date">' + (ms.date||'') + '</span></div>';
    });
    section.innerHTML = '<div class="countdown-header"><div class="countdown-title">' + cdState.name + '</div><button class="countdown-edit-btn" onclick="window.openCountdownConfig()">编辑</button></div>' +
      '<div class="countdown-big-number">' + (diffDays > 0 ? diffDays : 0) + '</div><div class="countdown-big-unit">' + (diffDays > 0 ? '天' : '已到期') + '</div>' +
      '<div class="countdown-progress"><div class="countdown-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="countdown-milestones-title">里程碑 (' + done + '/' + cdState.milestones.length + ')</div><div class="countdown-milestones">' + mh + '</div>';
  }

  function saveCountdownConfig() { try { localStorage.setItem('gk-countdown', JSON.stringify(cdState)); if (window.SyncStore) window.SyncStore.writeData('gk-countdown', cdState); } catch(e) {} renderCountdown(); }

  function openCountdownConfig() {
    var overlay = document.getElementById('cd-config-overlay'); if (!overlay) return;
    var nameInp = document.getElementById('cd-config-name'), dateInp = document.getElementById('cd-config-date');
    if (nameInp) nameInp.value = cdState.name || '';
    if (dateInp) dateInp.value = cdState.date || '';
    var list = document.getElementById('cd-config-milestones');
    if (list) {
      var defMs = [{name:'报名截止',date:''},{name:'缴费截止',date:''},{name:'打印准考证',date:''},{name:'笔试',date:''},{name:'面试',date:''}];
      var msList = cdState.milestones.length > 0 ? cdState.milestones : defMs;
      list.innerHTML = '';
      msList.forEach(function(ms, idx) {
        var div = document.createElement('div'); div.className = 'countdown-config-milestone';
        div.innerHTML = '<label>' + (ms.name||'') + '</label><input type="date" class="cd-ms-date" data-idx="' + idx + '" value="' + (ms.date||'') + '">';
        list.appendChild(div);
      });
    }
    overlay.classList.add('open');
  }

  function saveCountdownConfigModal() {
    var nameInp = document.getElementById('cd-config-name'), dateInp = document.getElementById('cd-config-date');
    if (nameInp) cdState.name = nameInp.value;
    if (dateInp) cdState.date = dateInp.value;
    var list = document.getElementById('cd-config-milestones');
    if (list) {
      var defMs = [{name:'报名截止',date:''},{name:'缴费截止',date:''},{name:'打印准考证',date:''},{name:'笔试',date:''},{name:'面试',date:''}];
      cdState.milestones = cdState.milestones.length > 0 ? cdState.milestones : defMs;
      list.querySelectorAll('.cd-ms-date').forEach(function(inp) { var idx = parseInt(inp.dataset.idx, 10); if (cdState.milestones[idx]) cdState.milestones[idx].date = inp.value; });
    }
    saveCountdownConfig();
    closeCountdownConfigModal();
  }

  function closeCountdownConfigModal() { var o = document.getElementById('cd-config-overlay'); if (o) o.classList.remove('open'); }
  window.openCountdownConfig = openCountdownConfig;

  function renderLinks() {
    var c = document.getElementById('footer-links'), e = document.getElementById('footer-links-empty');
    if (!c) return;
    if (links.length === 0) { c.innerHTML = ''; if (e) e.style.display = ''; return; }
    if (e) e.style.display = 'none';
    c.innerHTML = '';
    links.forEach(function(l) {
      var a = document.createElement('a'); a.className = 'dashboard-footer-link'; a.href = l.url; a.target = '_blank'; a.rel = 'noopener';
      a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' + (l.name || l.url);
      c.appendChild(a);
    });
  }

  function saveLinks() { try { localStorage.setItem('gk-links', JSON.stringify(links)); if (window.SyncStore) window.SyncStore.writeData('gk-links', links); } catch(e) {} renderLinks(); }

  function openLinkManager() { var o = document.getElementById('link-manager-overlay'); if (!o) return; renderLinkManagerList(); o.classList.add('open'); }
  function closeLinkManager() { var o = document.getElementById('link-manager-overlay'); if (o) o.classList.remove('open'); }

  function addLink() {
    var n = document.getElementById('lm-new-name'), u = document.getElementById('lm-new-url');
    if (!n || !u) return;
    var name = n.value.trim(), url = u.value.trim();
    if (!name) { showSyncToast('请输入链接名称'); return; }
    if (!url) { showSyncToast('请输入链接网址'); return; }
    if (!url.match(/^https?:\/\//i)) url = 'https://' + url;
    links.push({name:name, url:url}); n.value = ''; u.value = '';
    saveLinks(); renderLinkManagerList(); n.focus();
  }

  function deleteLink(idx) { links.splice(idx, 1); saveLinks(); renderLinkManagerList(); }
  window.deleteLink = deleteLink;

  function renderLinkManagerList() {
    var list = document.getElementById('link-manager-list'), empty = document.getElementById('link-manager-empty');
    if (!list) return;
    if (links.length === 0) { list.innerHTML = ''; if (empty) empty.style.display = ''; return; }
    if (empty) empty.style.display = 'none';
    list.innerHTML = '';
    links.forEach(function(l, idx) {
      var div = document.createElement('div'); div.className = 'link-manager-item'; div.draggable = true; div.dataset.idx = idx;
      div.innerHTML = '<span class="drag-handle"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/></svg></span><span class="lm-name">' + esc(l.name) + '</span><span class="lm-url">' + esc(l.url) + '</span><button class="lm-del-btn" onclick="window.deleteLink(' + idx + ')" title="删除">✕</button>';
      div.addEventListener('dragstart', function() { div.classList.add('dragging'); });
      div.addEventListener('dragend', function() { div.classList.remove('dragging'); });
      div.addEventListener('dragover', function(e) { e.preventDefault(); });
      div.addEventListener('drop', function(e) {
        e.preventDefault();
        var fi = parseInt(e.dataTransfer.getData('text/plain'), 10), ti = parseInt(div.dataset.idx, 10);
        if (fi !== ti && !isNaN(fi) && !isNaN(ti)) { var item = links.splice(fi, 1)[0]; links.splice(ti, 0, item); saveLinks(); renderLinkManagerList(); }
      });
      list.appendChild(div);
    });
  }

  function esc(s) { var d = document.createElement('div'); d.appendChild(document.createTextNode(s||'')); return d.innerHTML; }
  function jsArg(s) { return esc(JSON.stringify(String(s == null ? '' : s))); }

  function renderSyncStatus() {
    var el = document.getElementById('sidebar-sync-status');
    if (!el) return;
    el.className = 'sidebar-sync-status ' + (syncInfo.isLoggedIn ? 'online' : (syncInfo.hasConfig ? 'pending' : 'offline'));
    el.title = syncInfo.isLoggedIn ? '账号同步已连接' : (syncInfo.hasConfig ? '账号同步待登录' : '账号同步未配置');
  }

  function openSyncConfig() {
    var overlay = document.getElementById('sync-overlay'); if (!overlay) return;
    var dot = document.getElementById('sync-status-dot'), txt = document.getElementById('sync-status-text');
    if (syncInfo.isLoggedIn) { if (dot) dot.className = 'sync-status-dot online'; if (txt) txt.textContent = '已登录：' + syncInfo.email; }
    else if (syncInfo.hasConfig) { if (dot) dot.className = 'sync-status-dot pending'; if (txt) txt.textContent = '账号同步已配置，请在“账号”中登录'; }
    else { if (dot) dot.className = 'sync-status-dot pending'; if (txt) txt.textContent = '未配置 - 请填写 Supabase 项目地址和公开密钥'; }
    overlay.classList.add('open');
  }

  function closeSyncConfig() { var o = document.getElementById('sync-overlay'); if (o) o.classList.remove('open'); }

  function applySyncKey() {}
  function copySyncKey() {}

  function renderAccountStatus() {
    var info = window.SyncStore && window.SyncStore.getAuthInfo ? window.SyncStore.getAuthInfo() : syncInfo;
    syncInfo.hasConfig = !!info.hasConfig;
    syncInfo.isLoggedIn = !!info.isLoggedIn;
    syncInfo.email = info.email || '';
    var status = document.getElementById('sidebar-account-status');
    var label = document.getElementById('sidebar-account-label');
    if (status) {
      status.className = 'sidebar-sync-status ' + (syncInfo.isLoggedIn ? 'online' : (syncInfo.hasConfig ? 'pending' : 'offline'));
      status.title = syncInfo.isLoggedIn ? ('已登录：' + syncInfo.email) : (syncInfo.hasConfig ? '未登录' : '账号同步未配置');
    }
    if (label) label.textContent = syncInfo.isLoggedIn ? '已登录' : '账号';
    renderAccountModal();
  }

  function setAccountMessage(msg) {
    var el = document.getElementById('account-message');
    if (el) el.textContent = msg || '';
  }

  function renderAccountModal() {
    var warning = document.getElementById('account-config-warning');
    var authForm = document.getElementById('account-auth-form');
    var userPanel = document.getElementById('account-user-panel');
    var dot = document.getElementById('account-status-dot');
    var text = document.getElementById('account-status-text');
    var emailEl = document.getElementById('account-email-display');
    if (warning) warning.style.display = syncInfo.hasConfig ? 'none' : '';
    if (authForm) authForm.style.display = (!syncInfo.isLoggedIn && syncInfo.hasConfig) ? '' : 'none';
    if (userPanel) userPanel.style.display = syncInfo.isLoggedIn ? '' : 'none';
    if (emailEl) emailEl.textContent = syncInfo.email || '';
    if (dot) dot.className = 'sync-status-dot ' + (syncInfo.isLoggedIn ? 'online' : (syncInfo.hasConfig ? 'pending' : 'offline'));
    if (text) text.textContent = syncInfo.isLoggedIn ? ('已登录：' + syncInfo.email) : (syncInfo.hasConfig ? '未登录 - 本地数据仍会保存' : '未配置 - 请先填写同步配置');
  }

  function openAccountModal() {
    renderAccountStatus();
    setAccountMessage('');
    var overlay = document.getElementById('account-overlay');
    if (overlay) overlay.classList.add('open');
  }

  function closeAccountModal() {
    var overlay = document.getElementById('account-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function getAccountCredentials() {
    var email = document.getElementById('account-email');
    var password = document.getElementById('account-password');
    return { email: email ? email.value.trim() : '', password: password ? password.value : '' };
  }

  function accountSignIn() {
    var c = getAccountCredentials();
    if (!c.email || !c.password) { setAccountMessage('请输入邮箱和密码'); return; }
    setAccountMessage('正在登录并同步...');
    window.SyncStore.signIn(c.email, c.password).then(function () {
      setAccountMessage('登录成功，已同步本地数据');
      loadAllData();
    }).catch(function (err) { setAccountMessage(err && err.message ? err.message : '登录失败'); });
  }

  function accountSignUp() {
    var c = getAccountCredentials();
    if (!c.email || !c.password) { setAccountMessage('请输入邮箱和密码'); return; }
    setAccountMessage('正在注册...');
    window.SyncStore.signUp(c.email, c.password).then(function () {
      var info = window.SyncStore.getAuthInfo();
      if (info.isLoggedIn) { setAccountMessage('注册成功，已同步本地数据'); loadAllData(); }
      else { setAccountMessage('注册成功，请先到邮箱确认后再登录'); }
    }).catch(function (err) { setAccountMessage(err && err.message ? err.message : '注册失败'); });
  }

  function accountSignOut() {
    setAccountMessage('正在退出...');
    window.SyncStore.signOut().then(function () { setAccountMessage('已退出登录，本地数据仍保留'); });
  }

  function accountManualSync() {
    if (!window.SyncStore || !window.SyncStore.mergeLocalWithCloud) return;
    setAccountMessage('正在同步...');
    window.SyncStore.mergeLocalWithCloud(function (result) {
      setAccountMessage('同步完成：上传 ' + result.uploaded + ' 项，检查云端 ' + result.downloaded + ' 项');
      loadAllData();
    });
  }

  function showSyncToast(msg) {
    var t = document.getElementById('sync-toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function() { t.classList.remove('show'); }, 2500);
  }

  function toggleMobileMenu() { els.sidebar.classList.toggle('open'); els.sidebarOverlay.classList.toggle('open'); }
  function closeMobileMenu() { els.sidebar.classList.remove('open'); els.sidebarOverlay.classList.remove('open'); }

  

  // =========================================================
  //  Plan Module （学习计划）
  // =========================================================

  var WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

  function initPlan() {
    planCurrentMonth = getCurrentMonthId();
  }

  function getCurrentMonthId() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function getId() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function getDayOfWeek(dateStr) {
    var parts = dateStr.split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var dow = d.getDay();
    return dow === 0 ? 6 : dow - 1;
  }

  function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function isToday(dateStr) { return dateStr === getTodayStr(); }

  function getHolidayName(dateStr) {
    var mmdd = dateStr.slice(5);
    return planHolidays[mmdd] || null;
  }

  function getDayBadge(dateStr) {
    var h = getHolidayName(dateStr);
    if (h) return { text: h, type: 'holiday' };
    var dow = getDayOfWeek(dateStr);
    if (dow === 5) return { text: '休', type: 'sat' };
    if (dow === 6) return { text: '休', type: 'sun' };
    return null;
  }

  function isCurrentWeek(week) {
    var today = getTodayStr();
    for (var i = 0; i < week.days.length; i++) {
      if (week.days[i].date === today) return true;
    }
    return false;
  }

  function getMonthData(ym) {
    for (var i = 0; i < planData.months.length; i++) {
      if (planData.months[i].id === ym) return planData.months[i];
    }
    return null;
  }

  function getMonthIndex(ym) {
    for (var i = 0; i < planData.months.length; i++) {
      if (planData.months[i].id === ym) return i;
    }
    return -1;
  }

  function normalizePlanMonth(month) {
    if (!month) return month;
    if (!Array.isArray(month.todos)) month.todos = [];
    if (!Array.isArray(month.weeks)) month.weeks = [];
    for (var i = 0; i < month.weeks.length; i++) {
      var week = month.weeks[i];
      if (!Array.isArray(week.days)) week.days = [];
      for (var j = 0; j < week.days.length; j++) {
        if (!Array.isArray(week.days[j].tasks)) week.days[j].tasks = [];
      }
    }
    return month;
  }

  function normalizePlanData() {
    for (var i = 0; i < planData.months.length; i++) normalizePlanMonth(planData.months[i]);
  }

  function findWeekContext(weekId) {
    for (var i = 0; i < planData.months.length; i++) {
      var month = normalizePlanMonth(planData.months[i]);
      for (var j = 0; j < month.weeks.length; j++) {
        if (month.weeks[j].id === weekId) return { month: month, monthIndex: i, week: month.weeks[j], weekIndex: j };
      }
    }
    return null;
  }

  function findDayContext(weekId, dateStr) {
    var ctx = findWeekContext(weekId);
    if (!ctx) return null;
    for (var i = 0; i < ctx.week.days.length; i++) {
      if (ctx.week.days[i].date === dateStr) {
        ctx.day = ctx.week.days[i];
        ctx.dayIndex = i;
        return ctx;
      }
    }
    return null;
  }

  function findTaskContext(weekId, dateStr, taskId) {
    var ctx = findDayContext(weekId, dateStr);
    if (!ctx) return null;
    for (var i = 0; i < ctx.day.tasks.length; i++) {
      if (ctx.day.tasks[i].id === taskId) {
        ctx.task = ctx.day.tasks[i];
        ctx.taskIndex = i;
        return ctx;
      }
    }
    return null;
  }

  function findMonthTodoContext(todoId) {
    var month = normalizePlanMonth(getMonthData(planCurrentMonth));
    if (!month) return null;
    for (var i = 0; i < month.todos.length; i++) {
      if (month.todos[i].id === todoId) return { month: month, todo: month.todos[i], todoIndex: i };
    }
    return null;
  }

  function createMonthTemplate(ym) {
    var parts = ym.split('-');
    var y = parseInt(parts[0]);
    var m = parseInt(parts[1]);
    var firstDay = new Date(y, m - 1, 1);
    var firstDOW = firstDay.getDay();
    var firstDOWMon = firstDOW === 0 ? 6 : firstDOW - 1;
    var daysInMonth = new Date(y, m, 0).getDate();
    var weeks = [];
    var weekNum = 1;
    var day = 1;
    while (day <= daysInMonth) {
      var offset = day === 1 ? firstDOWMon : 0;
      var daysInWeek = Math.min(7 - offset, daysInMonth - day + 1);
      var weekEnd = day + daysInWeek - 1;
      var days = [];
      for (var d = day; d <= weekEnd; d++) {
        days.push({ date: ym + '-' + pad2(d), tasks: [] });
      }
      weeks.push({
        id: 'w-' + ym + '-' + weekNum,
        weekNum: weekNum,
        label: '第' + weekNum + '周 (' + day + '/' + m + '-' + weekEnd + '/' + m + ')',
        goals: '',
        days: days,
        expanded: false
      });
      weekNum++;
      day = weekEnd + 1;
    }
    return { id: ym, title: m + '月学习计划', focus: '', todos: [], weeks: weeks };
  }

  function savePlan() {
    try {
      var monthIds = [];
      for (var _si = 0; _si < planData.months.length; _si++) {
        var _sm = planData.months[_si];
        var _sk = 'gk-plan-' + _sm.id;
        localStorage.setItem(_sk, JSON.stringify(_sm));
        monthIds.push(_sm.id);
        if (window.SyncStore) window.SyncStore.writeData(_sk, _sm);
      }
      localStorage.setItem('gk-plan-index', JSON.stringify(monthIds));
      if (window.SyncStore) window.SyncStore.writeData('gk-plan-index', monthIds);
    } catch (e) {}
  }

  function savePlanHolidays() {
    try {
      localStorage.setItem('gk-plan-holidays', JSON.stringify(planHolidays));
      if (window.SyncStore) window.SyncStore.writeData('gk-plan-holidays', planHolidays);
    } catch (e) {}
  }

  function calcMonthProgress(month) {
    var total = 0, done = 0;
    month = normalizePlanMonth(month);
    for (var mt = 0; mt < month.todos.length; mt++) {
      total++;
      if (month.todos[mt].done) done++;
    }
    for (var i = 0; i < month.weeks.length; i++) {
      for (var j = 0; j < month.weeks[i].days.length; j++) {
        for (var k = 0; k < month.weeks[i].days[j].tasks.length; k++) {
          total++;
          if (month.weeks[i].days[j].tasks[k].done) done++;
        }
      }
    }
    return { total: total, done: done, pct: total > 0 ? Math.round(done / total * 100) : 0 };
  }

  function calcWeekProgress(week) {
    var total = 0, done = 0;
    if (!week || !Array.isArray(week.days)) return { total: total, done: done, pct: 0 };
    for (var j = 0; j < week.days.length; j++) {
      for (var k = 0; k < week.days[j].tasks.length; k++) {
        total++;
        if (week.days[j].tasks[k].done) done++;
      }
    }
    return { total: total, done: done, pct: total > 0 ? Math.round(done / total * 100) : 0 };
  }

  function planNewMonth() {
    var ym = planCurrentMonth;
    var existing = getMonthData(ym);
    if (existing) { showSyncToast('本月计划已存在'); return; }
    var tmpl = createMonthTemplate(ym);
    planData.months.push(tmpl);
    savePlan();
    renderPlan();
    showSyncToast('已创建 ' + tmpl.title);
  }

  function planPrevMonth() {
    var parts = planCurrentMonth.split('-');
    var y = parseInt(parts[0]), m = parseInt(parts[1]);
    m--;
    if (m < 1) { m = 12; y--; }
    planCurrentMonth = y + '-' + pad2(m);
    renderPlan();
  }

  function planNextMonth() {
    var parts = planCurrentMonth.split('-');
    var y = parseInt(parts[0]), m = parseInt(parts[1]);
    m++;
    if (m > 12) { m = 1; y++; }
    planCurrentMonth = y + '-' + pad2(m);
    renderPlan();
  }

  function planToggleWeek(weekId) {
    var ctx = findWeekContext(weekId);
    if (!ctx) return;
    ctx.week.expanded = !ctx.week.expanded;
    savePlan();
    renderPlan();
  }

  // --- rendering ---
  function renderPlan() {
    var el = els.planView;
    if (!el || el.style.display === 'none') return;
    var month = getMonthData(planCurrentMonth);
    var emptyEl = document.getElementById('plan-empty');
    var navEl = document.querySelector('.plan-nav');
    var cardEl = document.getElementById('plan-month-card');
    var weeksEl = document.getElementById('plan-weeks');
    var quickEl = document.getElementById('plan-quick-add');
    if (!month) {
      if (emptyEl) emptyEl.style.display = '';
      if (navEl) navEl.style.display = 'none';
      if (cardEl) cardEl.innerHTML = '';
      if (weeksEl) weeksEl.innerHTML = '';
      if (quickEl) quickEl.style.display = 'none';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    if (navEl) navEl.style.display = '';
    var titleEl = document.getElementById('plan-nav-title');
    if (titleEl) {
      var parts = planCurrentMonth.split('-');
      titleEl.textContent = parts[0] + '年' + parseInt(parts[1]) + '月';
    }
    renderMonthCard(month);
    renderWeeks(month);
    renderQuickAdd(month);
  }

  function renderMonthCard(month) {
    var el = document.getElementById('plan-month-card');
    if (!el) return;
    month = normalizePlanMonth(month);
    var prog = calcMonthProgress(month);
    var title = month.title || month.id.slice(5) + '月学习计划';
    var focus = month.focus || '暂无本月重点';
    var todoHtml = '';
    if (month.todos.length === 0) {
      todoHtml = '<div class="plan-month-todo-empty">暂无月度待办</div>';
    } else {
      for (var i = 0; i < month.todos.length; i++) {
        var todo = month.todos[i];
        todoHtml += '<div class="plan-task plan-month-todo-item"><label class="plan-task-check"><input type="checkbox" ' + (todo.done ? 'checked' : '') + ' onchange="planToggleMonthTodo(' + jsArg(todo.id) + ')"><span class="plan-task-checkmark"></span></label><span class="plan-task-text' + (todo.done ? ' plan-task-done' : '') + '">' + esc(todo.text) + '</span><span class="plan-task-actions"><button class="plan-task-btn plan-task-btn-danger" onclick="planDeleteMonthTodo(' + jsArg(todo.id) + ')" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span></div>';
      }
    }
    el.innerHTML = '<div class="plan-section-label">月度计划</div><div class="plan-month-card"><div class="plan-month-header"><div class="plan-month-title">' + esc(title) + '</div><div class="plan-month-actions"><button class="plan-icon-btn" onclick="planEditMonth()" title="编辑"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button><button class="plan-icon-btn plan-icon-btn-danger" onclick="planDeleteMonth()" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></div></div><div class="plan-month-focus">' + esc(focus) + '</div><div class="plan-month-todos"><div class="plan-month-todo-title">月度待办</div><div class="plan-month-todo-list">' + todoHtml + '</div><div class="plan-day-add plan-month-todo-add"><input type="text" class="plan-day-input" placeholder="添加月度待办..." onkeydown="if(event.key===\x27Enter\x27)planAddMonthTodo(this)"><button class="plan-day-add-btn" onclick="planAddMonthTodo(this.previousElementSibling)" title="添加">+</button></div></div>' + (prog.total > 0 ? '<div class="plan-month-progress"><div class="plan-month-progress-bar"><div class="plan-month-progress-fill" style="width:' + prog.pct + '%"></div></div><span class="plan-month-progress-text">已完成 ' + prog.done + '/' + prog.total + ' 项 (' + prog.pct + '%)</span></div>' : '<div class="plan-month-empty-hint">暂无任务，在月度待办或下方周计划中添加</div>') + '</div>';
  }

  function renderWeeks(month) {
    var el = document.getElementById('plan-weeks');
    if (!el) return;
    var html = '<div class="plan-section-label">每周目标</div>';
    var hasCurrent = false;
    for (var i = 0; i < month.weeks.length; i++) {
      var w = month.weeks[i];
      var isCur = isCurrentWeek(w);
      if (isCur && !hasCurrent) { w.expanded = true; hasCurrent = true; }
      else if (!isCur && !w.expanded) { /* keep collapsed */ }
      var prog = calcWeekProgress(w);
      html += '<div class="plan-week' + (isCur ? ' plan-week-current' : '') + '"><div class="plan-week-header" onclick="planToggleWeek(' + jsArg(w.id) + ')"><span class="plan-week-toggle">' + (w.expanded ? '▾' : '▸') + '</span><span class="plan-week-label">' + esc(w.label) + '</span>' + (prog.total > 0 ? '<span class="plan-week-progress-badge">' + prog.done + '/' + prog.total + '</span>' : '') + '<span class="plan-week-actions" onclick="event.stopPropagation()"><button class="plan-icon-btn plan-icon-btn-sm" onclick="planEditWeek(' + jsArg(w.id) + ')" title="编辑目标"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button><button class="plan-icon-btn plan-icon-btn-sm plan-icon-btn-danger" onclick="planDeleteWeek(' + jsArg(w.id) + ')" title="删除周"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></span></div>' + (w.expanded ? '<div class="plan-week-body">' + (w.goals ? '<div class="plan-week-goals">' + esc(w.goals) + '</div>' : '') + '<div class="plan-week-days">' + renderDays(w) + '</div></div>' : '') + '</div>';
    }
    el.innerHTML = html;
  }

  function renderDays(week) {
    var html = '';
    for (var i = 0; i < week.days.length; i++) {
      html += renderDay(week.days[i], week.id);
    }
    return html;
  }

  function renderDay(day, weekId) {
    var badge = getDayBadge(day.date);
    var today = isToday(day.date);
    var dow = getDayOfWeek(day.date);
    var isWknd = dow >= 5;
    var dateParts = day.date.split('-');
    var monthDay = parseInt(dateParts[2]);
    var weekdayName = WEEKDAY_NAMES[dow];
    var cls = 'plan-day';
    if (today) cls += ' plan-day-today';
    var badgeHtml = '';
    if (badge) {
      var bc = 'plan-day-badge';
      if (badge.type === 'holiday') bc += ' plan-day-badge-holiday';
      else if (badge.type === 'sat') bc += ' plan-day-badge-sat';
      else if (badge.type === 'sun') bc += ' plan-day-badge-sun';
      badgeHtml = '<span class="' + bc + '">' + esc(badge.text) + '</span>';
    }
    var h = '<div class="' + cls + '"><div class="plan-day-left">' + badgeHtml + '<span class="plan-day-date"><span class="plan-day-num">' + monthDay + '</span><span class="plan-day-weekday">' + weekdayName + '</span></span>' + (today ? '<span class="plan-day-today-tag">今天</span>' : '') + '</div><div class="plan-day-right"><div class="plan-day-tasks">';
    if (day.tasks.length === 0) {
      h += '<div class="plan-day-empty">暂无任务</div>';
    } else {
      for (var t = 0; t < day.tasks.length; t++) {
        var task = day.tasks[t];
        h += '<div class="plan-task"><label class="plan-task-check"><input type="checkbox" ' + (task.done ? 'checked' : '') + ' onchange="planToggleTask(' + jsArg(weekId) + ',' + jsArg(day.date) + ',' + jsArg(task.id) + ')"><span class="plan-task-checkmark"></span></label><span class="plan-task-text' + (task.done ? ' plan-task-done' : '') + '">' + esc(task.text) + '</span><span class="plan-task-actions"><button class="plan-task-btn" onclick="planEditTask(' + jsArg(weekId) + ',' + jsArg(day.date) + ',' + jsArg(task.id) + ')" title="编辑"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button><button class="plan-task-btn plan-task-btn-danger" onclick="planDeleteTask(' + jsArg(weekId) + ',' + jsArg(day.date) + ',' + jsArg(task.id) + ')" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></span></div>';
      }
    }
    h += '</div><div class="plan-day-add"><input type="text" class="plan-day-input" placeholder="添加任务..." onkeydown="if(event.key===\x27Enter\x27)planAddTask(' + jsArg(weekId) + ',' + jsArg(day.date) + ',this)"><button class="plan-day-add-btn" onclick="planAddTask(' + jsArg(weekId) + ',' + jsArg(day.date) + ',this.previousElementSibling)" title="添加">+</button></div></div></div>';
    return h;
  }

  function renderQuickAdd(month) {
    var el = document.getElementById('plan-quick-add');
    if (!el) return;
    var today = getTodayStr();
    if (today.slice(0, 7) !== month.id) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = '<div class="plan-section-label plan-section-label-sm">今日快速添加</div><div class="plan-quick-add-row"><input type="text" id="plan-quick-input" placeholder="输入今天的任务..." onkeydown="if(event.key===\\x27Enter\\x27)planQuickAdd()"><button onclick="planQuickAdd()">添加</button></div>';
  }

  // --- CRUD ---
  function planEditMonth() {
    var month = getMonthData(planCurrentMonth);
    if (!month) return;
    document.getElementById('plan-month-title-input').value = month.title || '';
    document.getElementById('plan-month-focus-input').value = month.focus || '';
    document.getElementById('plan-month-modal').classList.add('open');
  }

  function savePlanMonthModal() {
    var month = getMonthData(planCurrentMonth);
    if (!month) return;
    month.title = document.getElementById('plan-month-title-input').value.trim() || month.title;
    month.focus = document.getElementById('plan-month-focus-input').value.trim();
    savePlan();
    closePlanMonthModal();
    renderPlan();
    showSyncToast('已保存月计划');
  }

  function closePlanMonthModal() { var o = document.getElementById('plan-month-modal'); if (o) o.classList.remove('open'); }

  function planDeleteMonth() {
    var idx = getMonthIndex(planCurrentMonth);
    if (idx < 0) return;
    showPlanConfirm('确定要删除当前月度计划吗？此操作不可撤销。', function () {
      var _mid = planData.months[idx].id;
      planData.months.splice(idx, 1);
      try { localStorage.removeItem('gk-plan-' + _mid); } catch (e) {}
      if (window.SyncStore) window.SyncStore.deleteData('gk-plan-' + _mid);
      savePlan();
      renderPlan();
      showSyncToast('已删除月计划');
    });
  }

  function planEditWeek(weekId) {
    var ctx = findWeekContext(weekId);
    if (!ctx) return;
    document.getElementById('plan-week-modal-label').textContent = ctx.week.label + '目标';
    document.getElementById('plan-week-goals-input').value = ctx.week.goals || '';
    planEditContext.weekId = weekId;
    document.getElementById('plan-week-modal').classList.add('open');
  }

  function savePlanWeekModal() {
    var weekId = planEditContext.weekId;
    var ctx = findWeekContext(weekId);
    if (!ctx) return;
    ctx.week.goals = document.getElementById('plan-week-goals-input').value.trim();
    savePlan();
    closePlanWeekModal();
    renderPlan();
    showSyncToast('已保存周目标');
  }

  function closePlanWeekModal() { var o = document.getElementById('plan-week-modal'); if (o) o.classList.remove('open'); }

  function planDeleteWeek(weekId) {
    var ctx = findWeekContext(weekId);
    if (!ctx) return;
    showPlanConfirm('确定要删除这一周的所有数据吗？', function () {
      ctx.month.weeks.splice(ctx.weekIndex, 1);
      savePlan();
      renderPlan();
      showSyncToast('已删除周');
    });
  }

  function planAddMonthTodo(inputEl) {
    if (!inputEl) return;
    var text = inputEl.value.trim();
    if (!text) return;
    var month = normalizePlanMonth(getMonthData(planCurrentMonth));
    if (!month) return;
    month.todos.push({ id: getId(), text: text, done: false });
    inputEl.value = '';
    savePlan();
    renderPlan();
  }

  function planToggleMonthTodo(todoId) {
    var ctx = findMonthTodoContext(todoId);
    if (!ctx) return;
    ctx.todo.done = !ctx.todo.done;
    savePlan();
    renderPlan();
  }

  function planDeleteMonthTodo(todoId) {
    var ctx = findMonthTodoContext(todoId);
    if (!ctx) return;
    ctx.month.todos.splice(ctx.todoIndex, 1);
    savePlan();
    renderPlan();
    showSyncToast('已删除月度待办');
  }

  function planAddTask(weekId, dateStr, inputEl) {
    if (!inputEl) return;
    var text = inputEl.value.trim();
    if (!text) return;
    var ctx = findDayContext(weekId, dateStr);
    if (!ctx) return;
    ctx.day.tasks.push({ id: getId(), text: text, done: false });
    inputEl.value = '';
    savePlan();
    renderPlan();
  }

  function planToggleTask(weekId, dateStr, taskId) {
    var ctx = findTaskContext(weekId, dateStr, taskId);
    if (!ctx) return;
    ctx.task.done = !ctx.task.done;
    savePlan();
    renderPlan();
  }

  function planEditTask(weekId, dateStr, taskId) {
    var ctx = findTaskContext(weekId, dateStr, taskId);
    if (!ctx) return;
    document.getElementById('plan-task-text-input').value = ctx.task.text;
    planEditContext.task = { weekId: weekId, date: dateStr, taskId: taskId };
    document.getElementById('plan-task-modal').classList.add('open');
  }

  function savePlanTaskModal() {
    var ctx = planEditContext.task;
    if (!ctx) return;
    var taskCtx = findTaskContext(ctx.weekId, ctx.date, ctx.taskId);
    if (!taskCtx) return;
    taskCtx.task.text = document.getElementById('plan-task-text-input').value.trim() || taskCtx.task.text;
    savePlan();
    closePlanTaskModal();
    renderPlan();
    showSyncToast('已保存任务');
  }

  function closePlanTaskModal() { var o = document.getElementById('plan-task-modal'); if (o) o.classList.remove('open'); planEditContext.task = null; }

  function planDeleteTask(weekId, dateStr, taskId) {
    var ctx = findTaskContext(weekId, dateStr, taskId);
    if (!ctx) return;
    showPlanConfirm('确定删除这个任务吗？', function () {
      ctx.day.tasks.splice(ctx.taskIndex, 1);
      savePlan();
      renderPlan();
      showSyncToast('已删除任务');
    });
  }

  function planQuickAdd() {
    var input = document.getElementById('plan-quick-input');
    if (!input || !input.value.trim()) return;
    var today = getTodayStr();
    var month = getMonthData(planCurrentMonth);
    if (!month) return;
    for (var i = 0; i < month.weeks.length; i++) {
      for (var j = 0; j < month.weeks[i].days.length; j++) {
        if (month.weeks[i].days[j].date === today) {
          month.weeks[i].days[j].tasks.push({ id: getId(), text: input.value.trim(), done: false });
          input.value = '';
          savePlan();
          renderPlan();
          return;
        }
      }
    }
  }

  // --- Confirm Dialog ---
  function showPlanConfirm(msg, callback) {
    document.getElementById('plan-confirm-text').textContent = msg;
    document.getElementById('plan-confirm-btn').onclick = function () {
      closePlanConfirmModal();
      if (callback) callback();
    };
    document.getElementById('plan-confirm-modal').classList.add('open');
  }

  function closePlanConfirmModal() { var o = document.getElementById('plan-confirm-modal'); if (o) o.classList.remove('open'); }

  // --- Holiday Settings ---
  function openHolidaySettings() {
    renderHolidayList();
    document.getElementById('plan-holiday-modal').classList.add('open');
  }

  function closePlanHolidayModal() { var o = document.getElementById('plan-holiday-modal'); if (o) o.classList.remove('open'); }

  function renderHolidayList() {
    var list = document.getElementById('plan-holiday-list');
    if (!list) return;
    var keys = Object.keys(planHolidays);
    if (keys.length === 0) {
      list.innerHTML = '<div class="plan-holiday-empty">暂无节假日数据</div>';
      return;
    }
    keys.sort();
    var h = '';
    for (var i = 0; i < keys.length; i++) {
      var nm = planHolidays[keys[i]];
      h += '<div class="plan-holiday-item"><span class="ph-date">' + keys[i] + '</span><span class="ph-name">' + esc(nm) + '</span><button class="ph-del" onclick="deletePlanHoliday(' + jsArg(keys[i]) + ')" title="删除">✖</button></div>';
    }
    list.innerHTML = h;
  }

  function addPlanHoliday() {
    var dInp = document.getElementById('plan-holiday-date-input');
    var nInp = document.getElementById('plan-holiday-name-input');
    if (!dInp || !dInp.value || !nInp || !nInp.value.trim()) { showSyncToast('请完整填写日期和名称'); return; }
    var dateVal = dInp.value;
    var mmdd = dateVal.slice(5);
    var name = nInp.value.trim();
    planHolidays[mmdd] = name;
    dInp.value = '';
    nInp.value = '';
    renderHolidayList();
    showSyncToast('已添加节假日');
  }

  function deletePlanHoliday(mmdd) {
    delete planHolidays[mmdd];
    renderHolidayList();
    if (els.planView && els.planView.style.display !== 'none') renderPlan();
  }

  function savePlanHolidayModal() {
    savePlanHolidays();
    closePlanHolidayModal();
    if (els.planView && els.planView.style.display !== 'none') renderPlan();
    showSyncToast('已保存节假日设置');
  }

  // --- Default holidays ---
  function ensureDefaultHolidays() {
    var has = false;
    for (var k in planHolidays) { if (planHolidays.hasOwnProperty(k)) { has = true; break; } }
    if (!has) {
      planHolidays['01-01'] = '元旦';
      planHolidays['02-17'] = '除夕';
      planHolidays['02-18'] = '春节';
      planHolidays['02-19'] = '春节';
      planHolidays['04-05'] = '清明';
      planHolidays['05-01'] = '劳动节';
      planHolidays['05-31'] = '端午';
      planHolidays['10-01'] = '国庆';
      planHolidays['10-02'] = '国庆';
      planHolidays['10-03'] = '国庆';
      planHolidays['10-04'] = '中秋';
      savePlanHolidays();
    }
  }


  

  // =========================================================
  //  Plan Module v3 （月计划 + 周计划 + 今日待办）
  // =========================================================

  function initPlan() {
    planCurrentMonth = getCurrentMonthId();
    planEditContext = {};
  }

  function normalizePlanData(data) {
    var normalized = { version: 3, tasks: [], monthPlans: {} };
    var tasks = data && Array.isArray(data.tasks) ? data.tasks : [];
    for (var i = 0; i < tasks.length; i++) {
      var task = normalizePlanTask(tasks[i]);
      if (task) normalized.tasks.push(task);
    }
    var sourceMonthPlans = data && data.monthPlans ? data.monthPlans : {};
    for (var ym in sourceMonthPlans) {
      if (sourceMonthPlans.hasOwnProperty(ym) && /^\d{4}-\d{2}$/.test(ym)) {
        normalized.monthPlans[ym] = normalizeMonthPlan(sourceMonthPlans[ym]);
      }
    }
    normalized.tasks.sort(sortPlanTasks);
    return normalized;
  }

  function normalizeMonthPlan(plan) {
    var normalized = {
      goal: String(plan && plan.goal ? plan.goal : ''),
      focus: String(plan && plan.focus ? plan.focus : ''),
      weeks: {}
    };
    var weeks = plan && plan.weeks ? plan.weeks : {};
    for (var key in weeks) {
      if (weeks.hasOwnProperty(key)) {
        normalized.weeks[key] = { goal: String(weeks[key] && weeks[key].goal ? weeks[key].goal : '') };
      }
    }
    return normalized;
  }

  function normalizePlanTask(task) {
    if (!task) return null;
    var title = String(task.title || task.text || '').trim();
    if (!title) return null;
    var date = isISODate(task.date) ? task.date : getTodayStr();
    var subject = PLAN_SUBJECTS.indexOf(task.subject) >= 0 ? task.subject : '其他';
    var mins = parseInt(task.estimateMin, 10);
    if (!isFinite(mins) || mins < 0) mins = 0;
    return {
      id: task.id || getId(),
      title: title,
      date: date,
      subject: subject,
      estimateMin: mins,
      done: !!task.done,
      createdAt: task.createdAt || new Date().toISOString(),
      completedAt: task.done ? (task.completedAt || new Date().toISOString()) : ''
    };
  }

  function isISODate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function sortPlanTasks(a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  }

  function savePlan() {
    planData = normalizePlanData(planData);
    try {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(planData));
      if (window.SyncStore) window.SyncStore.writeData(PLAN_STORAGE_KEY, planData);
    } catch (e) {}
  }

  function planPrevMonth() {
    var parts = planCurrentMonth.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    if (m < 1) { m = 12; y--; }
    planCurrentMonth = y + '-' + pad2(m);
    renderPlan();
  }

  function planNextMonth() {
    var parts = planCurrentMonth.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) + 1;
    if (m > 12) { m = 1; y++; }
    planCurrentMonth = y + '-' + pad2(m);
    renderPlan();
  }

  function planJumpToday() {
    planCurrentMonth = getCurrentMonthId();
    renderPlan();
  }

  function planAddTaskFromQuick() {
    var titleEl = document.getElementById('plan-quick-title');
    var dateEl = document.getElementById('plan-quick-date');
    var subjectEl = document.getElementById('plan-quick-subject');
    var minutesEl = document.getElementById('plan-quick-minutes');
    if (!titleEl) return;
    var title = titleEl.value.trim();
    if (!title) { showSyncToast('先写下要完成的任务'); titleEl.focus(); return; }
    var mins = parseInt(minutesEl && minutesEl.value, 10);
    if (!isFinite(mins) || mins < 0) mins = 0;
    planData.tasks.push(normalizePlanTask({
      title: title,
      date: dateEl && isISODate(dateEl.value) ? dateEl.value : getTodayStr(),
      subject: subjectEl && subjectEl.value ? subjectEl.value : '行测',
      estimateMin: mins,
      done: false
    }));
    titleEl.value = '';
    if (dateEl) dateEl.value = getTodayStr();
    if (minutesEl) minutesEl.value = '60';
    savePlan();
    renderPlan();
  }

  function savePlanMonthPanel() {
    var month = ensureMonthPlan(planCurrentMonth);
    var goalEl = document.getElementById('plan-month-goal');
    var focusEl = document.getElementById('plan-month-focus');
    month.goal = goalEl ? goalEl.value.trim() : '';
    month.focus = focusEl ? focusEl.value.trim() : '';
    savePlan();
    renderPlan();
    showSyncToast('已保存月度计划');
  }

  function savePlanWeekGoal(weekKey) {
    var week = findMonthWeek(weekKey);
    if (!week) return;
    var month = ensureMonthPlan(planCurrentMonth);
    var textarea = document.getElementById('plan-week-goal-' + weekKey);
    if (!month.weeks[weekKey]) month.weeks[weekKey] = { goal: '' };
    month.weeks[weekKey].goal = textarea ? textarea.value.trim() : '';
    savePlan();
    renderPlan();
    showSyncToast('已保存周计划');
  }

  function planToggleTask(taskId) {
    var task = findPlanTask(taskId);
    if (!task) return;
    task.done = !task.done;
    task.completedAt = task.done ? new Date().toISOString() : '';
    savePlan();
    renderPlan();
  }

  function planEditTask(taskId) {
    var task = findPlanTask(taskId);
    if (!task) return;
    planEditContext.taskId = taskId;
    fillSubjectSelect(document.getElementById('plan-task-subject-input'), task.subject);
    document.getElementById('plan-task-title-input').value = task.title;
    document.getElementById('plan-task-date-input').value = task.date;
    document.getElementById('plan-task-minutes-input').value = String(task.estimateMin || 0);
    document.getElementById('plan-task-modal').classList.add('open');
  }

  function savePlanTaskModal() {
    var task = findPlanTask(planEditContext.taskId);
    if (!task) return;
    var title = document.getElementById('plan-task-title-input').value.trim();
    var date = document.getElementById('plan-task-date-input').value;
    var subject = document.getElementById('plan-task-subject-input').value;
    var mins = parseInt(document.getElementById('plan-task-minutes-input').value, 10);
    if (!title) { showSyncToast('任务内容不能为空'); return; }
    task.title = title;
    task.date = isISODate(date) ? date : getTodayStr();
    task.subject = PLAN_SUBJECTS.indexOf(subject) >= 0 ? subject : '其他';
    task.estimateMin = isFinite(mins) && mins > 0 ? mins : 0;
    savePlan();
    closePlanTaskModal();
    renderPlan();
    showSyncToast('已保存任务');
  }

  function closePlanTaskModal() {
    var modal = document.getElementById('plan-task-modal');
    if (modal) modal.classList.remove('open');
    planEditContext.taskId = '';
  }

  function planDeleteTask(taskId) {
    var task = findPlanTask(taskId);
    if (!task) return;
    showPlanConfirm('确定删除这个任务吗？', function () {
      planData.tasks = planData.tasks.filter(function (item) { return item.id !== taskId; });
      savePlan();
      renderPlan();
      showSyncToast('已删除任务');
    });
  }

  function findPlanTask(taskId) {
    for (var i = 0; i < planData.tasks.length; i++) {
      if (planData.tasks[i].id === taskId) return planData.tasks[i];
    }
    return null;
  }

  function ensureMonthPlan(ym) {
    if (!planData.monthPlans) planData.monthPlans = {};
    if (!planData.monthPlans[ym]) planData.monthPlans[ym] = { goal: '', focus: '', weeks: {} };
    if (!planData.monthPlans[ym].weeks) planData.monthPlans[ym].weeks = {};
    return planData.monthPlans[ym];
  }

  function getMonthWeeks(ym) {
    var parts = ym.split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var daysInMonth = new Date(y, m, 0).getDate();
    var weeks = [];
    var day = 1;
    var weekNum = 1;
    while (day <= daysInMonth) {
      var start = new Date(y, m - 1, day);
      var dow = start.getDay();
      var mondayOffset = dow === 0 ? 6 : dow - 1;
      var daysInWeek = Math.min(7 - mondayOffset, daysInMonth - day + 1);
      var endDay = day + daysInWeek - 1;
      weeks.push({
        key: ym + '-w' + weekNum,
        num: weekNum,
        start: ym + '-' + pad2(day),
        end: ym + '-' + pad2(endDay),
        label: '第' + weekNum + '周'
      });
      weekNum++;
      day = endDay + 1;
    }
    return weeks;
  }

  function findMonthWeek(weekKey) {
    var weeks = getMonthWeeks(planCurrentMonth);
    for (var i = 0; i < weeks.length; i++) {
      if (weeks[i].key === weekKey) return weeks[i];
    }
    return null;
  }

  function getWeekTasks(week, includeDone) {
    var list = [];
    for (var i = 0; i < planData.tasks.length; i++) {
      var task = planData.tasks[i];
      if (task.date >= week.start && task.date <= week.end && (includeDone || !task.done)) list.push(task);
    }
    list.sort(sortPlanTasks);
    return list;
  }

  function getWeekTaskStats(week) {
    var total = 0, done = 0, minutes = 0;
    for (var i = 0; i < planData.tasks.length; i++) {
      var task = planData.tasks[i];
      if (task.date >= week.start && task.date <= week.end) {
        total++;
        if (task.done) done++;
        minutes += task.estimateMin || 0;
      }
    }
    return { total: total, done: done, minutes: minutes };
  }

  function renderPlan() {
    var view = els.planView;
    if (!view || view.style.display === 'none') return;
    planData = normalizePlanData(planData);
    var root = document.getElementById('plan-app');
    if (!root) return;
    root.innerHTML = [
      '<div class="plan-shell">',
        renderPlanHero(),
        renderPlanPlanning(),
        renderPlanQuickAdd(),
        renderPlanToolbar(),
        '<div class="plan-list-panel">',
          renderPlanSection('overdue'),
          renderPlanSection('today'),
          renderPlanSection('future'),
        '</div>',
      '</div>'
    ].join('');
  }

  function renderPlanHero() {
    var stats = getPlanStats();
    return [
      '<div class="plan-hero">',
        '<section class="plan-today-panel">',
          '<div>',
            '<div class="plan-kicker">' + esc(formatFullDate(getTodayStr())) + '</div>',
            '<div class="plan-today-title">今天先完成看得见的任务</div>',
            '<div class="plan-today-subtitle">勾掉任务就是进度。月计划先退后，今天可执行优先。</div>',
          '</div>',
          '<div class="plan-stats-grid">',
            renderPlanStat(stats.todayDone + '/' + stats.todayTotal, '今日完成'),
            renderPlanStat(formatMinutes(stats.todayMinutes), '今日预计'),
            renderPlanStat(stats.weekDone + '/' + stats.weekTotal, '本周完成'),
            renderPlanStat(formatMinutes(stats.weekMinutes), '本周预计'),
          '</div>',
        '</section>',
        '<section class="plan-week-panel">',
          '<div class="plan-week-header">',
            '<div class="plan-week-title">本周科目投入</div>',
            '<div class="plan-week-range">' + esc(formatDateShort(stats.weekStart)) + ' - ' + esc(formatDateShort(stats.weekEnd)) + '</div>',
          '</div>',
          renderSubjectBars(stats.subjectMinutes),
        '</section>',
      '</div>'
    ].join('');
  }

  function renderPlanPlanning() {
    var month = ensureMonthPlan(planCurrentMonth);
    var weeks = getMonthWeeks(planCurrentMonth);
    var parts = planCurrentMonth.split('-');
    var monthTitle = parts[0] + '年' + parseInt(parts[1], 10) + '月';
    return [
      '<section class="plan-planning-panel">',
        '<div class="plan-planning-header">',
          '<div>',
            '<div class="plan-section-eyebrow">规划层</div>',
            '<div class="plan-planning-title">' + esc(monthTitle) + '学习计划</div>',
          '</div>',
          '<button class="plan-primary-btn" onclick="savePlanMonthPanel()">保存月计划</button>',
        '</div>',
        '<div class="plan-month-edit-grid">',
          '<label class="plan-edit-field"><span>月度目标</span><textarea id="plan-month-goal" rows="3" placeholder="这个月要达成什么结果？">' + esc(month.goal) + '</textarea></label>',
          '<label class="plan-edit-field"><span>本月重点</span><textarea id="plan-month-focus" rows="3" placeholder="本月重点科目、薄弱项或复盘提醒...">' + esc(month.focus) + '</textarea></label>',
        '</div>',
        '<div class="plan-week-board">',
          renderWeekPlanCards(weeks, month),
        '</div>',
      '</section>'
    ].join('');
  }

  function renderWeekPlanCards(weeks, month) {
    var html = '';
    for (var i = 0; i < weeks.length; i++) {
      var week = weeks[i];
      var saved = month.weeks && month.weeks[week.key] ? month.weeks[week.key] : { goal: '' };
      var stats = getWeekTaskStats(week);
      var tasks = getWeekTasks(week, true);
      html += [
        '<article class="plan-week-card">',
          '<div class="plan-week-card-head">',
            '<div>',
              '<div class="plan-week-card-title">' + esc(week.label) + '</div>',
              '<div class="plan-week-card-range">' + esc(formatDateShort(week.start)) + ' - ' + esc(formatDateShort(week.end)) + '</div>',
            '</div>',
            '<div class="plan-week-card-stat">' + stats.done + '/' + stats.total + ' · ' + esc(formatMinutes(stats.minutes)) + '</div>',
          '</div>',
          '<textarea class="plan-week-goal-input" id="plan-week-goal-' + esc(week.key) + '" rows="2" placeholder="本周目标，例如：资料分析正确率稳定到 80%">' + esc(saved.goal) + '</textarea>',
          '<div class="plan-week-card-actions">',
            '<button class="plan-ghost-btn" onclick="savePlanWeekGoal(' + jsSingleArg(week.key) + ')">保存周计划</button>',
          '</div>',
          renderWeekTaskChips(tasks),
        '</article>'
      ].join('');
    }
    return html;
  }

  function renderWeekTaskChips(tasks) {
    if (tasks.length === 0) return '<div class="plan-week-empty">本周还没有任务，可在下方快速添加并选择日期。</div>';
    var html = '<div class="plan-week-task-chips">';
    var max = Math.min(tasks.length, 4);
    for (var i = 0; i < max; i++) {
      html += '<button class="plan-week-task-chip' + (tasks[i].done ? ' is-done' : '') + '" onclick="planEditTask(' + jsSingleArg(tasks[i].id) + ')" title="编辑任务">' + esc(formatDateShort(tasks[i].date)) + ' · ' + esc(tasks[i].title) + '</button>';
    }
    if (tasks.length > max) html += '<span class="plan-week-more">+' + (tasks.length - max) + ' 项</span>';
    html += '</div>';
    return html;
  }

  function renderPlanStat(value, label) {
    return '<div class="plan-stat"><div class="plan-stat-value">' + esc(String(value)) + '</div><div class="plan-stat-label">' + esc(label) + '</div></div>';
  }

  function renderSubjectBars(subjectMinutes) {
    var entries = [];
    for (var i = 0; i < PLAN_SUBJECTS.length; i++) {
      var subject = PLAN_SUBJECTS[i];
      if (subjectMinutes[subject] > 0) entries.push({ subject: subject, minutes: subjectMinutes[subject] });
    }
    entries.sort(function (a, b) { return b.minutes - a.minutes; });
    if (entries.length === 0) return '<div class="plan-empty-bars">本周还没有安排学习时长</div>';
    var max = entries[0].minutes || 1;
    var html = '<div class="plan-subject-bars">';
    for (var j = 0; j < entries.length; j++) {
      var pct = Math.max(8, Math.round(entries[j].minutes / max * 100));
      html += '<div class="plan-subject-row"><span class="plan-subject-name">' + esc(entries[j].subject) + '</span><span class="plan-subject-track"><span class="plan-subject-fill" style="width:' + pct + '%"></span></span><span class="plan-subject-time">' + esc(formatMinutes(entries[j].minutes)) + '</span></div>';
    }
    html += '</div>';
    return html;
  }

  function renderPlanQuickAdd() {
    return [
      '<section class="plan-quick-panel">',
        '<div class="plan-quick-form">',
          '<input class="plan-input" id="plan-quick-title" type="text" placeholder="添加学习任务..." onkeydown="if(event.key===&quot;Enter&quot;)planAddTaskFromQuick()">',
          '<input class="plan-input" id="plan-quick-date" type="date" value="' + esc(getTodayStr()) + '" aria-label="任务日期">',
          '<select class="plan-select" id="plan-quick-subject">' + renderSubjectOptions('行测') + '</select>',
          '<input class="plan-input" id="plan-quick-minutes" type="number" min="0" step="5" value="60" aria-label="预计分钟数">',
          '<button class="plan-primary-btn" onclick="planAddTaskFromQuick()">添加任务</button>',
        '</div>',
      '</section>'
    ].join('');
  }

  function renderPlanToolbar() {
    var parts = planCurrentMonth.split('-');
    var label = parts[0] + '年' + parseInt(parts[1], 10) + '月';
    return [
      '<div class="plan-toolbar">',
        '<div class="plan-month-filter">',
          '<button class="plan-nav-btn plan-nav-btn-v2" onclick="planPrevMonth()" title="上个月"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="15" y1="18" x2="9" y2="12"/><line x1="9" y1="12" x2="15" y2="6"/></svg></button>',
          '<span class="plan-nav-title-v2">' + esc(label) + '</span>',
          '<button class="plan-nav-btn plan-nav-btn-v2" onclick="planNextMonth()" title="下个月"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="18" x2="15" y2="12"/><line x1="15" y1="12" x2="9" y2="6"/></svg></button>',
          '<button class="plan-ghost-btn" onclick="planJumpToday()">回到本月</button>',
        '</div>',
        '<div class="plan-filter-note">上方月/周计划随月份切换；逾期和今天始终置顶。</div>',
      '</div>'
    ].join('');
  }

  function renderPlanSection(type) {
    var list = getTasksForSection(type);
    var meta = {
      overdue: { title: '逾期未完成', empty: '没有逾期任务，节奏稳住了。' },
      today: { title: '今天', empty: '今天还没有任务，先在上方添加一条。' },
      future: { title: '未来任务', empty: '这个月暂时没有未来任务。' }
    }[type];
    var html = '<section class="plan-section"><div class="plan-section-head"><div class="plan-section-title"><span class="plan-section-dot ' + type + '"></span>' + esc(meta.title) + '</div><div class="plan-section-count">' + list.length + ' 项</div></div>';
    if (list.length === 0) {
      html += '<div class="plan-empty-state">' + esc(meta.empty) + '</div>';
    } else {
      html += '<div class="plan-task-list">';
      for (var i = 0; i < list.length; i++) html += renderPlanTaskRow(list[i]);
      html += '</div>';
    }
    html += '</section>';
    return html;
  }

  function renderPlanTaskRow(task) {
    return [
      '<div class="plan-task-row' + (task.done ? ' is-done' : '') + '">',
        '<label class="plan-task-checkbox">',
          '<input type="checkbox" ' + (task.done ? 'checked' : '') + ' onchange="planToggleTask(' + jsSingleArg(task.id) + ')">',
          '<span class="plan-task-box"></span>',
        '</label>',
        '<div class="plan-task-main">',
          '<div class="plan-task-title">' + esc(task.title) + '</div>',
          '<div class="plan-task-meta">',
            '<span class="plan-pill subject">' + esc(task.subject) + '</span>',
            '<span class="plan-pill">' + esc(formatDateShort(task.date)) + '</span>',
            '<span class="plan-pill">' + esc(formatMinutes(task.estimateMin)) + '</span>',
            task.done && task.completedAt ? '<span class="plan-pill">完成于 ' + esc(formatCompletedAt(task.completedAt)) + '</span>' : '',
          '</div>',
        '</div>',
        '<div class="plan-task-actions-v2">',
          '<button class="plan-task-btn" onclick="planEditTask(' + jsSingleArg(task.id) + ')" title="编辑"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>',
          '<button class="plan-task-btn plan-task-btn-danger" onclick="planDeleteTask(' + jsSingleArg(task.id) + ')" title="删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>',
        '</div>',
      '</div>'
    ].join('');
  }

  function getTasksForSection(type) {
    var today = getTodayStr();
    var list = [];
    for (var i = 0; i < planData.tasks.length; i++) {
      var task = planData.tasks[i];
      if (type === 'overdue' && !task.done && task.date < today) list.push(task);
      else if (type === 'today' && task.date === today) list.push(task);
      else if (type === 'future' && task.date > today && task.date.slice(0, 7) === planCurrentMonth) list.push(task);
    }
    list.sort(sortPlanTasks);
    return list;
  }

  function getPlanStats() {
    var today = getTodayStr();
    var weekStart = formatISODate(getWeekStartDate(new Date()));
    var weekEnd = formatISODate(addDays(parseLocalDate(weekStart), 6));
    var stats = {
      todayTotal: 0,
      todayDone: 0,
      todayMinutes: 0,
      weekTotal: 0,
      weekDone: 0,
      weekMinutes: 0,
      weekStart: weekStart,
      weekEnd: weekEnd,
      subjectMinutes: {}
    };
    for (var s = 0; s < PLAN_SUBJECTS.length; s++) stats.subjectMinutes[PLAN_SUBJECTS[s]] = 0;
    for (var i = 0; i < planData.tasks.length; i++) {
      var task = planData.tasks[i];
      if (task.date === today) {
        stats.todayTotal++;
        if (task.done) stats.todayDone++;
        stats.todayMinutes += task.estimateMin || 0;
      }
      if (task.date >= weekStart && task.date <= weekEnd) {
        stats.weekTotal++;
        if (task.done) stats.weekDone++;
        stats.weekMinutes += task.estimateMin || 0;
        stats.subjectMinutes[task.subject] = (stats.subjectMinutes[task.subject] || 0) + (task.estimateMin || 0);
      }
    }
    return stats;
  }

  function fillSubjectSelect(select, selected) {
    if (!select) return;
    select.innerHTML = renderSubjectOptions(selected);
  }

  function renderSubjectOptions(selected) {
    var html = '';
    for (var i = 0; i < PLAN_SUBJECTS.length; i++) {
      var subject = PLAN_SUBJECTS[i];
      html += '<option value="' + esc(subject) + '"' + (subject === selected ? ' selected' : '') + '>' + esc(subject) + '</option>';
    }
    return html;
  }

  function jsSingleArg(value) {
    return "'" + esc(String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')) + "'";
  }

  function parseLocalDate(dateStr) {
    var parts = dateStr.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  function addDays(date, days) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + days);
    return d;
  }

  function getWeekStartDate(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var dow = d.getDay();
    var offset = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + offset);
    return d;
  }

  function formatISODate(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function formatDateShort(dateStr) {
    var parts = dateStr.split('-');
    return parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10);
  }

  function formatFullDate(dateStr) {
    var d = parseLocalDate(dateStr);
    var weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + weekdays[d.getDay()];
  }

  function formatCompletedAt(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function formatMinutes(minutes) {
    minutes = parseInt(minutes, 10) || 0;
    if (minutes <= 0) return '0分钟';
    if (minutes < 60) return minutes + '分钟';
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return m ? h + '小时' + m + '分钟' : h + '小时';
  }

  // =========================================================
  //  Periodic Sync （定时同步）
  // =========================================================
  function startPeriodicSync() {
    stopPeriodicSync();
    planSyncInterval = setInterval(function () {
      if (!window.SyncStore || !syncInfo.hasConfig) return;
      window.SyncStore.fetchAllKeys(function (rows) {
        if (!rows || rows.length === 0) return;
        var changed = false;
        for (var _ri = 0; _ri < rows.length; _ri++) {
          var _row = rows[_ri];
          if (_row.data_value == null || !_row.data_key) continue;
          var _oldVal = localStorage.getItem(_row.data_key);
          var _newVal = typeof _row.data_value === 'string' ? _row.data_value : JSON.stringify(_row.data_value);
          if (_oldVal !== _newVal) {
            try { localStorage.setItem(_row.data_key, _newVal); } catch(e) {}
            changed = true;
          }
        }
        if (!changed) return;
        // Reload study plan data from localStorage
        try {
          var _planV2 = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY));
          if (_planV2 && Array.isArray(_planV2.tasks)) planData = normalizePlanData(_planV2);
        } catch(e) {}
        if (els.planView && els.planView.style.display !== 'none') renderPlan();
        updateSyncTime();
      });
    }, 30000);
  }

  function stopPeriodicSync() {
    if (planSyncInterval) {
      clearInterval(planSyncInterval);
      planSyncInterval = null;
    }
  }

  function updateSyncTime() {
    var _el = document.getElementById('sidebar-sync-status');
    if (!_el) return;
    _el.className = 'sidebar-sync-status online';
    _el.title = '同步已连接 - ' + new Date().toLocaleTimeString();
  }


  

  // --- Local Export/Import ---
  function exportLocalData() {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("gk-") === 0) {
        if (k === "gk-sync-key") continue;
        try { data[k] = JSON.parse(localStorage.getItem(k)); }
        catch(e) { data[k] = localStorage.getItem(k); }
      }
    }
    var blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var d = new Date();
    var ds = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
    a.download = "gk-data-" + ds + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSyncToast("数据已导出");
  }

  function importLocalData() {
    var inp = document.getElementById("gk-import-input");
    if (inp) inp.click();
  }

  function handleImportFile(ev) {
    var file = ev.target.files && ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        var count = 0;
        for (var k in data) {
          if (data.hasOwnProperty(k) && k.indexOf("gk-") === 0) {
            if (k === "gk-sync-key") continue;
            var val = typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k]);
            try { localStorage.setItem(k, val); count++; } catch(ex) {}
          }
        }
        showSyncToast("已导入 " + count + " 项数据");
        setTimeout(function() { location.reload(); }, 1500);
      } catch(ex) {
        showSyncToast("导入失败：文件格式错误");
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  }

  window.timerStartStop = timerStartStop; window.timerReset = timerReset; window.timerLap = timerLap;
  window.switchTimerMode = switchTimerMode; window.openLinkManager = openLinkManager;
  window.closeLinkManager = closeLinkManager; window.addLink = addLink;
  window.openSyncConfig = openSyncConfig; window.closeSyncConfig = closeSyncConfig;
  window.applySyncKey = applySyncKey; window.copySyncKey = copySyncKey;
  window.openAccountModal = openAccountModal; window.closeAccountModal = closeAccountModal;
  window.accountSignIn = accountSignIn; window.accountSignUp = accountSignUp;
  window.accountSignOut = accountSignOut; window.accountManualSync = accountManualSync;
  window.saveCountdownConfigModal = saveCountdownConfigModal; window.closeCountdownConfigModal = closeCountdownConfigModal;
  window.planPrevMonth = planPrevMonth; window.planNextMonth = planNextMonth;
  window.planJumpToday = planJumpToday; window.planAddTaskFromQuick = planAddTaskFromQuick;
  window.savePlanMonthPanel = savePlanMonthPanel; window.savePlanWeekGoal = savePlanWeekGoal;
  window.planToggleTask = planToggleTask;
  window.planEditTask = planEditTask; window.savePlanTaskModal = savePlanTaskModal;
  window.closePlanTaskModal = closePlanTaskModal; window.planDeleteTask = planDeleteTask;
  window.closePlanConfirmModal = closePlanConfirmModal;
  window.exportLocalData = exportLocalData;
  window.importLocalData = importLocalData;
  window.handleImportFile = handleImportFile;
  window.showPlanConfirm = showPlanConfirm;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
