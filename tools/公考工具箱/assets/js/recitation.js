(function () {
  'use strict';

  var KEY = 'gk-recitation-v1';
  var THEMES = [
    { id: 'ideal', label: '理想' },
    { id: 'responsibility', label: '担当' },
    { id: 'struggle', label: '奋斗' },
    { id: 'skill', label: '本领' },
    { id: 'morality', label: '品德' }
  ];

  var SEGMENTS = [
    {
      id: 'ideal', short: '远大理想', title: '一、树立远大理想',
      goal: '背熟“立志、信念、小我融入大我”的完整论证，能直接用于理想信念主题。',
      meaning: '理想信念既决定青年的人生方向，也构成国家民族前进的动力。',
      role: '从“为何青年重要”转入第一项具体要求：确立志向和价值坐标。',
      tip: '牢记两组对照：“志存高远/无舵之舟”“小我融入大我/孤芳自赏”。',
      anchors: ['理想信念', '国家未来', '无坚不摧', '志存高远', '无舵之舟', '立志而圣则圣矣', '小我融入大我', '与时代同步伐', '与人民共命运', '孤芳自赏'],
      text: ['新时代中国青年要树立远大理想。青年的理想信念关乎国家未来。青年理想远大、信念坚定，是一个国家、一个民族无坚不摧的前进动力。青年志存高远，就能激发奋进潜力，青春岁月就不会像无舵之舟漂泊不定。正所谓“立志而圣则圣矣，立志而贤则贤矣”。青年的人生目标会有不同，职业选择也有差异，但只有把自己的小我融入祖国的大我、人民的大我之中，与时代同步伐、与人民共命运，才能更好实现人生价值、升华人生境界。离开了祖国需要、人民利益，任何孤芳自赏都会陷入越走越窄的狭小天地。']
    },
    {
      id: 'responsibility', short: '时代担当', title: '五、担当时代责任',
      goal: '背熟鲁迅“生力”引文、三勇与三个“一切”，面对急难险重任务能直接调用。',
      meaning: '民族复兴需要青年在风险挑战面前担当作为，拒绝逃避责任。',
      role: '由价值认同转向面对时代任务的责任意识，是面试“怎么办”类题目的核心素材。',
      tip: '先记鲁迅引文的“三个遇见”，再记正反两面：三勇与三个“一切”。',
      anchors: ['时代呼唤担当', '民族振兴', '生力', '辟成平地', '栽种树木', '开掘井泉', '迎难而上', '挺身而出', '勇挑重担、勇克难关、勇斗风险', '初生牛犊不怕虎', '越是艰险越向前', '躲进小楼成一统'],
      text: ['新时代中国青年要担当时代责任。时代呼唤担当，民族振兴是青年的责任。鲁迅先生说，青年“所多的是生力，遇见深林，可以辟成平地的，遇见旷野，可以栽种树木的，遇见沙漠，可以开掘井泉的”。在实现中华民族伟大复兴的新征程上，应对重大挑战、抵御重大风险、克服重大阻力、解决重大矛盾，迫切需要迎难而上、挺身而出的担当精神。只要青年都勇挑重担、勇克难关、勇斗风险，中国特色社会主义就能充满活力、充满后劲、充满希望。青年要保持初生牛犊不怕虎、越是艰险越向前的刚健勇毅，勇立时代潮头，争做时代先锋。一切视探索尝试为畏途、一切把负重前行当吃亏、一切“躲进小楼成一统”逃避责任的思想和行为，都是要不得的，都是成不了事的，也是难以真正获得人生快乐的。']
    },
    {
      id: 'struggle', short: '砥砺奋斗', title: '七、勇于砥砺奋斗',
      goal: '背熟“底色、水击三千里、小事见精神”三层逻辑，申论实干主题最常用。',
      meaning: '奋斗创造民族复兴与个人理想；面对困难更要在日常任务中坚持、从挫折中奋起。',
      role: '强调实现使命的根本行动方式，并将其落实为日常实践。',
      tip: '本段三层：奋斗创造历史 -> 现实仍需奋斗 -> 小事中见精神、挫折中奋起。',
      anchors: ['最亮丽的底色', '水击三千里', '前赴后继', '艰苦卓绝', '永久奋斗', '艰苦奋斗精神', '每一件小事', '每一项任务', '每一项职责', '荆棘丛生', '永不气馁'],
      text: ['新时代中国青年要勇于砥砺奋斗。奋斗是青春最亮丽的底色。“自信人生二百年，会当水击三千里。”民族复兴的使命要靠奋斗来实现，人生理想的风帆要靠奋斗来扬起。没有广大人民特别是一代代青年前赴后继、艰苦卓绝的接续奋斗，就没有中国特色社会主义新时代的今天，更不会有实现中华民族伟大复兴的明天。', '千百年来，中华民族历经苦难，但没有任何一次苦难能够打垮我们，最后都推动了我们民族精神、意志、力量的一次次升华。今天，我们的生活条件好了，但奋斗精神一点都不能少，中国青年永久奋斗的好传统一点都不能丢。在实现中华民族伟大复兴的新征程上，必然会有艰巨繁重的任务，必然会有艰难险阻甚至惊涛骇浪，特别需要我们发扬艰苦奋斗精神。奋斗不只是响亮的口号，而是要在做好每一件小事、完成每一项任务、履行每一项职责中见精神。奋斗的道路不会一帆风顺，往往荆棘丛生、充满坎坷。强者，总是从挫折中不断奋起、永不气馁。']
    },
    {
      id: 'skill', short: '过硬本领', title: '九、练就过硬本领',
      goal: '背熟“黄金时期、青春虚度无所成、三个跟上”，面试能力不足类题目直接可用。',
      meaning: '青年成长的黄金期既有广阔舞台，也面临能力素质的新要求。',
      role: '从精神状态转向胜任时代任务所需的能力建设。',
      tip: '先背“时代变化三项”，再背“青年行动四项”，最后落到“三个跟上”。',
      anchors: ['黄金时期', '青春虚度无所成', '知识更新', '层出不穷', '广阔舞台', '更高要求', '珍惜韶华', '不负青春', '科学知识', '内在素质', '过硬本领', '跟上'],
      text: ['新时代中国青年要练就过硬本领。青年是苦练本领、增长才干的黄金时期。“青春虚度无所成，白首衔悲亦何及。”当今时代，知识更新不断加快，社会分工日益细化，新技术新模式新业态层出不穷。这既为青年施展才华、竞展风采提供了广阔舞台，也对青年能力素质提出了新的更高要求。不论是成就自己的人生理想，还是担当时代的神圣使命，青年都要珍惜韶华、不负青春，努力学习掌握科学知识，提高内在素质，锤炼过硬本领，使自己的思维视野、思想观念、认识水平跟上越来越快的时代发展。']
    },
    {
      id: 'morality', short: '品德修为', title: '十一、锤炼品德修为',
      goal: '背熟“人无德不立、三结合、三面对”，干部修身和利益诱惑主题都能用。',
      meaning: '精神强大和人格修养同样重要；青年要在认知、养成、实践中立德，并在现实中辨是非、守规矩、知感恩。',
      role: '从本领建设进一步落到人格根基与处世准则。',
      tip: '核心是“德的三结合”，后面按三种面对来记：世界变局、外部诱惑、美好岁月。',
      anchors: ['人无德不立', '止于至善', '物质上强', '精神上强', '道德认知', '道德养成', '道德实践', '明辨是非', '恪守正道', '保持定力', '严守规矩', '饮水思源', '摸爬滚打'],
      text: ['新时代中国青年要锤炼品德修为。人无德不立，品德是为人之本。止于至善，是中华民族始终不变的人格追求。我们要建设的社会主义现代化强国，不仅要在物质上强，更要在精神上强。精神上强，才是更持久、更深沉、更有力量的。青年要把正确的道德认知、自觉的道德养成、积极的道德实践紧密结合起来，不断修身立德，打牢道德根基，在人生道路上走得更正、走得更远。面对复杂的世界大变局，要明辨是非、恪守正道，不人云亦云、盲目跟风。面对外部诱惑，要保持定力、严守规矩，用勤劳的双手和诚实的劳动创造美好生活，拒绝投机取巧、远离自作聪明。面对美好岁月，要有饮水思源、懂得回报的感恩之心，感恩党和国家，感恩社会和人民。要在奋斗中摸爬滚打，体察世间冷暖、民众忧乐、现实矛盾，从中找到人生真谛、生命价值、事业方向。']
    }
  ];

  var QUOTES = [
    { id: 'q-ideal-1', theme: 'ideal', text: '立志而圣则圣矣，立志而贤则贤矣。', source: '树立远大理想', tags: ['通用', '面试'] },
    { id: 'q-ideal-2', theme: 'ideal', text: '青年理想远大、信念坚定，是一个国家、一个民族无坚不摧的前进动力。', source: '树立远大理想', tags: ['通用', '申论'] },
    { id: 'q-ideal-3', theme: 'ideal', text: '青春岁月就不会像无舵之舟漂泊不定。', source: '树立远大理想', tags: ['通用'] },
    { id: 'q-ideal-4', theme: 'ideal', text: '把个人的小我融入祖国的大我、人民的大我之中，与时代同步伐、与人民共命运。', source: '树立远大理想', tags: ['申论', '面试'] },
    { id: 'q-resp-1', theme: 'responsibility', text: '时代呼唤担当，民族振兴是青年的责任。', source: '担当时代责任', tags: ['通用', '面试'] },
    { id: 'q-resp-2', theme: 'responsibility', text: '青年所多的是生力，遇见深林，可以辟成平地的，遇见旷野，可以栽种树木的，遇见沙漠，可以开掘井泉的。', source: '担当时代责任', tags: ['申论', '面试'] },
    { id: 'q-resp-3', theme: 'responsibility', text: '勇挑重担、勇克难关、勇斗风险。', source: '担当时代责任', tags: ['通用'] },
    { id: 'q-resp-4', theme: 'responsibility', text: '初生牛犊不怕虎、越是艰险越向前。', source: '担当时代责任', tags: ['面试'] },
    { id: 'q-struggle-1', theme: 'struggle', text: '奋斗是青春最亮丽的底色。', source: '勇于砥砺奋斗', tags: ['通用', '面试'] },
    { id: 'q-struggle-2', theme: 'struggle', text: '自信人生二百年，会当水击三千里。', source: '勇于砥砺奋斗', tags: ['申论', '面试'] },
    { id: 'q-struggle-3', theme: 'struggle', text: '民族复兴的使命要靠奋斗来实现，人生理想的风帆要靠奋斗来扬起。', source: '勇于砥砺奋斗', tags: ['申论'] },
    { id: 'q-struggle-4', theme: 'struggle', text: '奋斗不只是响亮的口号，而是要在做好每一件小事、完成每一项任务、履行每一项职责中见精神。', source: '勇于砥砺奋斗', tags: ['申论', '面试'] },
    { id: 'q-skill-1', theme: 'skill', text: '青年是苦练本领、增长才干的黄金时期。', source: '练就过硬本领', tags: ['通用'] },
    { id: 'q-skill-2', theme: 'skill', text: '青春虚度无所成，白首衔悲亦何及。', source: '练就过硬本领', tags: ['申论', '面试'] },
    { id: 'q-skill-3', theme: 'skill', text: '珍惜韶华、不负青春，努力学习掌握科学知识，提高内在素质，锤炼过硬本领。', source: '练就过硬本领', tags: ['申论'] },
    { id: 'q-skill-4', theme: 'skill', text: '使自己的思维视野、思想观念、认识水平跟上越来越快的时代发展。', source: '练就过硬本领', tags: ['通用'] },
    { id: 'q-moral-1', theme: 'morality', text: '人无德不立，品德是为人之本。', source: '锤炼品德修为', tags: ['通用', '面试'] },
    { id: 'q-moral-2', theme: 'morality', text: '止于至善，是中华民族始终不变的人格追求。', source: '锤炼品德修为', tags: ['通用'] },
    { id: 'q-moral-3', theme: 'morality', text: '明辨是非、恪守正道，保持定力、严守规矩。', source: '锤炼品德修为', tags: ['面试'] },
    { id: 'q-moral-4', theme: 'morality', text: '饮水思源、懂得回报，在奋斗中摸爬滚打。', source: '锤炼品德修为', tags: ['申论'] }
  ];

  var MOCK = [
    { id: 's1', type: '申论', theme: 'ideal', scenario: '材料主题是“青年干部要扣好人生第一粒扣子”。', prompt: '请写一段论证：理想信念对青年成长的作用。' },
    { id: 's2', type: '申论', theme: 'responsibility', scenario: '材料主题是“基层治理中的青年担当”。', prompt: '请写一段论证：新时代青年为什么要敢于担当。' },
    { id: 's3', type: '申论', theme: 'struggle', scenario: '材料主题是“幸福是奋斗出来的”。', prompt: '请写一段论证：奋斗精神与实干作风。' },
    { id: 's4', type: '申论', theme: 'skill', scenario: '材料主题是“本领恐慌”。', prompt: '请写一段论证：青年如何练就过硬本领。' },
    { id: 's5', type: '申论', theme: 'morality', scenario: '材料主题是“干部修身立德”。', prompt: '请写一段论证：品德修为对从政的重要意义。' },
    { id: 'i1', type: '面试', theme: 'ideal', scenario: '面试官问：请谈谈你对“立志而圣则圣矣，立志而贤则贤矣”的理解。', prompt: '请回忆并组织你的作答要点。' },
    { id: 'i2', type: '面试', theme: 'responsibility', scenario: '面试官问：新入职后被安排急难险重任务，你怎么看、怎么做？', prompt: '请回忆并组织你的作答要点。' },
    { id: 'i3', type: '面试', theme: 'struggle', scenario: '面试官问：有人说“奋斗太辛苦，躺平更舒服”，你怎么看？', prompt: '请回忆并组织你的作答要点。' },
    { id: 'i4', type: '面试', theme: 'skill', scenario: '面试官问：进入岗位后发现自身能力不足，你会怎么办？', prompt: '请回忆并组织你的作答要点。' },
    { id: 'i5', type: '面试', theme: 'morality', scenario: '面试官问：工作中面对利益诱惑，你如何守住底线？', prompt: '请回忆并组织你的作答要点。' }
  ];

  function defaultState() {
    return {
      version: 1,
      startDate: null,
      day: 0,
      done: [],
      segments: {},
      quotes: {},
      mock: { history: [], current: {} }
    };
  }

  function normalize(raw) {
    var base = defaultState();
    var s = Object.assign(base, raw || {});
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.startDate || '')) s.startDate = null;
    s.day = Math.min(Math.max(parseInt(s.day, 10) || 0, 0), 6);
    s.done = Array.isArray(s.done) ? s.done.filter(function (i) { return i >= 0 && i <= 6; }) : [];
    s.segments = s.segments && typeof s.segments === 'object' ? s.segments : {};
    s.quotes = s.quotes && typeof s.quotes === 'object' ? s.quotes : {};
    s.mock = s.mock && typeof s.mock === 'object' ? s.mock : {};
    s.mock.history = Array.isArray(s.mock.history) ? s.mock.history : [];
    s.mock.current = s.mock.current && typeof s.mock.current === 'object' ? s.mock.current : {};
    return s;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) {}
    var s = defaultState();
    s.startDate = getTodayStr();
    return s;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    if (window.SyncStore && window.SyncStore.writeData) {
      try { window.SyncStore.writeData(KEY, state); } catch (e) {}
    }
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function toISO(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function getTodayStr() {
    return toISO(new Date());
  }

  function addDays(dateStr, days) {
    var parts = dateStr.split('-');
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10) + days);
    return toISO(d);
  }

  function dayDate(i) {
    return addDays(state.startDate || getTodayStr(), i);
  }

  function todayIndex() {
    var today = getTodayStr();
    if (!state.startDate || today < state.startDate) return 0;
    for (var i = 6; i >= 0; i--) {
      if (dayDate(i) <= today) return i;
    }
    return 0;
  }

  function fmtDate(dateStr) {
    var parts = dateStr.split('-');
    return parts[0] + '.' + parts[1] + '.' + parts[2];
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function themeLabel(id) {
    var t = THEMES.find(function (x) { return x.id === id; });
    return t ? t.label : id;
  }

  function splitSentences(text) {
    return text.match(/[^。！？!?]+[。！？!?]?/g) || [text];
  }

  function shuffle(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function toast(message) {
    var root = document.getElementById('recitation-view');
    if (!root) return;
    var el = root.querySelector('.rec-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'rec-toast';
      root.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  var state = load();
  var activeTab = 'plan';
  var mode = 'full';
  var clozeOpen = false;
  var quoteTheme = 'all';
  var quoteTag = 'all';
  var quoteStatus = 'all';
  var drill = null;

  function init() {
    if (!state.startDate) {
      state.startDate = getTodayStr();
      state.day = 0;
    }
    var tIdx = todayIndex();
    if (state.day < tIdx) state.day = Math.min(6, tIdx);
    save();
    var root = document.getElementById('recitation-view');
    if (!root) return;
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    render();
  }

  function render() {
    var root = document.getElementById('recitation-view');
    if (!root) return;
    var doneCount = state.done.length;
    var pct = Math.round(doneCount / 7 * 100);
    root.innerHTML =
      '<div class="rec-shell">' +
        '<header class="rec-head">' +
          '<div class="rec-title-block">' +
            '<p class="rec-kicker">五四讲话</p>' +
            '<h2>背诵练习</h2>' +
          '</div>' +
          '<div class="rec-head-right">' +
            '<div class="rec-progress">' +
              '<span>已完成 <b>' + doneCount + '</b> / 7 天</span>' +
              '<div class="rec-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
            '</div>' +
            '<div class="rec-tabs">' +
              '<button type="button" data-rec-tab="plan" class="' + (activeTab === 'plan' ? 'active' : '') + '">训练计划</button>' +
              '<button type="button" data-rec-tab="quotes" class="' + (activeTab === 'quotes' ? 'active' : '') + '">金句库</button>' +
              '<button type="button" data-reset-rec class="rec-reset">重置进度</button>' +
            '</div>' +
          '</div>' +
        '</header>' +
        (activeTab === 'quotes' ? renderQuotes() : renderPlan()) +
      '</div>';
  }

  function renderPlan() {
    var missing = [];
    var tIdx = todayIndex();
    for (var i = 0; i < tIdx; i++) {
      if (state.done.indexOf(i) === -1) missing.push(i + 1);
    }
    var notice = missing.length
      ? '<div class="rec-notice">前面还有未完成的训练日（第 ' + missing.join('、') + ' 天），可在下方计划中补做。</div>'
      : '';
    return notice + renderDayNav() + renderDayContent();
  }

  function renderDayNav() {
    var today = getTodayStr();
    var tIdx = todayIndex();
    var buttons = '';
    for (var i = 0; i < 7; i++) {
      var date = dayDate(i);
      var locked = date > today;
      var done = state.done.indexOf(i) !== -1;
      var label = i < 5 ? SEGMENTS[i].short : (i === 5 ? '五段串联' : '场景模考');
      buttons +=
        '<button type="button" data-day="' + i + '" class="' + (i === state.day ? 'active' : '') + ' ' +
        (done ? 'done' : '') + ' ' + (locked ? 'locked' : '') + '" ' + (locked ? 'disabled' : '') + '>' +
          '<span>第 ' + (i + 1) + ' 天</span>' +
          '<em>' + esc(label) + '</em>' +
          '<small>' + fmtDate(date) + (date === today ? ' · 今日' : '') + '</small>' +
        '</button>';
    }
    return '<nav class="rec-day-nav" aria-label="7天训练计划">' + buttons +
      (state.day !== tIdx ? '<button type="button" data-goto-today class="rec-today-link">回到今日</button>' : '') +
      '</nav>';
  }

  function renderDayContent() {
    var day = state.day;
    var date = dayDate(day);
    if (day < 5) return renderStudyDay(day, date);
    if (day === 5) return renderChainDay(date);
    return renderMockDay(date);
  }

  function renderStudyDay(day, date) {
    var seg = SEGMENTS[day];
    var status = state.segments[seg.id] || '';
    var modebar =
      '<div class="rec-modebar" role="group" aria-label="正文显示方式">' +
        '<button type="button" data-mode="full" class="' + (mode === 'full' ? 'active' : '') + '">完整原文</button>' +
        '<button type="button" data-mode="skeleton" class="' + (mode === 'skeleton' ? 'active' : '') + '">关键词骨架</button>' +
        '<button type="button" data-mode="prompt" class="' + (mode === 'prompt' ? 'active' : '') + '">首句提示</button>' +
      '</div>';
    return (
      '<p class="rec-eyebrow">第 ' + (day + 1) + ' 天 · ' + fmtDate(date) + '</p>' +
      '<h3 class="rec-title">' + esc(seg.title) + '</h3>' +
      '<section class="rec-card">' +
        '<div class="rec-card-head"><h4>正文</h4></div>' +
        modebar +
        '<div class="rec-audio" data-rec-audio><button type="button" class="rec-audio-btn" data-audio-toggle aria-pressed="false"><span aria-hidden="true">▶</span> 跟读</button><div class="rec-wave" aria-hidden="true">' + Array.from({length: 18}, function (_, i) { return '<i style="--wave-delay:' + (i * 45) + 'ms"></i>'; }).join('') + '</div><span class="rec-audio-label">逐句朗读</span></div>' +
        '<div class="rec-text ' + mode + '">' + renderText(seg) + '</div>' +
      '</section>' +
      '<section class="rec-card">' +
        '<div class="rec-card-head"><h4>挖空自测</h4><button type="button" class="rec-link" data-reveal-cloze>' + (clozeOpen ? '收起原句' : '显示原句') + '</button></div>' +
        '<div class="rec-cloze-list' + (clozeOpen ? ' open' : '') + '">' + renderCloze(seg) + '</div>' +
      '</section>' +
      '<section class="rec-card rec-status-card"><div class="rec-card-head"><h4>背诵结果</h4></div>' + statusButtons(seg) + '</section>' +
      doneButton(day)
    );
  }

  function renderText(seg) {
    if (mode === 'full') {
      return seg.text.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    }
    if (mode === 'skeleton') {
      return seg.text.map(function (p) {
        var leads = splitSentences(p).map(function (sentence, idx) {
          var hit = seg.anchors.find(function (a) { return sentence.indexOf(a) !== -1; }) || sentence.slice(0, Math.min(14, sentence.length));
          return '<span class="rec-skeleton-word" style="--rec-delay:' + (idx * 70) + 'ms"><span class="rec-lead">' + esc(hit) + '</span>…</span>';
        });
        return '<p>' + leads.join('　') + '</p>';
      }).join('');
    }
    var first = splitSentences(seg.text[0])[0] || seg.text[0];
    return '<p><strong class="rec-lead rec-type" style="--rec-chars:' + first.length + '">' + esc(first) + '</strong> ……</p>' +
      '<p class="rec-keywords">关键词：' + seg.anchors.slice(0, 6).map(esc).join('　/　') + '</p>';
  }

  function renderCloze(seg) {
    var sentences = seg.text.flatMap(function (p) { return splitSentences(p); }).filter(function (s) { return s.trim(); }).slice(0, 5);
    return sentences.map(function (sentence) {
      var hidden = null;
      var anchors = seg.anchors.slice().sort(function (a, b) { return b.length - a.length; });
      for (var i = 0; i < anchors.length; i++) {
        if (sentence.indexOf(anchors[i]) !== -1) { hidden = anchors[i]; break; }
      }
      var shown = sentence;
      if (hidden) {
        var idx = sentence.indexOf(hidden);
        shown = sentence.slice(0, idx) + '<strong>＿＿＿＿</strong>' + sentence.slice(idx + hidden.length);
      } else {
        var lead = sentence.slice(0, Math.min(8, sentence.length));
        shown = '<strong>＿＿＿＿</strong>' + sentence.slice(lead.length);
      }
      return '<div class="rec-cloze"><div>' + shown + '</div><div class="rec-answer">原句：' + esc(sentence) + '</div></div>';
    }).join('');
  }

  function statusButtons(seg) {
    var status = state.segments[seg.id] || '';
    return '<div class="rec-status-row"><span>掌握情况</span>' +
      '<button type="button" data-seg-status="' + seg.id + '|mastered" class="' + (status === 'mastered' ? 'active mastered' : '') + '">已掌握</button>' +
      '<button type="button" data-seg-status="' + seg.id + '|weak" class="' + (status === 'weak' ? 'active weak' : '') + '">需复习</button>' +
      '</div>';
  }

  function renderChainDay(date) {
    var cards = SEGMENTS.map(function (seg, i) {
      var status = state.segments[seg.id] || '';
      return '<article class="rec-chain-card">' +
        '<div class="rec-chain-top"><span>' + (i + 1) + '</span><h4>' + esc(seg.title) + '</h4>' + statusButtons(seg) + '</div>' +
        '<p class="rec-chain-hint"><strong>首句：</strong>' + esc(splitSentences(seg.text[0])[0] || seg.text[0]) + '</p>' +
        '<p class="rec-chain-keywords"><strong>关键词：</strong>' + seg.anchors.slice(0, 6).map(esc).join(' / ') + '</p>' +
        '<button type="button" class="rec-link" data-recall-toggle>展开核对</button>' +
        '<div class="rec-recall-full">' + seg.text.map(esc).join('') + '</div>' +
      '</article>';
    }).join('');
    return (
      '<p class="rec-eyebrow">第 6 天 · ' + fmtDate(date) + '</p>' +
      '<h3 class="rec-title">五段串联复述</h3>' +
      '<p class="rec-goal">按“理想→担当→奋斗→本领→品德”主线连续复述，逐段展开核对，卡住的段落标为“需复习”。</p>' +
      '<section class="rec-chain">' + cards + '</section>' +
      doneButton(5)
    );
  }

  function renderMockDay(date) {
    var allRated = MOCK.every(function (q) {
      return state.mock.current[q.id] && state.mock.current[q.id].rated;
    });
    var result = allRated ? computeResult() : null;
    return (
      '<p class="rec-eyebrow">第 7 天 · ' + fmtDate(date) + '</p>' +
      '<h3 class="rec-title">金句库场景模考</h3>' +
      '<p class="rec-goal">每道题先判断最适用主题，再回忆适用金句；提交后自评“完整想起 / 部分想起 / 未想起”。</p>' +
      (result ? renderMockResult(result) : '') +
      '<section class="rec-mock-list">' + MOCK.map(renderMockQuestion).join('') + '</section>' +
      doneButton(6)
    );
  }

  function renderMockQuestion(q) {
    var a = state.mock.current[q.id] || {};
    var themeOptions = '<option value="">最适用主题</option>' + THEMES.map(function (t) {
      return '<option value="' + t.id + '"' + (a.theme === t.id ? ' selected' : '') + '>' + t.label + '</option>';
    }).join('');
    var ratedLabel = a.rated ? ({ full: '完整想起', partial: '部分想起', none: '未想起' })[a.rating] : '';
    return '<article class="rec-mock-q' + (a.rated ? ' rated' : '') + '">' +
      '<div class="rec-mock-head">' +
        '<span class="rec-mock-type">' + q.type + '</span>' +
        '<h4>' + esc(q.scenario) + '</h4>' +
        '<p>' + esc(q.prompt) + '</p>' +
      '</div>' +
      '<div class="rec-mock-fields">' +
        '<select data-mock-theme="' + q.id + '"' + (a.rated ? ' disabled' : '') + '>' + themeOptions + '</select>' +
        '<textarea data-mock-recall="' + q.id + '" rows="3" placeholder="回忆并写下你适用的金句……"' + (a.rated ? ' disabled' : '') + '>' + esc(a.recall || '') + '</textarea>' +
        '<button type="button" class="rec-btn rec-btn-secondary" data-mock-submit="' + q.id + '"' + (a.rated ? ' disabled' : '') + '>提交本题</button>' +
      '</div>' +
      (a.submitted ? renderMockAnswer(q, a, ratedLabel) : '') +
    '</article>';
  }

  function renderMockAnswer(q, a, ratedLabel) {
    var refs = QUOTES.filter(function (x) { return x.theme === q.theme; }).map(function (x) {
      return '“' + esc(x.text) + '”';
    }).join('<br>');
    return '<div class="rec-mock-answer">' +
      '<p><strong>参考答案主题：</strong>' + themeLabel(q.theme) + '</p>' +
      '<p><strong>参考金句：</strong><br>' + refs + '</p>' +
      (a.rated
        ? '<p class="rec-rated-label">自评：' + ratedLabel + '</p>'
        : '<div class="rec-mock-rate"><span>你想起的程度：</span>' +
          '<button type="button" data-mock-rate="' + q.id + '|full">完整想起</button>' +
          '<button type="button" data-mock-rate="' + q.id + '|partial">部分想起</button>' +
          '<button type="button" data-mock-rate="' + q.id + '|none">未想起</button></div>') +
    '</div>';
  }

  function renderMockResult(res) {
    var themeRows = THEMES.map(function (t) {
      var got = res.themeTotals[t.id].got;
      var total = res.themeTotals[t.id].total;
      var pct = Math.round(got / total * 100);
      return '<div class="rec-theme-row"><span>' + t.label + '</span>' +
        '<div class="rec-theme-bar"><i style="width:' + pct + '%"></i></div><b>' + got + '/' + total + '</b></div>';
    }).join('');
    var weakQuotes = res.weakQuotes.length
      ? QUOTES.filter(function (q) { return res.weakQuotes.indexOf(q.id) !== -1; }).map(function (q) {
          return '“' + esc(q.text) + '”';
        }).join('<br>')
      : '无';
    return '<section class="rec-mock-result">' +
      '<div class="rec-mock-result-head"><h4>模考成绩</h4><span class="rec-total">' + res.total + ' / 100</span></div>' +
      '<div class="rec-theme-bars">' + themeRows + '</div>' +
      '<p class="rec-weak-title">薄弱金句（主题掌握度低于 60%）</p>' +
      '<p class="rec-weak-list">' + weakQuotes + '</p>' +
      '<div class="rec-mock-actions">' +
        '<button type="button" class="rec-btn rec-btn-secondary" data-mock-retry>重新模考</button>' +
        '<button type="button" class="rec-btn rec-btn-primary" data-practice-weak>补练弱项</button>' +
      '</div>' +
    '</section>';
  }

  function computeResult() {
    var total = 0;
    var themeTotals = {};
    THEMES.forEach(function (t) { themeTotals[t.id] = { got: 0, total: 0 }; });
    MOCK.forEach(function (q) {
      var a = state.mock.current[q.id] || {};
      var themeOk = a.theme === q.theme ? 4 : 0;
      var recall = a.rated ? ({ full: 6, partial: 3, none: 0 })[a.rating] : 0;
      total += themeOk + recall;
      themeTotals[q.theme].got += themeOk + recall;
      themeTotals[q.theme].total += 10;
    });
    var weakThemes = THEMES.filter(function (t) {
      return themeTotals[t.id].got / themeTotals[t.id].total < 0.6;
    }).map(function (t) { return t.id; });
    var weakQuotes = QUOTES.filter(function (q) { return weakThemes.indexOf(q.theme) !== -1; }).map(function (q) { return q.id; });
    return { total: total, themeTotals: themeTotals, weakThemes: weakThemes, weakQuotes: weakQuotes };
  }

  function saveMockResult(res) {
    var entry = {
      date: getTodayStr(),
      total: res.total,
      themes: {},
      weakQuotes: res.weakQuotes
    };
    THEMES.forEach(function (t) { entry.themes[t.id] = res.themeTotals[t.id]; });
    var idx = state.mock.history.findIndex(function (h) { return h.date === entry.date; });
    if (idx !== -1) state.mock.history[idx] = entry;
    else state.mock.history.push(entry);
    state.mock.history = state.mock.history.slice(-10);
    save();
  }

  function renderQuotes() {
    var list = QUOTES.filter(function (q) {
      if (quoteTheme !== 'all' && q.theme !== quoteTheme) return false;
      if (quoteTag !== 'all' && q.tags.indexOf(quoteTag) === -1) return false;
      if (quoteStatus === 'mastered' && state.quotes[q.id] !== 'mastered') return false;
      if (quoteStatus === 'weak' && state.quotes[q.id] !== 'weak') return false;
      return true;
    });
    var themeFilter = '<button type="button" data-quote-theme="all" class="' + (quoteTheme === 'all' ? 'active' : '') + '">全部</button>' +
      THEMES.map(function (t) {
        return '<button type="button" data-quote-theme="' + t.id + '" class="' + (quoteTheme === t.id ? 'active' : '') + '">' + t.label + '</button>';
      }).join('');
    var tagFilter = ['all', '通用', '申论', '面试'].map(function (tag) {
      return '<button type="button" data-quote-tag="' + tag + '" class="' + (quoteTag === tag ? 'active' : '') + '">' + (tag === 'all' ? '全部场景' : tag) + '</button>';
    }).join('');
    var statusFilter = ['all', 'mastered', 'weak'].map(function (st) {
      var label = st === 'all' ? '全部状态' : (st === 'mastered' ? '已掌握' : '需复习');
      return '<button type="button" data-quote-status-filter="' + st + '" class="' + (quoteStatus === st ? 'active' : '') + '">' + label + '</button>';
    }).join('');
    return (
      '<section class="rec-quotes">' +
        '<div class="rec-quotes-head">' +
          '<div><h3>金句库</h3><p>共 ' + QUOTES.length + ' 条，按主题单独整理，可随时抽背。</p></div>' +
          '<button type="button" class="rec-btn rec-btn-primary" data-drill-start>随机抽背 5 句</button>' +
        '</div>' +
        (drill ? renderDrill() : '') +
        '<div class="rec-filter-bar">' +
          '<div class="rec-filter-group"><span>主题</span>' + themeFilter + '</div>' +
          '<div class="rec-filter-group"><span>场景</span>' + tagFilter + '</div>' +
          '<div class="rec-filter-group"><span>状态</span>' + statusFilter + '</div>' +
        '</div>' +
        '<div class="rec-quote-grid">' +
          (list.length ? list.map(renderQuoteCard).join('') : '<p class="rec-empty">没有符合条件的金句</p>') +
        '</div>' +
      '</section>'
    );
  }

  function renderQuoteCard(q) {
    var status = state.quotes[q.id] || '';
    return '<article class="rec-quote' + (status ? ' ' + status : '') + '">' +
      '<div class="rec-quote-top"><span class="rec-quote-theme">' + themeLabel(q.theme) + '</span>' +
      '<span class="rec-quote-tags">' + q.tags.map(esc).join(' · ') + '</span></div>' +
      '<p class="rec-quote-text">“' + esc(q.text) + '”</p>' +
      '<p class="rec-quote-source">来源：' + esc(q.source) + '</p>' +
      '<div class="rec-quote-actions">' +
        '<button type="button" data-quote-status="' + q.id + '|mastered" class="' + (status === 'mastered' ? 'active mastered' : '') + '">已掌握</button>' +
        '<button type="button" data-quote-status="' + q.id + '|weak" class="' + (status === 'weak' ? 'active weak' : '') + '">需复习</button>' +
      '</div>' +
    '</article>';
  }

  function renderDrill() {
    var q = QUOTES.find(function (x) { return x.id === drill.ids[drill.index]; });
    if (!q) return '';
    return '<section class="rec-drill">' +
      '<div class="rec-drill-head"><span>随机抽背</span><b>' + (drill.index + 1) + ' / ' + drill.ids.length + '</b></div>' +
      '<div class="rec-drill-card">' +
        '<span class="rec-quote-theme">' + themeLabel(q.theme) + '</span>' +
        '<p class="rec-quote-text">' + (drill.revealed ? '“' + esc(q.text) + '”' : '………………') + '</p>' +
        (drill.revealed
          ? '<div class="rec-drill-rate">' +
              '<button type="button" class="rec-btn rec-btn-primary" data-drill-rate="mastered">记住了</button>' +
              '<button type="button" class="rec-btn rec-btn-secondary" data-drill-rate="weak">没记住</button>' +
            '</div>'
          : '<button type="button" class="rec-btn rec-btn-secondary" data-drill-show>显示答案</button>') +
      '</div>' +
    '</section>';
  }

  function doneButton(day) {
    var done = state.done.indexOf(day) !== -1;
    return '<div class="rec-footer-actions">' + (done ? '<div class="rec-complete-stamp" role="status">本日已完成</div>' : '') + '<button type="button" class="rec-btn rec-btn-primary rec-done" data-done-day>' +
      (done ? '已完成本日训练' : '完成今日训练') + '</button></div>';
  }

  function onClick(e) {
    var el = e.target.closest('[data-rec-tab],[data-day],[data-mode],[data-audio-toggle],[data-seg-status],[data-reveal-cloze],[data-recall-toggle],[data-done-day],[data-quote-status],[data-quote-theme],[data-quote-tag],[data-quote-status-filter],[data-drill-start],[data-drill-show],[data-drill-rate],[data-mock-submit],[data-mock-rate],[data-mock-retry],[data-practice-weak],[data-reset-rec],[data-goto-today]');
    if (!el) return;
    var tag = el.tagName.toLowerCase();
    if (tag === 'button' && el.disabled) return;

    if (el.dataset.recTab) {
      activeTab = el.dataset.recTab;
      if (activeTab === 'quotes' && drill) drill = null;
      render();
      return;
    }
    if (el.dataset.day !== undefined) {
      state.day = Number(el.dataset.day);
      save();
      render();
      return;
    }
    if (el.dataset.mode) {
      mode = el.dataset.mode;
      render();
      return;
    }
    if (el.dataset.audioToggle !== undefined) {
      var audioBox = el.closest('[data-rec-audio]');
      if (window.speechSynthesis && audioBox) {
        if (audioBox.classList.contains('is-playing')) {
          window.speechSynthesis.cancel();
          audioBox.classList.remove('is-playing');
          el.setAttribute('aria-pressed', 'false');
          el.querySelector('span').textContent = '▶';
        } else {
          var segNow = SEGMENTS[state.day];
          var utter = new SpeechSynthesisUtterance(segNow ? segNow.text.join(' ') : '');
          utter.lang = 'zh-CN'; utter.rate = .92;
          audioBox.classList.add('is-playing');
          el.setAttribute('aria-pressed', 'true');
          el.querySelector('span').textContent = '■';
          utter.onend = function () { audioBox.classList.remove('is-playing'); el.setAttribute('aria-pressed', 'false'); el.querySelector('span').textContent = '▶'; };
          window.speechSynthesis.cancel(); window.speechSynthesis.speak(utter);
        }
      } else { toast('当前浏览器不支持朗读'); }
      return;
    }
    if (el.dataset.segStatus) {
      var parts = el.dataset.segStatus.split('|');
      state.segments[parts[0]] = state.segments[parts[0]] === parts[1] ? '' : parts[1];
      save();
      render();
      return;
    }
    if (el.dataset.revealCloze !== undefined) {
      clozeOpen = !clozeOpen;
      render();
      return;
    }
    if (el.dataset.recallToggle !== undefined) {
      var item = el.closest('.rec-recall-item, .rec-chain-card');
      if (item) {
        item.classList.toggle('open');
        el.textContent = item.classList.contains('open') ? '收起原文' : '展开核对';
      }
      return;
    }
    if (el.dataset.doneDay !== undefined) {
      completeDay(state.day);
      return;
    }
    if (el.dataset.quoteStatus) {
      var qp = el.dataset.quoteStatus.split('|');
      state.quotes[qp[0]] = state.quotes[qp[0]] === qp[1] ? '' : qp[1];
      save();
      render();
      return;
    }
    if (el.dataset.quoteTheme) { quoteTheme = el.dataset.quoteTheme; render(); return; }
    if (el.dataset.quoteTag) { quoteTag = el.dataset.quoteTag; render(); return; }
    if (el.dataset.quoteStatusFilter) { quoteStatus = el.dataset.quoteStatusFilter; render(); return; }
    if (el.dataset.drillStart !== undefined) {
      drill = { ids: shuffle(QUOTES).slice(0, 5).map(function (q) { return q.id; }), index: 0, revealed: false };
      render();
      return;
    }
    if (el.dataset.drillShow !== undefined) {
      drill.revealed = true;
      render();
      return;
    }
    if (el.dataset.drillRate) {
      var qid = drill.ids[drill.index];
      state.quotes[qid] = el.dataset.drillRate;
      drill.index++;
      drill.revealed = false;
      if (drill.index >= drill.ids.length) {
        drill = null;
        toast('本轮抽背完成');
      }
      save();
      render();
      return;
    }
    if (el.dataset.mockSubmit) {
      var id = el.dataset.mockSubmit;
      var a = state.mock.current[id] || {};
      if (!a.theme) { toast('先选择最适用主题'); return; }
      a.submitted = true;
      state.mock.current[id] = a;
      save();
      render();
      return;
    }
    if (el.dataset.mockRate) {
      var rp = el.dataset.mockRate.split('|');
      var a2 = state.mock.current[rp[0]];
      if (!a2 || !a2.submitted) return;
      a2.rated = true;
      a2.rating = rp[1];
      save();
      if (MOCK.every(function (q) { return state.mock.current[q.id] && state.mock.current[q.id].rated; })) {
        saveMockResult(computeResult());
      }
      render();
      return;
    }
    if (el.dataset.mockRetry !== undefined) {
      state.mock.current = {};
      save();
      render();
      return;
    }
    if (el.dataset.practiceWeak !== undefined) {
      var weak = computeResult().weakThemes;
      activeTab = 'quotes';
      quoteTheme = weak.length ? weak[0] : 'all';
      quoteTag = 'all';
      quoteStatus = 'weak';
      render();
      return;
    }
    if (el.dataset.gotoToday !== undefined) {
      state.day = todayIndex();
      save();
      render();
      return;
    }
    if (el.dataset.resetRec !== undefined) {
      if (confirm('确定清除本机“五四讲话背诵”进度和模考成绩吗？')) {
        state = defaultState();
        state.startDate = getTodayStr();
        activeTab = 'plan';
        mode = 'full';
        clozeOpen = false;
        quoteTheme = 'all';
        quoteTag = 'all';
        quoteStatus = 'all';
        drill = null;
        save();
        render();
      }
    }
  }

  function onChange(e) {
    var el = e.target;
    if (el.dataset.mockTheme) {
      var id = el.dataset.mockTheme;
      var a = state.mock.current[id] || {};
      if (a.rated) return;
      a.theme = el.value;
      state.mock.current[id] = a;
      save();
    }
    if (el.dataset.mockRecall) {
      var rid = el.dataset.mockRecall;
      var r = state.mock.current[rid] || {};
      if (r.rated) return;
      r.recall = el.value;
      state.mock.current[rid] = r;
      save();
    }
  }

  function completeDay(day) {
    var dayNumber = day + 1;
    if (state.done.indexOf(day) === -1) {
      state.done.push(day);
      if (window.PortalPlan && window.PortalPlan.markRecitationDayDone) {
        try { window.PortalPlan.markRecitationDayDone(dayNumber); } catch (err) {}
      }
    }
    state.day = Math.min(6, day + 1);
    save();
    render();
    toast('第 ' + dayNumber + ' 天训练完成');
  }

  window.RecitationApp = {
    refresh: render,
    reset: function () {
      state = defaultState();
      state.startDate = getTodayStr();
      save();
      render();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
