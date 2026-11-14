(function () {
  'use strict';

  var TOOLS = {
    dashboard: { name: '首页', path: null },
    exam:      { name: '套卷分数计算',   path: '../公考助手/index.html?v=20261115-remove-modules' },
    essay:     { name: '申论方格纸', path: '../申论方格纸/index.html?v=20261115-remove-modules' },
    speed:     { name: '速算练习',   path: '../资料训练/index.html?v=20261115-remove-modules' },
    knowledge50: { name: '常识30天', path: '../公考常识50天/index.html?v=20261115-remove-modules' }
  };

  // Leave the initial view unset so the first explicit route also initializes
  // the dashboard title and visibility state.
  var currentView = '';
  var els = {};
  var syncInfo = { hasConfig: false, syncKey: '', isLoggedIn: false, email: '' };

  var timerState = { mode: 'stopwatch', running: false, elapsed: 0, laps: [], startTime: 0, tickId: null };
  var cdState = { name: '', date: '', milestones: [] };
  var links = [];
  var TOOL_ORDER_STORAGE_KEY = 'gk-tool-order';
  var DEFAULT_TOOL_ORDER = ['exam', 'essay', 'speed', 'knowledge50'];
  var TOOL_NAMES_STORAGE_KEY = 'gk-tool-names-v1';
  var DEFAULT_TOOL_NAMES = {
    dashboard: '首页',
    exam: '模考记分',
    essay: '申论写作',
    speed: '速算练习',
    knowledge50: '常识30天'
  };
  var RENAMED_TOOL_NAMES = {
    dashboard: '行旅台',
    speed: '数理驿道',
    knowledge50: '常识50天'
  };
  var toolNames = {};
  var syncInterval = null;
  var countUpObserver;

  function initLoadingOverlay() {
    var overlay = document.getElementById('loading-overlay');
    if (!overlay || overlay.dataset.loadingInitialized === 'true') return;
    overlay.dataset.loadingInitialized = 'true';
    var progress = document.getElementById('loading-progress-bar');
    var progressText = document.getElementById('loading-progress-text');
    var status = document.getElementById('loading-status');
    var skip = document.getElementById('loading-skip');
    var started = performance.now();
    var duration = 6800;
    var messages = ['准备学习工具', '同步学习进度', '准备出发'];
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      overlay.classList.add('is-leaving');
      overlay.setAttribute('aria-hidden', 'true');
      setTimeout(function () { overlay.classList.add('is-hidden'); }, 520);
    }
    function ready() {
      if (finished) return;
      if (progress) progress.style.width = '100%';
      if (progressText) progressText.textContent = '100%';
      if (status) status.innerHTML = '学习工具已就绪 <span aria-hidden="true">·</span> 可以开始';
      if (skip) {
        skip.classList.add('is-ready');
        skip.setAttribute('aria-label', '进入长安题途网站');
      }
    }
    function tick(now) {
      if (finished) return;
      var ratio = Math.min(1, (now - started) / duration);
      var value = Math.max(8, Math.round(ratio * 100));
      if (progress) progress.style.width = value + '%';
      if (progressText) progressText.textContent = String(value).padStart(2, '0') + '%';
      if (status) status.innerHTML = messages[Math.min(messages.length - 1, Math.floor(ratio * messages.length))] + ' <span aria-hidden="true">·</span> ' + (ratio > .72 ? '即将抵达' : '准备出发');
      if (ratio < 1) requestAnimationFrame(tick); else ready();
    }
    if (skip) skip.addEventListener('click', finish);
    requestAnimationFrame(tick);
  }

  function animateView(view) {
    var roots = [els.dashboard, els.toolContainer];
    roots.forEach(function (root) {
      if (!root) return;
      root.classList.remove('view-enter', 'view-exit');
    });
    var target = view === 'dashboard' ? els.dashboard : els.toolContainer;
    if (!target) return;
    target.classList.add('view-enter');
    target.addEventListener('animationend', function () { target.classList.remove('view-enter'); }, { once: true });
  }

  function countUpElement(element, nextText) {
    if (!element || element.dataset.countAnimating === 'true') return;
    var next = String(nextText == null ? element.textContent : nextText);
    var match = next.match(/(\d[\d,.]*)/);
    if (!match) return;
    var target = parseInt(match[1].replace(/[,\.]/g, ''), 10);
    if (!isFinite(target)) return;
    var currentMatch = String(element.textContent || '').match(/(\d[\d,.]*)/);
    var current = currentMatch ? parseInt(currentMatch[1].replace(/[,\.]/g, ''), 10) : 0;
    if (current === target) return;
    var prefix = next.slice(0, match.index), suffix = next.slice(match.index + match[1].length);
    var start = performance.now(), duration = 520;
    element.dataset.countAnimating = 'true';
    function frame(now) {
      var p = Math.min(1, (now - start) / duration), eased = 1 - Math.pow(1 - p, 3);
      element.textContent = prefix + Math.round(current + (target - current) * eased).toLocaleString('zh-CN') + suffix;
      if (p < 1) requestAnimationFrame(frame); else { element.dataset.countAnimating = 'false'; element.dataset.countValue = String(target); }
    }
    requestAnimationFrame(frame);
  }

  function initPortalMotion() {
    var selectors = '#journey-total,#journey-streak,#journey-stamps,.countdown-big-number,[data-count-up]';
    if (typeof MutationObserver === 'undefined') return;
    function observeElement(el) {
      if (!el || el.dataset.countObserved === 'true') return;
      el.dataset.countObserved = 'true'; el.dataset.countValue = '';
      countUpObserver.observe(el, { childList: true, characterData: true, subtree: true });
    }
    countUpObserver = new MutationObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.target.dataset.countAnimating === 'true') return;
        if (entry.target.dataset.metric != null) return;
        countUpElement(entry.target, entry.target.textContent);
      });
    });
    document.querySelectorAll(selectors).forEach(observeElement);
    var dashboard = document.getElementById('dashboard-view');
    if (dashboard) {
      var additions = new MutationObserver(function () { dashboard.querySelectorAll(selectors).forEach(observeElement); });
      additions.observe(dashboard, { childList: true, subtree: true });
    }
    var modalObserver = new MutationObserver(function (entries) {
      entries.forEach(function (entry) {
        var overlay = entry.target;
        if (!overlay.classList.contains('open') && !overlay.classList.contains('closing') && overlay.dataset.wasOpen === 'true') {
          overlay.classList.add('closing');
          setTimeout(function () { overlay.classList.remove('closing'); overlay.dataset.wasOpen = 'false'; }, 220);
        }
        if (overlay.classList.contains('open')) overlay.dataset.wasOpen = 'true';
      });
    });
    document.querySelectorAll('.sync-overlay,.link-manager-overlay,.countdown-config-overlay,.focus-modal-overlay').forEach(function (overlay) {
      modalObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    });
    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('button');
      if (!button || button.disabled) return;
      button.classList.add('is-pressed');
      setTimeout(function () { button.classList.remove('is-pressed'); }, 180);
      if (button.hasAttribute('data-loading')) {
        button.classList.add('is-loading');
        button.setAttribute('aria-busy', 'true');
        setTimeout(function () {
          button.classList.remove('is-loading');
          button.removeAttribute('aria-busy');
          if (button.id === 'journey-start' && button.textContent.indexOf('暂停') === -1) {
            button.classList.add('is-success');
            setTimeout(function () { button.classList.remove('is-success'); }, 700);
          }
        }, 420);
      }
    }, true);
  }

  function init() {
    initLoadingOverlay();
    document.title = '长安题途 · 公考备考助手';
    var brandText = document.querySelector('.sidebar-brand-text');
    var brandIcon = document.querySelector('.sidebar-brand-icon');
    if (brandText) brandText.textContent = '长安题途';
    if (brandIcon) brandIcon.textContent = '长';
    toolNames = loadToolNames();
    applyToolNames();
    initFocusModalAccessibility();
    if (window.SyncStore) syncInfo = window.SyncStore.init();
    els.sidebar = document.querySelector('.sidebar');
    els.dashboard = document.getElementById('dashboard-view');
    els.toolContainer = document.getElementById('tool-container');
    els.toolFrame = document.getElementById('tool-frame');
    els.pageTitle = document.getElementById('page-title');
    els.mobileBtn = document.getElementById('mobile-menu-btn');
    els.sidebarOverlay = document.getElementById('sidebar-overlay');
    els.themeToggle = document.getElementById('theme-toggle');
    els.syncBtn = document.getElementById('sidebar-sync-btn');
    els.accountBtn = document.getElementById('sidebar-account-btn');
    els.toolNamesBtn = document.getElementById('tool-names-btn');
    els.toolNamesDialog = document.getElementById('tool-names-dialog');
    els.toolNamesForm = document.getElementById('tool-names-form');
    els.toolFrameToolbar = document.getElementById('tool-frame-toolbar');
    initPortalMotion();
    var savedTheme = localStorage.getItem('gk-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    applySavedToolOrder();
    els.navItems = document.querySelectorAll('.nav-item');
    enhanceNavItems();
    els.navItems.forEach(function (item) {
      item.addEventListener('click', function () { navigateTo(item.dataset.view); closeMobileMenu(); });
    });
    els.mobileBtn.addEventListener('click', toggleMobileMenu);
    els.sidebarOverlay.addEventListener('click', closeMobileMenu);
    els.themeToggle.addEventListener('click', toggleTheme);
    if (els.syncBtn) els.syncBtn.addEventListener('click', openSyncConfig);
    if (els.accountBtn) els.accountBtn.addEventListener('click', openAccountModal);
    if (els.toolNamesBtn) els.toolNamesBtn.addEventListener('click', openToolNamesDialog);
    if (els.toolNamesForm) els.toolNamesForm.addEventListener('submit', saveToolNamesFromDialog);
    var toolNamesClose = document.getElementById('tool-names-close');
    if (toolNamesClose) toolNamesClose.addEventListener('click', function () { els.toolNamesDialog.close(); });
    var toolNamesCancel = document.getElementById('tool-names-cancel');
    if (toolNamesCancel) toolNamesCancel.addEventListener('click', function () { els.toolNamesDialog.close(); });
    var toolNamesRestore = document.getElementById('tool-names-restore');
    if (toolNamesRestore) toolNamesRestore.addEventListener('click', restoreToolNamesInDialog);
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
    if (els.toolFrame) els.toolFrame.addEventListener('load', function () {
      enhanceEmbeddedToolFrame();
    });
    startPeriodicSync();
    loadAllData();
    setGreeting();
    navigateTo('dashboard');
  }

  function loadAllData() {
    var savedTheme = localStorage.getItem('gk-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    // Render the local snapshot immediately. Account sync is optional and
    // must never block the portal or make local data appear to be missing.
    loadFromLocal();
    if (window.SyncStore && window.SyncStore.mergeLocalWithCloud) {
      window.SyncStore.mergeLocalWithCloud(function () { loadFromLocal(); });
    }
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
    toolNames = loadToolNames();
    applyToolNames();
    if (window.Journey && window.Journey.refresh) window.Journey.refresh();
    applySavedToolOrder();
    els.navItems = document.querySelectorAll('.nav-item');
    refreshNavMoveControls();
    renderTimer(); renderCountdown(); renderLinks(); renderSyncStatus(); renderAccountStatus();
  }

  function loadToolNames() {
    var names = {};
    Object.keys(DEFAULT_TOOL_NAMES).forEach(function (view) { names[view] = DEFAULT_TOOL_NAMES[view]; });
    try {
      var saved = JSON.parse(localStorage.getItem(TOOL_NAMES_STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        Object.keys(DEFAULT_TOOL_NAMES).forEach(function (view) {
          var value = typeof saved[view] === 'string' ? saved[view].replace(/\s+/g, ' ').trim() : '';
          if (value && RENAMED_TOOL_NAMES[view] === value) value = DEFAULT_TOOL_NAMES[view];
          if (value) names[view] = value.slice(0, 18);
        });
      }
    } catch(e) {}
    return names;
  }

  function getToolName(view) {
    return toolNames[view] || DEFAULT_TOOL_NAMES[view] || (TOOLS[view] && TOOLS[view].name) || view;
  }

  function applyToolNames() {
    Object.keys(DEFAULT_TOOL_NAMES).forEach(function (view) {
      var name = getToolName(view);
      if (TOOLS[view]) TOOLS[view].name = name;
      var nav = document.querySelector('.nav-item[data-view="' + view + '"]');
      if (nav) {
        Array.prototype.slice.call(nav.childNodes).forEach(function (node) {
          if (node.nodeType === 3 && node.nodeValue.trim()) node.nodeValue = name;
        });
        nav.setAttribute('title', name);
      }
      var card = document.querySelector('.tool-card[data-view="' + view + '"] .tool-card-title');
      if (card) card.textContent = name;
    });
    if (els.pageTitle && DEFAULT_TOOL_NAMES[currentView]) els.pageTitle.textContent = getToolName(currentView);
  }

  function saveToolNames(names) {
    try {
      localStorage.setItem(TOOL_NAMES_STORAGE_KEY, JSON.stringify(names));
      if (window.SyncStore) window.SyncStore.writeData(TOOL_NAMES_STORAGE_KEY, names);
    } catch(e) {}
  }

  function openToolNamesDialog() {
    if (!els.toolNamesDialog) return;
    els.toolNamesDialog.querySelectorAll('[data-tool-name]').forEach(function (input) {
      input.value = getToolName(input.dataset.toolName);
    });
    els.toolNamesDialog.showModal();
    setTimeout(function () {
      var firstField = els.toolNamesDialog.querySelector('[data-tool-name]');
      if (firstField) firstField.focus();
    }, 0);
  }

  function restoreToolNamesInDialog() {
    if (!els.toolNamesDialog) return;
    els.toolNamesDialog.querySelectorAll('[data-tool-name]').forEach(function (input) {
      input.value = DEFAULT_TOOL_NAMES[input.dataset.toolName];
    });
  }

  function saveToolNamesFromDialog(event) {
    event.preventDefault();
    if (!els.toolNamesDialog) return;
    var next = {};
    Object.keys(DEFAULT_TOOL_NAMES).forEach(function (view) { next[view] = DEFAULT_TOOL_NAMES[view]; });
    els.toolNamesDialog.querySelectorAll('[data-tool-name]').forEach(function (input) {
      var value = String(input.value || '').replace(/\s+/g, ' ').trim().slice(0, 18);
      if (value) next[input.dataset.toolName] = value;
    });
    toolNames = next;
    applyToolNames();
    saveToolNames(toolNames);
    els.toolNamesDialog.close();
    showSyncToast('模块名称已保存');
  }

  function getSavedToolOrder() {
    var order = DEFAULT_TOOL_ORDER.slice();
    try {
      var saved = JSON.parse(localStorage.getItem(TOOL_ORDER_STORAGE_KEY));
      if (saved && Array.isArray(saved)) {
        order = saved.filter(function (view) { return DEFAULT_TOOL_ORDER.indexOf(view) !== -1; });
      }
    } catch(e) {}
    DEFAULT_TOOL_ORDER.forEach(function (view) {
      if (order.indexOf(view) === -1) order.push(view);
    });
    return order;
  }

  function getCurrentToolOrder() {
    return Array.prototype.slice.call(document.querySelectorAll('.sidebar-nav .nav-item'))
      .map(function (item) { return item.dataset.view; })
      .filter(function (view) { return DEFAULT_TOOL_ORDER.indexOf(view) !== -1; });
  }

  function applyToolOrder(order) {
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    order.forEach(function (view) {
      var item = nav.querySelector('.nav-item[data-view="' + view + '"]');
      if (item) nav.appendChild(item);
    });
    applyToolOrderToCards(order);
  }

  function applyToolOrderToCards(order) {
    var cards = document.querySelector('.tool-cards');
    if (!cards) return;
    order.forEach(function (view) {
      var card = cards.querySelector('.tool-card[data-view="' + view + '"]');
      if (card) cards.appendChild(card);
    });
  }

  function applySavedToolOrder() {
    applyToolOrder(getSavedToolOrder());
  }

  function saveToolOrder(order) {
    try {
      localStorage.setItem(TOOL_ORDER_STORAGE_KEY, JSON.stringify(order));
      if (window.SyncStore) window.SyncStore.writeData(TOOL_ORDER_STORAGE_KEY, order);
    } catch(e) {}
  }

  function moveTool(view, action) {
    if (DEFAULT_TOOL_ORDER.indexOf(view) === -1) return;
    var order = getCurrentToolOrder();
    var idx = order.indexOf(view);
    if (idx === -1) return;
    if (action === 'top') {
      order.splice(idx, 1);
      order.unshift(view);
    } else if (action === 'up' && idx > 0) {
      var prev = order[idx - 1];
      order[idx - 1] = view;
      order[idx] = prev;
    } else if (action === 'down' && idx < order.length - 1) {
      var next = order[idx + 1];
      order[idx + 1] = view;
      order[idx] = next;
    } else {
      return;
    }
    applyToolOrder(order);
    saveToolOrder(order);
    els.navItems = document.querySelectorAll('.nav-item');
    refreshNavMoveControls();
  }

  function navMoveIcon(action) {
    if (action === 'top') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
    if (action === 'up') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';
  }

  function createNavMoveControl(view, action, title) {
    var control = document.createElement('span');
    control.className = 'nav-move-btn nav-move-' + action;
    control.setAttribute('role', 'button');
    control.setAttribute('tabindex', '0');
    control.setAttribute('title', title);
    control.setAttribute('aria-label', title);
    control.innerHTML = navMoveIcon(action);
    function run(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!control.classList.contains('is-disabled')) moveTool(view, action);
    }
    control.addEventListener('click', run);
    control.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') run(ev);
    });
    return control;
  }

  function enhanceNavItems() {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (item) {
      var view = item.dataset.view;
      if (view === 'dashboard' || DEFAULT_TOOL_ORDER.indexOf(view) === -1 || item.querySelector('.nav-move-actions')) return;
      var actions = document.createElement('span');
      actions.className = 'nav-move-actions';
      actions.appendChild(createNavMoveControl(view, 'top', '置顶'));
      actions.appendChild(createNavMoveControl(view, 'up', '上移'));
      actions.appendChild(createNavMoveControl(view, 'down', '下移'));
      item.appendChild(actions);
    });
    refreshNavMoveControls();
  }

  function refreshNavMoveControls() {
    var order = getCurrentToolOrder();
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (item) {
      var view = item.dataset.view;
      var idx = order.indexOf(view);
      if (idx === -1) return;
      setNavMoveDisabled(item.querySelector('.nav-move-top'), idx === 0);
      setNavMoveDisabled(item.querySelector('.nav-move-up'), idx === 0);
      setNavMoveDisabled(item.querySelector('.nav-move-down'), idx === order.length - 1);
    });
  }

  function setNavMoveDisabled(el, disabled) {
    if (!el) return;
    el.classList.toggle('is-disabled', disabled);
    el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }

  function initFocusModalAccessibility() {
    var lastFocused = null;
    var selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    document.querySelectorAll('.focus-modal-overlay').forEach(function (overlay) {
      if (!overlay.getAttribute('role')) overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      if (!overlay.getAttribute('aria-label') && !overlay.getAttribute('aria-labelledby')) overlay.setAttribute('aria-label', '专注记录对话框');
    });
    document.addEventListener('keydown', function (event) {
      var active = document.querySelector('.focus-modal-overlay.open');
      if (!active) return;
      if (event.key === 'Escape') {
        var close = active.querySelector('.focus-modal-close');
        if (close) close.click();
        return;
      }
      if (event.key !== 'Tab') return;
      var focusable = Array.prototype.slice.call(active.querySelectorAll(selector));
      if (!focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    var observer = new MutationObserver(function (entries) {
      entries.forEach(function (entry) {
        var overlay = entry.target;
        if (overlay.classList.contains('open')) {
          lastFocused = document.activeElement;
          var target = overlay.querySelector('[autofocus], input, select, textarea, button');
          if (target) setTimeout(function () { target.focus(); }, 0);
        } else if (lastFocused && typeof lastFocused.focus === 'function') {
          lastFocused.focus();
          lastFocused = null;
        }
      });
    });
    document.querySelectorAll('.focus-modal-overlay').forEach(function (overlay) { observer.observe(overlay, { attributes: true, attributeFilter: ['class'] }); });
  }

  function navigateTo(view) {
    if (!Object.prototype.hasOwnProperty.call(TOOLS, view)) view = 'dashboard';
    if (view === currentView) return;
    var tool = TOOLS[view];
    currentView = view;
    document.body.dataset.activeView = view;
    if (timerState.running) saveTimerState();
    els.navItems.forEach(function (el) { el.classList.toggle('active', el.dataset.view === view); });
    var home = view === 'dashboard';
    els.dashboard.style.display = home ? '' : 'none';
    els.toolContainer.classList.toggle('active', !home);
    if (els.toolFrameToolbar) els.toolFrameToolbar.hidden = true;
    els.pageTitle.textContent = getToolName(view);
    if (home) {
      els.dashboard.scrollTop = 0;
      if (timerState.running && !timerState.tickId) timerState.tickId = setInterval(tickTimer, 100);
    } else {
      els.toolFrame.src = tool.path;
    }
    animateView(view);
  }

  // Embedded tools use their own document, so mirror the portal theme and
  // apply the same translucent scene surface used by native portal views.
  function enhanceEmbeddedToolFrame() {
    var frame = els.toolFrame;
    var doc;
    try { doc = frame && frame.contentDocument; } catch (e) { return; }
    if (!doc) return;
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    doc.documentElement.setAttribute('data-theme', theme);
    var view = currentView || 'dashboard';
    var scenes = {
      exam: '../公考工具箱/assets/images/changan/tool-exam-gate.webp',
      essay: '../公考工具箱/assets/images/changan/tool-essay-pavilion.webp',
      speed: '../公考工具箱/assets/images/changan/tool-speed-route.webp',
      knowledge50: '../公考工具箱/assets/images/changan/tool-knowledge-map.webp'
    };
    var scene = scenes[view] || scenes.knowledge50;
    var style = doc.getElementById('portal-tool-theme-style');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'portal-tool-theme-style';
      (doc.head || doc.documentElement).appendChild(style);
    }
    style.textContent = [
      ':root{--portal-scene:url("' + scene + '");--portal-ink:#17343b;--portal-paper:rgba(248,250,246,.78);--portal-line:rgba(217,226,223,.8);}',
      'html,body{min-height:100%;}',
      'body{background:linear-gradient(rgba(246,248,244,.76),rgba(246,248,244,.9)),var(--portal-scene) center/cover fixed!important;color:var(--portal-ink)!important;}',
      'main,.container,.paper-wrapper,.setup-workspace,.play-workspace{background:transparent!important;}',
      '.container,.setup-workspace,.play-workspace{width:100%!important;max-width:1540px!important;margin-left:auto!important;margin-right:auto!important;}',
      '.wrap{width:100%!important;max-width:1540px!important;margin-left:auto!important;margin-right:auto!important;padding:28px 36px 60px!important;background:transparent!important;}',
      '.wrap .hero,.wrap .section-frame,.wrap .day{background:var(--portal-paper)!important;border-color:var(--portal-line)!important;backdrop-filter:blur(12px);}',
      '.wrap .toolbar{background:var(--portal-paper)!important;border-color:var(--portal-line)!important;backdrop-filter:blur(12px);}',
      '.wrap .step,.wrap .cell,.wrap .chip,.wrap .day-head{background:rgba(255,253,248,.42)!important;border-color:var(--portal-line)!important;}',
      '.wrap .rv-tip,.wrap .sweep-intro{background:rgba(255,253,248,.42)!important;border-color:var(--portal-line)!important;}',
      'header,.toolbar,.speed-topbar,.config-panel,.module,.section,.speed-config,.paper,.segment,.recall,.cloze,.bank-modal,.editor-modal{background:var(--portal-paper)!important;border-color:var(--portal-line)!important;backdrop-filter:blur(12px);}',
      '.grid-container,.choice-grid,.setting-item,.select-grid,.bank-summary,.play-status,.timer-track{background:transparent!important;}',
      'input,select,textarea,.mode-btn,.num-chip,.choice,.btn-secondary,.bank-row,.bank-toolbar input,.bank-toolbar select{background:rgba(255,255,255,.42)!important;border-color:var(--portal-line)!important;color:var(--portal-ink)!important;}',
      'html[data-theme="dark"]{--portal-ink:#edf3ee;--portal-paper:rgba(16,39,45,.78);--portal-line:rgba(192,214,207,.2);}',
      'html[data-theme="dark"]{color-scheme:dark;}',
      'html[data-theme="dark"] body{background:linear-gradient(rgba(8,24,30,.72),rgba(8,24,30,.88)),var(--portal-scene) center/cover fixed!important;color:var(--portal-ink)!important;}',
      'html[data-theme="dark"] .wrap{background:transparent!important;color:var(--portal-ink)!important;}',
      'html[data-theme="dark"] .wrap .hero,html[data-theme="dark"] .wrap .section-frame,html[data-theme="dark"] .wrap .day,html[data-theme="dark"] .wrap .toolbar{background:rgba(16,39,45,.78)!important;border-color:var(--portal-line)!important;color:var(--portal-ink)!important;}',
      'html[data-theme="dark"] .wrap .step,html[data-theme="dark"] .wrap .cell,html[data-theme="dark"] .wrap .chip,html[data-theme="dark"] .wrap .day-head,html[data-theme="dark"] .wrap .rv-tip,html[data-theme="dark"] .wrap .sweep-intro{background:rgba(12,34,41,.62)!important;border-color:var(--portal-line)!important;color:var(--portal-ink)!important;}',
      'html[data-theme="dark"] .wrap .btn,html[data-theme="dark"] .wrap .date-input{background:rgba(12,34,41,.62)!important;border-color:var(--portal-line)!important;color:var(--portal-ink)!important;}',
      'html[data-theme="dark"] header,html[data-theme="dark"] .dark-theme header,html[data-theme="dark"] .speed-topbar,html[data-theme="dark"] .toolbar,html[data-theme="dark"] .header-main,html[data-theme="dark"] .config-panel,html[data-theme="dark"] .editor-header,html[data-theme="dark"] .editor-body,html[data-theme="dark"] .editor-footer{background:rgba(10,31,38,.82)!important;border-color:var(--portal-line)!important;color:#edf3ee!important;}',
      'html[data-theme="dark"] .editor-module-row{background:rgba(12,34,41,.78)!important;border-color:var(--portal-line)!important;}',
      'html[data-theme="dark"] input,html[data-theme="dark"] select,html[data-theme="dark"] textarea,html[data-theme="dark"] .mode-btn,html[data-theme="dark"] .num-chip,html[data-theme="dark"] .choice,html[data-theme="dark"] .btn-secondary,html[data-theme="dark"] .bank-row,html[data-theme="dark"] .bank-toolbar input,html[data-theme="dark"] .bank-toolbar select{background:rgba(12,34,41,.62)!important;border-color:var(--portal-line)!important;color:#edf3ee!important;}',
      'html[data-theme="dark"] .tool-btn,html[data-theme="dark"] .text-btn,html[data-theme="dark"] .template-item,html[data-theme="dark"] .btn-export,html[data-theme="dark"] .week-nav-btn,html[data-theme="dark"] .btn-delete,html[data-theme="dark"] .btn-cancel-edit,html[data-theme="dark"] .btn-edit-item{background:rgba(12,34,41,.62)!important;border-color:var(--portal-line)!important;color:#edf3ee!important;}',
      'html[data-theme="dark"] .tool-btn:hover,html[data-theme="dark"] .text-btn:hover,html[data-theme="dark"] .template-item:hover,html[data-theme="dark"] .btn-export:hover,html[data-theme="dark"] .week-nav-btn:hover,html[data-theme="dark"] .btn-delete:hover,html[data-theme="dark"] .btn-cancel-edit:hover,html[data-theme="dark"] .btn-edit-item:hover{background:rgba(119,200,181,.16)!important;color:#edf3ee!important;}',
      'html[data-theme="dark"] .editor-close,html[data-theme="dark"] .del-btn,html[data-theme="dark"] .editor-del-btn,html[data-theme="dark"] .editor-add-btn,html[data-theme="dark"] .test-btn,html[data-theme="dark"] .add-reminder-btn,html[data-theme="dark"] .edit-btn{background:transparent!important;border-color:var(--portal-line)!important;color:#edf3ee!important;}',
      'html[data-theme="dark"] .editor-add-btn:hover,html[data-theme="dark"] .test-btn:hover,html[data-theme="dark"] .add-reminder-btn:hover,html[data-theme="dark"] .edit-btn:hover{background:rgba(119,200,181,.16)!important;color:#edf3ee!important;}',
      'html[data-theme="dark"] .modal-overlay,html[data-theme="dark"] .editor-overlay{background:rgba(3,14,19,.78)!important;}',
      'html[data-theme="dark"] button{color:#edf3ee;}',
      'html[data-theme="dark"] .toolbar{height:auto;min-height:56px;flex-wrap:wrap;justify-content:flex-start;padding-top:8px;padding-bottom:8px;overflow:visible;}',
      'html[data-theme="dark"] .toolbar-group{min-width:0;flex-wrap:wrap;}',
      'html[data-theme="dark"] .config-panel{flex-wrap:wrap;overflow-x:visible;}',
      'html[data-theme="dark"] #reminders-container{min-width:0;flex-wrap:wrap!important;}',
      'html[data-theme="dark"] .gk50-portal-note{color:#c9d8d2!important;}',
      '@media(max-width:1100px){.toolbar{height:auto!important;min-height:56px;flex-wrap:wrap!important;justify-content:flex-start!important;padding:8px 12px!important;overflow:visible!important}.toolbar-group{min-width:0;flex-wrap:wrap}.paper-wrapper{padding-top:104px!important}.config-panel{flex-wrap:wrap!important;overflow-x:visible!important}#reminders-container{min-width:0;flex-wrap:wrap!important;}}',
      '@media(max-width:680px){body{background-attachment:scroll!important;}}'
    ].join('');
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
    enhanceEmbeddedToolFrame();
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
      section.innerHTML = '<div class="countdown-empty"><img class="countdown-empty-visual" src="assets/images/changan/empty-exam-target.webp" alt="" loading="lazy"><div class="countdown-empty-copy"><p>还没有设置考试目标</p><button onclick="window.openCountdownConfig()">设置考试</button></div></div>';
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
    cdState.milestones.forEach(function(ms, idx) {
      var md = new Date(ms.date + 'T00:00:00'), isDone = ms.completed === true || (ms.completed !== false && md <= now);
      if (isDone) done++;
      mh += '<button type="button" class="countdown-milestone ' + (isDone ? 'done' : 'upcoming') + '" onclick="window.toggleCountdownMilestone(' + idx + ')" aria-pressed="' + (isDone ? 'true' : 'false') + '" title="点击切换完成状态"><span class="ms-check" aria-hidden="true">' + (isDone ? '✓' : '') + '</span><span class="ms-name">' + esc(ms.name || '未命名里程碑') + '</span><span class="ms-date">' + esc(ms.date || '未设置日期') + '</span></button>';
    });
    section.innerHTML = '<div class="countdown-header"><div class="countdown-context"><span class="countdown-kicker">考试倒计时</span><div class="countdown-title">' + esc(cdState.name) + '</div><div class="countdown-target-date">目标日期：' + esc(cdState.date) + '</div></div><button type="button" class="countdown-edit-btn" onclick="window.openCountdownConfig()">编辑</button></div>' +
      '<div class="countdown-hero"><div><span class="countdown-day-label">剩余时间</span><div class="countdown-day-line"><strong class="countdown-big-number">' + (diffDays > 0 ? diffDays : 0) + '</strong><span class="countdown-day-unit">天</span></div><span class="countdown-big-unit">' + (diffDays > 0 ? '距考试日' : '考试日已到') + '</span></div><div class="countdown-progress-wrap"><span>时间进度</span><div class="countdown-progress" role="progressbar" aria-label="倒计时进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><div class="countdown-progress-fill" style="width:' + pct + '%"></div></div><b>' + pct + '%</b></div></div>' +
      '<div class="countdown-milestones-heading"><span>里程碑</span><b>' + done + ' / ' + cdState.milestones.length + '</b></div><div class="countdown-milestones">' + mh + '</div>';
  }

  function toggleCountdownMilestone(index) {
    var ms = cdState.milestones[index];
    if (!ms) return;
    var now = new Date();
    var currentlyDone = ms.completed === true || (ms.completed !== false && ms.date && new Date(ms.date + 'T00:00:00') <= now);
    ms.completed = !currentlyDone;
    saveCountdownConfig();
  }

  function saveCountdownConfig() { try { localStorage.setItem('gk-countdown', JSON.stringify(cdState)); if (window.SyncStore) window.SyncStore.writeData('gk-countdown', cdState); } catch(e) {} renderCountdown(); }

  function defaultCountdownMilestones() {
    return [{name:'报名截止',date:''},{name:'缴费截止',date:''},{name:'打印准考证',date:''},{name:'笔试',date:''},{name:'面试',date:''}];
  }

  function appendCountdownMilestoneRow(list, milestone) {
    var ms = milestone || { name: '', date: '' };
    var row = document.createElement('div');
    row.className = 'countdown-config-milestone';
    row.dataset.completed = ms.completed === true ? 'true' : (ms.completed === false ? 'false' : '');
    row.innerHTML = '<input type="text" class="cd-ms-name" maxlength="40" aria-label="里程碑名称" placeholder="如：报名截止" value="' + esc(ms.name || '') + '">' +
      '<input type="date" class="cd-ms-date" aria-label="里程碑日期" value="' + esc(ms.date || '') + '">' +
      '<button type="button" class="countdown-delete-milestone" aria-label="删除此里程碑" title="删除此里程碑">×</button>';
    row.querySelector('.countdown-delete-milestone').addEventListener('click', function () { row.remove(); });
    list.appendChild(row);
  }

  function openCountdownConfig() {
    var overlay = document.getElementById('cd-config-overlay'); if (!overlay) return;
    var nameInp = document.getElementById('cd-config-name'), dateInp = document.getElementById('cd-config-date');
    if (nameInp) nameInp.value = cdState.name || '';
    if (dateInp) dateInp.value = cdState.date || '';
    var list = document.getElementById('cd-config-milestones');
    if (list) {
      var msList = cdState.milestones.length > 0 ? cdState.milestones : defaultCountdownMilestones();
      list.innerHTML = '';
      msList.forEach(function(ms) { appendCountdownMilestoneRow(list, ms); });
    }
    overlay.classList.add('open');
  }

  function addCountdownMilestone() {
    var list = document.getElementById('cd-config-milestones');
    if (!list) return;
    appendCountdownMilestoneRow(list, { name: '', date: '' });
    var input = list.lastElementChild && list.lastElementChild.querySelector('.cd-ms-name');
    if (input) input.focus();
  }

  function saveCountdownConfigModal() {
    var nameInp = document.getElementById('cd-config-name'), dateInp = document.getElementById('cd-config-date');
    if (nameInp) cdState.name = nameInp.value;
    if (dateInp) cdState.date = dateInp.value;
    var list = document.getElementById('cd-config-milestones');
    if (list) {
      var milestones = [];
      list.querySelectorAll('.countdown-config-milestone').forEach(function(row) {
        var name = row.querySelector('.cd-ms-name').value.trim().slice(0, 40);
        var date = row.querySelector('.cd-ms-date').value;
        if (!name) return;
        var ms = { name: name, date: date };
        if (row.dataset.completed === 'true') ms.completed = true;
        if (row.dataset.completed === 'false') ms.completed = false;
        milestones.push(ms);
      });
      cdState.milestones = milestones;
    }
    saveCountdownConfig();
    closeCountdownConfigModal();
  }

  function closeCountdownConfigModal() { var o = document.getElementById('cd-config-overlay'); if (o) o.classList.remove('open'); }
  window.openCountdownConfig = openCountdownConfig;

  function buildLinkAnchor(link, className) {
    var label = link.name || link.url || '';
    var a = document.createElement('a');
    a.className = className;
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = label;
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg><span>' + esc(label) + '</span>';
    return a;
  }

  function renderLinkArea(containerId, emptyId, className, hideContainerWhenEmpty) {
    var c = document.getElementById(containerId), e = document.getElementById(emptyId);
    var bar = containerId === 'global-links' ? document.getElementById('global-link-bar') : null;
    if (!c) return;
    c.innerHTML = '';
    if (links.length === 0) {
      if (e) e.style.display = hideContainerWhenEmpty ? 'none' : '';
      if (bar) bar.classList.add('is-empty');
      return;
    }
    if (e) e.style.display = 'none';
    if (bar) bar.classList.remove('is-empty');
    links.forEach(function(l) { c.appendChild(buildLinkAnchor(l, className)); });
  }

  function renderLinks() {
    renderLinkArea('footer-links', 'footer-links-empty', 'dashboard-footer-link', false);
    renderLinkArea('global-links', 'global-links-empty', 'global-link-chip', true);
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

  function goHomeAfterAuth() {
    // Return to the dashboard after signing in.
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    closeAccountModal();
    navigateTo('dashboard');
  }

  function accountSignIn() {
    var c = getAccountCredentials();
    if (!c.email || !c.password) { setAccountMessage('请输入邮箱和密码'); return; }
    setAccountMessage('正在登录并同步...');
    window.SyncStore.signIn(c.email, c.password).then(function () {
      setAccountMessage('登录成功，已同步本地数据');
      loadAllData();
      goHomeAfterAuth();
    }).catch(function (err) { setAccountMessage(err && err.message ? err.message : '登录失败'); });
  }

  function accountSignUp() {
    var c = getAccountCredentials();
    if (!c.email || !c.password) { setAccountMessage('请输入邮箱和密码'); return; }
    setAccountMessage('正在注册...');
    window.SyncStore.signUp(c.email, c.password).then(function () {
      var info = window.SyncStore.getAuthInfo();
      if (info.isLoggedIn) { setAccountMessage('注册成功，已同步本地数据'); loadAllData(); goHomeAfterAuth(); }
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
      if (!result || result.error) {
        setAccountMessage('同步或旧数据清理未完成，请稍后重试');
        return;
      }
      if (result.skipped) {
        setAccountMessage('请先登录账号再同步');
        return;
      }
      setAccountMessage('同步完成：上传 ' + result.uploaded + ' 项，检查云端 ' + result.downloaded + ' 项');
      loadFromLocal();
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
  //  Periodic Sync （定时同步）
  // =========================================================
  function startPeriodicSync() {
    stopPeriodicSync();
    syncInterval = setInterval(function () {
      if (!window.SyncStore || !syncInfo.hasConfig) return;
      if (!window.SyncStore.mergeLocalWithCloud) return;
      window.SyncStore.mergeLocalWithCloud(function (result) {
        if (!result || !result.downloaded) return;
        loadFromLocal();
        updateSyncTime();
      });
    }, 30000);
  }

  function stopPeriodicSync() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  }

  function updateSyncTime() {
    var _el = document.getElementById('sidebar-sync-status');
    if (!_el) return;
    _el.className = 'sidebar-sync-status online';
    _el.title = '同步已连接 - ' + new Date().toLocaleTimeString();
  }


  

  // --- Local Export/Import ---
  function isExportableDataKey(key) {
    if (!key || key === 'gk-sync-key' || key.indexOf('gk-sync-stamp:') === 0) return false;
    if (window.SyncStore && window.SyncStore.isBusinessKey) return window.SyncStore.isBusinessKey(key);
    return false;
  }

  function exportLocalData() {
    if (window.SyncStore) window.SyncStore.cleanupLocalData();
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (isExportableDataKey(k)) {
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
          if (data.hasOwnProperty(k) && isExportableDataKey(k)) {
            var clean = window.SyncStore.sanitizeValue(k, data[k]);
            var val = typeof clean === 'string' ? clean : JSON.stringify(clean);
            try {
              localStorage.setItem(k, val);
              if (window.SyncStore && window.SyncStore.writeData) window.SyncStore.writeData(k, clean);
              count++;
            } catch(ex) {}
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
  window.toggleCountdownMilestone = toggleCountdownMilestone;
  window.addCountdownMilestone = addCountdownMilestone;
  window.exportLocalData = exportLocalData;
  window.importLocalData = importLocalData;
  window.handleImportFile = handleImportFile;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
