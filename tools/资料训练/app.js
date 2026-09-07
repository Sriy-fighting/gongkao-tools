(() => {
  'use strict';

  const STORE = 'sl-math-journey-question-bank-v1';
  const LOCAL_STAMP = `gk-sync-stamp:${STORE}`;
  const MODES = { std: '标准乘法', pct: '百化分', rev: '逆向因数' };
  const KEYS = ['A', 'B', 'C', 'D'];
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const makeId = () => `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const numericValue = (value) => {
    const normalized = String(value ?? '').trim().replace(/[%，,\s]/g, '');
    const result = Number.parseFloat(normalized);
    return Number.isFinite(result) ? result : null;
  };
  const answerKey = (value) => {
    const raw = String(value ?? '').trim().replace(/\s+/g, ' ');
    const numeric = numericValue(raw);
    return numeric === null ? `text:${raw.toLowerCase()}` : `number:${numeric}`;
  };
  const shuffle = (items) => {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  };

  const pctRows = [
    ['1/2', '50'], ['1/2.5', '40'], ['1/3', '33.3'], ['1/3.5', '28.6'], ['1/4', '25'],
    ['1/4.5', '22.2'], ['1/5', '20'], ['1/5.5', '18'], ['1/6', '16.7'], ['1/6.5', '15.3'],
    ['1/7', '14.3'], ['1/7.5', '13.3'], ['1/8', '12.5'], ['1/8.5', '11.7'], ['1/9', '11.1'],
    ['1/9.5', '10.5'], ['1/10', '10'], ['1/10.5', '9.5'], ['1/11', '9.1'], ['1/11.5', '8.7'],
    ['1/12', '8.3'], ['1/12.5', '8'], ['1/13', '7.7'], ['1/13.5', '7.4'], ['1/14', '7.1'],
    ['1/14.5', '6.9'], ['1/15', '6.7'], ['1/15.5', '6.5'], ['1/16', '6.3'], ['1/16.5', '6.1'],
    ['1/17', '5.9'], ['1/17.5', '5.7'], ['1/18', '5.6'], ['1/18.5', '5.4'], ['1/19', '5.3'],
    ['1/19.5', '5.1'], ['1/20', '5'], ['1/21', '4.8'], ['1/22', '4.5'], ['1/23', '4.3']
  ];

  function defaultQuestions() {
    const result = [];
    for (let number = 12; number <= 19; number += 1) {
      for (let multiplier = 2; multiplier <= 9; multiplier += 1) {
        result.push({ id: `std-${number}-${multiplier}`, type: 'std', group: String(number), prompt: `${number} × ${multiplier} = ?`, answer: String(number * multiplier), distractors: [] });
      }
    }
    pctRows.forEach(([prompt, answer], index) => result.push({ id: `pct-${index}`, type: 'pct', group: '', prompt: `${prompt} 约等于多少？`, answer: `${answer}%`, distractors: [] }));
    [['36', '12 × 3'], ['48', '12 × 4'], ['60', '12 × 5'], ['72', '12 × 6'], ['84', '12 × 7'], ['90', '15 × 6'], ['96', '12 × 8'], ['108', '12 × 9'], ['126', '14 × 9'], ['144', '16 × 9']].forEach(([prompt, answer], index) => result.push({ id: `rev-${index}`, type: 'rev', group: '', prompt: `${prompt} = ?`, answer, distractors: [] }));
    return result;
  }

  function normalizeQuestion(question) {
    if (!question || question.prompt == null || question.answer == null) return null;
    const type = MODES[question.type] ? question.type : 'std';
    let group = question.group == null ? '' : String(question.group);
    if (!group && type === 'std') {
      const match = String(question.prompt).match(/^\s*(\d+)/);
      group = match ? match[1] : '';
    }
    return {
      id: String(question.id || makeId()), type, group,
      prompt: String(question.prompt).trim(), answer: String(question.answer).trim(),
      distractors: Array.isArray(question.distractors) ? question.distractors.map(String).map((value) => value.trim()).filter(Boolean) : []
    };
  }

  let mode = 'std';
  let bank = [];
  let deck = [];
  let current = null;
  let locked = false;
  let timerId = null;
  let seconds = 2;
  let selectedNumbers = [12, 13, 14, 15, 16, 17, 18, 19];
  let hadLocalSnapshot = false;

  function toast(message) {
    const target = $('#toast');
    if (!target) return;
    target.textContent = message;
    target.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => target.classList.remove('show'), 2200);
  }

  function persist() {
    try {
      localStorage.setItem(STORE, JSON.stringify(bank));
      if (window.SyncStore && window.SyncStore.writeData) window.SyncStore.writeData(STORE, bank);
    } catch (_) { toast('题库保存失败，请检查浏览器存储空间'); }
  }

  function getLocalUpdatedAt() {
    try { return Date.parse(localStorage.getItem(LOCAL_STAMP) || '') || 0; } catch (_) { return 0; }
  }

  function setLocalUpdatedAt(value) {
    const timestamp = Date.parse(value || '') || Date.now();
    try { localStorage.setItem(LOCAL_STAMP, new Date(timestamp).toISOString()); } catch (_) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      hadLocalSnapshot = raw !== null;
      if (raw === null) {
        bank = defaultQuestions();
        persist();
        return;
      }
      const parsed = JSON.parse(raw);
      bank = Array.isArray(parsed) ? parsed.map(normalizeQuestion).filter(Boolean) : [];
    } catch (_) { bank = []; }
  }

  function syncCloud() {
    if (!window.SyncStore || !window.SyncStore.readData || !window.SyncStore.isConfigured()) return;
    window.SyncStore.readData(STORE, (cloud, meta) => {
      if (!meta || meta.source !== 'cloud' || !meta.exists || !Array.isArray(cloud)) return;
      const incoming = cloud.map(normalizeQuestion).filter(Boolean);
      const localAt = getLocalUpdatedAt();
      const cloudAt = Date.parse(meta.updatedAt || '') || 0;
      if (!hadLocalSnapshot) {
        bank = incoming;
        localStorage.setItem(STORE, JSON.stringify(bank));
        setLocalUpdatedAt(meta.updatedAt);
        renderSetup();
        return;
      }
      if (cloudAt > 0 && cloudAt > localAt) {
        bank = incoming;
        localStorage.setItem(STORE, JSON.stringify(bank));
        setLocalUpdatedAt(meta.updatedAt);
        renderSetup();
        return;
      }
      // An explicit empty bank is valid. Keep local data when the cloud snapshot
      // is older, equal, or has no trustworthy timestamp.
      persist();
    });
  }

  function available() {
    return bank.filter((question) => question.type === mode && (mode !== 'std' || !question.group || selectedNumbers.includes(Number(question.group))));
  }

  function renderNumbers() {
    const host = $('#num-grid');
    if (!host) return;
    host.innerHTML = '';
    for (let number = 12; number <= 19; number += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `num-chip${selectedNumbers.includes(number) ? ' active' : ''}`;
      button.textContent = number;
      button.onclick = () => {
        selectedNumbers = selectedNumbers.includes(number) ? selectedNumbers.filter((item) => item !== number) : [...selectedNumbers, number];
        renderNumbers();
        renderSetup();
      };
      host.append(button);
    }
  }

  function renderSetup() {
    const count = available().length;
    $('#bank-total').textContent = count;
    $('#start-btn').disabled = count === 0;
    $('#start-btn').style.opacity = count ? '1' : '.55';
    const requested = Math.max(1, Number($('#question-count').value) || 20);
    const progress = Math.min(100, Math.round(count / requested * 100));
    $('#speed-progress-value').textContent = `${progress}%`;
    $('#speed-progress-overview').style.setProperty('--speed-progress', `${progress}%`);
  }

  function makeChoices(question) {
    const values = [];
    const used = new Set();
    const add = (value) => {
      const text = String(value ?? '').trim();
      const key = answerKey(text);
      if (!text || used.has(key)) return false;
      used.add(key); values.push(text); return true;
    };
    add(question.answer);
    question.distractors.forEach(add);
    const source = shuffle(bank.filter((item) => item.id !== question.id && item.type === question.type).map((item) => item.answer));
    const correct = numericValue(question.answer);
    source.sort((a, b) => {
      if (correct === null) return 0;
      return Math.abs(numericValue(b) - correct) - Math.abs(numericValue(a) - correct);
    }).forEach((value) => { if (values.length < 4) add(value); });
    if (values.length < 4 && correct !== null) {
      shuffle([0.45, 0.7, 1.35, 1.65, 1.9, 2.2, 0.3, 2.8]).forEach((factor) => {
        if (values.length >= 4) return;
        const suffix = /%/.test(question.answer) ? '%' : '';
        add(`${Number((correct * factor).toFixed(1))}${suffix}`);
      });
    }
    let fallback = 1;
    while (values.length < 4) add(`${question.answer}（选项${fallback++}）`);
    return shuffle(values.slice(0, 4));
  }

  function start() {
    const pool = available();
    if (!pool.length) { toast('当前模式没有可用题目，请先添加或恢复题库'); return; }
    const count = Math.max(1, Math.min(120, Number($('#question-count').value) || 20));
    seconds = Math.max(.5, Math.min(60, Number($('#limit-input').value) || 2));
    deck = shuffle(pool).slice(0, Math.min(count, pool.length));
    $('#setup-view').hidden = true;
    $('#play-view').hidden = false;
    $('#play-mode-label').textContent = MODES[mode];
    next();
  }

  function renderQuestion() {
    if (!deck.length) {
      clearInterval(timerId);
      $('#play-view').innerHTML = '<div class="speed-config" style="text-align:center"><p class="panel-eyebrow">本轮完成</p><h1>训练已完成</h1><p class="setup-hint">本轮题目已全部完成，可以继续下一轮。</p><button class="btn-start" id="again" type="button">再来一轮</button></div>';
      $('#again').onclick = () => location.reload();
      return;
    }
    locked = false;
    current = deck[0];
    $('#count-num').textContent = deck.length;
    $('#q-text').textContent = current.prompt;
    const host = $('#choice-grid');
    host.innerHTML = '';
    makeChoices(current).forEach((value, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      button.dataset.value = value;
      button.innerHTML = `<span class="choice-key">${KEYS[index]}</span><span>${esc(value)}</span>`;
      button.onclick = () => check(value, button);
      host.append(button);
    });
    $('#feedback').textContent = '';
    $('#feedback').className = 'feedback';
    startTimer();
  }

  function next() { renderQuestion(); }

  function startTimer() {
    clearInterval(timerId);
    const bar = $('#timer-bar');
    const deadline = performance.now() + seconds * 1000;
    bar.style.width = '100%';
    bar.classList.remove('danger');
    timerId = setInterval(() => {
      const left = deadline - performance.now();
      const percentage = Math.max(0, left / (seconds * 1000) * 100);
      bar.style.width = `${percentage}%`;
      if (percentage < 20) bar.classList.add('danger');
      if (left <= 0) { clearInterval(timerId); if (!locked) wrong(null, '时间到'); }
    }, 40);
  }

  function check(value, button) {
    if (locked) return;
    locked = true;
    clearInterval(timerId);
    const correct = answerKey(value) === answerKey(current.answer);
    document.querySelectorAll('.choice').forEach((item) => {
      item.disabled = true;
      if (answerKey(item.dataset.value) === answerKey(current.answer)) item.classList.add('correct');
    });
    if (correct) {
      button.classList.add('correct');
      $('#feedback').textContent = '答对了';
      $('#feedback').className = 'feedback ok';
      deck.shift();
      setTimeout(next, 520);
    } else wrong(button, `答案是 ${current.answer}`);
  }

  function wrong(button, message) {
    locked = true;
    clearInterval(timerId);
    if (button) button.classList.add('wrong');
    document.querySelectorAll('.choice').forEach((item) => { item.disabled = true; if (answerKey(item.dataset.value) === answerKey(current.answer)) item.classList.add('correct'); });
    $('#feedback').textContent = `答错了，${message}`;
    $('#feedback').className = 'feedback bad';
    $('#play-view').classList.add('shake');
    deck.push(deck.shift());
    setTimeout(() => { $('#play-view').classList.remove('shake'); next(); }, 1000);
  }

  function reset() { clearInterval(timerId); location.reload(); }
  function openBank() { renderBank(); $('#bank-modal').classList.add('open'); $('#close-bank').focus(); }
  function closeBank() { $('#bank-modal').classList.remove('open'); }

  function renderBank() {
    const filter = $('#bank-filter').value;
    const query = $('#bank-search').value.trim().toLowerCase();
    const rows = bank.filter((item) => (filter === 'all' || item.type === filter) && (!query || `${item.prompt} ${item.answer}`.toLowerCase().includes(query)));
    $('#bank-count').textContent = `${rows.length} / ${bank.length} 道`;
    const host = $('#bank-list');
    host.innerHTML = '';
    if (!rows.length) { host.innerHTML = '<div class="bank-empty">暂无题目。点击“添加题目”创建第一道题。</div>'; return; }
    rows.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'bank-row'; row.dataset.id = item.id; row.dataset.type = item.type;
      row.innerHTML = `<span class="bank-type-badge">${MODES[item.type]}</span><select aria-label="题型"><option value="std">标准乘法</option><option value="pct">百化分</option><option value="rev">逆向因数</option></select><input aria-label="题干" value="${esc(item.prompt)}"><input aria-label="正确答案" value="${esc(item.answer)}"><input aria-label="干扰项" value="${esc(item.distractors.join('|'))}" placeholder="自动生成"><div class="row-actions"><button class="bank-btn" data-save type="button" title="保存" aria-label="保存">✓</button><button class="bank-btn" data-delete type="button" title="删除" aria-label="删除">×</button></div>`;
      const [type, prompt, answer, distractors] = row.querySelectorAll('select,input');
      type.value = item.type;
      row.querySelector('[data-save]').onclick = () => {
        const next = normalizeQuestion({ ...item, type: type.value, prompt: prompt.value, answer: answer.value, distractors: distractors.value.split('|') });
        if (!next) { toast('题干和正确答案不能为空'); return; }
        Object.assign(item, next); persist(); renderBank(); renderSetup(); toast('题目已保存');
      };
      row.querySelector('[data-delete]').onclick = () => {
        if (!confirm(`删除“${item.prompt}”？`)) return;
        bank = bank.filter((question) => question.id !== item.id); persist(); renderBank(); renderSetup(); toast('题目已删除');
      };
      host.append(row);
    });
  }

  function addQuestion() {
    bank.unshift({ id: makeId(), type: 'std', group: '', prompt: '新题目', answer: '0', distractors: [] });
    persist(); $('#bank-filter').value = 'all'; $('#bank-search').value = ''; renderBank(); renderSetup();
    setTimeout(() => $('#bank-list .bank-row input[aria-label="题干"]')?.focus(), 0);
  }

  function exportBank() {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(bank, null, 2)], { type: 'application/json' }));
    link.download = `math-question-bank-${new Date().toISOString().slice(0, 10)}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast('题库已导出');
  }

  function importBank(file) {
    file.text().then((text) => {
      const incoming = JSON.parse(text);
      const rows = Array.isArray(incoming) ? incoming : incoming.questions;
      if (!Array.isArray(rows)) throw new Error('格式不正确');
      const normalized = rows.map(normalizeQuestion).filter(Boolean);
      if (!normalized.length) throw new Error('没有可导入的题目');
      bank = normalized; persist(); renderBank(); renderSetup(); toast(`已导入 ${normalized.length} 道题`);
    }).catch((error) => toast(`导入失败：${error.message}`));
  }

  function bind() {
    $('#mode-grid').querySelectorAll('[data-mode]').forEach((button) => button.onclick = () => {
      mode = button.dataset.mode;
      $('#mode-grid').querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
      $('#num-selector').hidden = mode !== 'std'; renderSetup();
    });
    $('#start-btn').onclick = start;
    $('#quit-btn').onclick = reset;
    $('#open-bank').onclick = openBank;
    $('#close-bank').onclick = closeBank;
    $('#bank-modal').onclick = (event) => { if (event.target === event.currentTarget) closeBank(); };
    $('#add-question').onclick = addQuestion;
    $('#export-bank').onclick = exportBank;
    $('#import-bank').onclick = () => $('#bank-file').click();
    $('#bank-file').onchange = (event) => { if (event.target.files[0]) importBank(event.target.files[0]); event.target.value = ''; };
    $('#bank-filter').onchange = renderBank;
    $('#bank-search').oninput = renderBank;
    $('#restore-bank').onclick = () => { if (confirm('恢复内置题库会覆盖当前题库，确定吗？')) { bank = defaultQuestions(); persist(); renderBank(); renderSetup(); toast('已恢复内置题库'); } };
    document.addEventListener('keydown', (event) => {
      if ($('#bank-modal').classList.contains('open') && event.key === 'Escape') closeBank();
      if (!$('#play-view').hidden && !locked) { const index = KEYS.indexOf(event.key.toUpperCase()); if (index >= 0) document.querySelectorAll('.choice')[index]?.click(); }
    });
  }

  function init() { load(); bind(); renderNumbers(); renderSetup(); syncCloud(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
