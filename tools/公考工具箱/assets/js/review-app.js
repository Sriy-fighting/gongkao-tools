(() => {
  "use strict";

  const reviewRoot = document.getElementById("review-view");
  if (!reviewRoot) return;
  const STORAGE_KEY = "gk-review-library-v1";
  const seed = window.REVIEW_SEED || { version: 1, libraryName: "复盘资料库", questions: [] };
  const $ = (id) => reviewRoot.querySelector("#" + id);
  const els = {
    sidebar: $("reviewSidebar"),
    backdrop: $("backdrop"),
    list: $("questionList"),
    question: $("questionPane"),
    review: $("reviewPane"),
    season: $("seasonFilter"),
    subject: $("subjectFilter"),
    mastery: $("masteryFilter"),
    status: $("statusFilter"),
    search: $("searchInput"),
    editDialog: $("editDialog"),
    importDialog: $("importDialog"),
    sourceDialog: $("sourceDialog"),
    sourceFrame: $("sourceFrame"),
    sourceImage: $("sourceImage"),
    toast: $("toast")
  };
  const state = {
    data: loadData(),
    filtered: [],
    currentId: null,
    revealed: new Set(),
    selected: {},
    quick: null,
    toastTimer: null,
    pendingImport: null,
    undoSnapshot: null,
    sourceRef: null,
    sourceCropped: true,
    initialHashApplied: false,
    storageError: false
  };

  function normalizeQuestion(q) {
    const legacyReview = q.reviewState || {};
    const legacyStep = Math.min(Number(legacyReview.step) || 0, 2);
    const sourceRefs = Array.isArray(q.sourceRefs) ? q.sourceRefs.map((ref) => ({
      ...ref,
      asset: normalizeAssetPath(ref.asset)
    })) : [];
    return {
      id: String(q.id || ((q.season || "未分类") + "-" + (q.subject || "常识") + "-" + (q.number ?? "?"))),
      season: q.season || "未分类季度",
      subject: q.subject || "常识",
      number: q.number ?? "?",
      stem: q.stem || "（题干待补充）",
      options: Array.isArray(q.options) ? q.options : [],
      answer: q.answer || "",
      answerStatus: q.answerStatus || "pending",
      review: { summary: "", analysis: "", pitfalls: [], memoryCue: "", ...(q.review || {}) },
      tags: Array.isArray(q.tags) ? q.tags : [],
      difficulty: q.difficulty || "medium",
      match: { status: "pending", confidence: 0, evidence: [], ...(q.match || {}) },
      sourceRefs,
      mastery: q.mastery || "new",
      reviewState: {
        step: 0,
        nextReviewAt: null,
        history: [],
        ...legacyReview,
        steps: { again: 0, fuzzy: legacyStep, know: legacyStep, ...(legacyReview.steps || {}) }
      },
      note: q.note || ""
    };
  }

  function normalizeAssetPath(value) {
    const raw = String(value || "").replaceAll("\\", "/");
    const normalized = raw.startsWith("assets/sources/") ? "reviews/" + raw : raw;
    const safeLocalAsset = /^reviews\/assets\/sources\/(?!.*(?:\.\.|:))[^/?#\\]+\.(?:jpg|jpeg|png|webp)$/i;
    return safeLocalAsset.test(normalized) ? normalized : "";
  }

  function mergeQuestions(base, incoming, preserveProgress = true) {
    const map = new Map(base.map((q) => [q.id, normalizeQuestion(q)]));
    incoming.forEach((item) => {
      const next = normalizeQuestion(item);
      const old = map.get(next.id);
      if (old && preserveProgress) {
        next.mastery = old.mastery;
        next.reviewState = old.reviewState;
        next.note = old.note || next.note;
      }
      map.set(next.id, next);
    });
    return [...map.values()];
  }

  function loadData() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && Array.isArray(stored.questions)) {
        return { ...stored, dirty: Boolean(stored.dirty), questions: mergeQuestions(seed.questions || [], stored.questions, false) };
      }
    } catch (error) {
      console.warn("Local data could not be read", error);
    }
    return { ...seed, questions: (seed.questions || []).map(normalizeQuestion) };
  }

  function syncCloudData() {
    if (!window.SyncStore || !window.SyncStore.readData) return;
    const localData = state.data;
    window.SyncStore.readData(STORAGE_KEY, (cloudData) => {
      if (!cloudData || !Array.isArray(cloudData.questions)) return;
      const localUpdated = Date.parse(localData.updatedAt || "") || 0;
      const cloudUpdated = Date.parse(cloudData.updatedAt || "") || 0;
      if (localUpdated && localUpdated >= cloudUpdated) {
        if (window.SyncStore.writeData) window.SyncStore.writeData(STORAGE_KEY, localData);
        return;
      }
      state.data = {
        ...cloudData,
        questions: mergeQuestions(seed.questions || [], cloudData.questions, false)
      };
      renderAll(true);
    });
  }

  function saveData() {
    state.data.updatedAt = new Date().toISOString();
    state.data.dirty = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
      if (window.SyncStore && window.SyncStore.writeData) window.SyncStore.writeData(STORAGE_KEY, state.data);
      state.storageError = false;
      renderBackupStatus();
    } catch (error) {
      state.storageError = true;
      toast("本地保存失败，请立即导出 JSON 备份");
      renderBackupStatus();
    }
  }

  function markBackupComplete() {
    const now = new Date().toISOString();
    state.data.exportedAt = now;
    state.data.backupAt = now;
    state.data.updatedAt = now;
    state.data.dirty = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
      if (window.SyncStore && window.SyncStore.writeData) window.SyncStore.writeData(STORAGE_KEY, state.data);
      state.storageError = false;
    } catch (error) {
      state.storageError = true;
      toast("备份已生成，但本地状态保存失败");
    }
    renderBackupStatus();
  }

  function formatBackupDate(value) {
    if (!value) return "尚未备份";
    return "上次备份 " + new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  }

  function renderBackupStatus() {
    const target = $("backupStatus");
    if (!target) return;
    target.className = "backup-status" + (state.data.dirty || state.storageError ? " dirty" : " clean");
    target.textContent = state.storageError ? "本地保存失败" : state.data.dirty ? "有未备份修改" : formatBackupDate(state.data.backupAt);
    target.title = state.storageError ? "请立即导出 JSON 备份" : state.data.dirty ? "修改已保存在本机，建议导出备份" : formatBackupDate(state.data.backupAt);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
  }

  function isDue(q) {
    return Boolean(q.reviewState.nextReviewAt) && new Date(q.reviewState.nextReviewAt) <= new Date();
  }

  function isNew(q) {
    return q.mastery === "new" && !q.reviewState.nextReviewAt;
  }

  function statusLabel(status) {
    return ({ verified: "已确认", pending: "待核验", unmatched: "未匹配" })[status] || "待核验";
  }

  function masteryLabel(value) {
    return ({ new: "未复习", again: "不会", fuzzy: "模糊", know: "会" })[value] || "未复习";
  }

  function answerStatusLabel(value) {
    return ({ verified: "答案已确认", inferred: "答案由知识点推断", pending: "答案待核验" })[value] || "答案待核验";
  }

  function quickLabel(value) {
    return ({ due: "今日到期", new: "待开始", pending: "待核验", weak: "薄弱题", done: "已复习" })[value] || "快速筛选";
  }

  function formatDate(value) {
    if (!value) return "尚未安排";
    const date = new Date(value);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "今天重做";
    return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(date);
  }

  function currentQuestion() {
    return state.data.questions.find((q) => q.id === state.currentId);
  }

  function filterQuestions() {
    const query = els.search.value.trim().toLowerCase();
    state.filtered = state.data.questions.filter((q) => {
      const haystack = [q.stem, q.subject, q.season, ...(q.tags || []), q.review.summary, q.review.analysis].join(" ").toLowerCase();
      const quickMatch = !state.quick ||
        (state.quick === "due" && isDue(q)) ||
        (state.quick === "new" && isNew(q)) ||
        (state.quick === "pending" && (q.match.status !== "verified" || q.answerStatus !== "verified")) ||
        (state.quick === "weak" && ["again", "fuzzy"].includes(q.mastery)) ||
        (state.quick === "done" && q.mastery !== "new");
      return (!query || haystack.includes(query)) &&
        (els.season.value === "all" || q.season === els.season.value) &&
        (els.subject.value === "all" || q.subject === els.subject.value) &&
        (els.mastery.value === "all" || q.mastery === els.mastery.value) &&
        (els.status.value === "all" ||
          (els.status.value === "due" ? isDue(q) :
            els.status.value === "pending" ? (q.match.status !== "verified" || q.answerStatus !== "verified") :
              q.match.status === els.status.value)) &&
        quickMatch;
    }).sort((a, b) => a.season.localeCompare(b.season, "zh-CN") || Number(a.number) - Number(b.number));
    if (!state.filtered.some((q) => q.id === state.currentId)) state.currentId = state.filtered[0]?.id || null;
  }

  function populateSeasons() {
    const current = els.season.value || "all";
    const seasons = [...new Set(state.data.questions.map((q) => q.season))].sort((a, b) => b.localeCompare(a, "zh-CN"));
    els.season.innerHTML = '<option value="all">全部季度</option>' + seasons.map((value) =>
      '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + "</option>"
    ).join("");
    els.season.value = seasons.includes(current) ? current : "all";
  }

  function renderStats() {
    const all = state.data.questions;
    const done = all.filter((q) => q.mastery !== "new").length;
    $("dueCount").textContent = all.filter(isDue).length;
    $("newCount").textContent = all.filter(isNew).length;
    $("pendingCount").textContent = all.filter((q) => q.match.status !== "verified" || q.answerStatus !== "verified").length;
    $("weakCount").textContent = all.filter((q) => q.mastery === "again" || q.mastery === "fuzzy").length;
    $("doneCount").textContent = done;
    const progress = all.length ? Math.round(done / all.length * 100) : 0;
    $("progressText").textContent = "资料库已复习 " + progress + "%";
    $("progressFill").style.width = progress + "%";
    const syncLabel = window.SyncStore && window.SyncStore.isConfigured && window.SyncStore.isConfigured() ? "本地 + 账号同步" : "仅保存在本机";
    $("libraryMeta").textContent = all.length + " 道题 · " + new Set(all.map((q) => q.season)).size + " 个季度 · " + syncLabel;
    renderInsights(all);
    renderBackupStatus();
  }

  function historyOf(q) {
    return Array.isArray(q.reviewState.history) ? q.reviewState.history : [];
  }

  function renderInsights(all) {
    const attempts = all.flatMap((q) => historyOf(q).filter((item) => item.kind === "answer").map((item) => ({ ...item, q })));
    const scored = attempts.filter((item) => item.answerStatus === "verified" && typeof item.correct === "boolean");
    $("insightsMeta").textContent = scored.length ? `已完成 ${scored.length} 次有效作答 · 正确率 ${Math.round(scored.filter((item) => item.correct).length / scored.length * 100)}%` : "完成作答后会在这里形成统计";
    const bySubject = ["政治理论", "常识"].map((subject) => {
      const rows = scored.filter((item) => item.q.subject === subject);
      const accuracy = rows.length ? Math.round(rows.filter((item) => item.correct).length / rows.length * 100) : null;
      return `<div class="insight-row"><span>${escapeHtml(subject)}</span><strong>${accuracy === null ? "—" : accuracy + "%"}</strong><small>${rows.length} 次作答</small></div>`;
    }).join("");
    $("subjectStats").innerHTML = `<h3>科目正确率</h3>${bySubject}`;
    const mistakes = new Map();
    attempts.filter((item) => item.answerStatus === "verified" && item.correct === false).forEach((item) => (item.q.tags || []).forEach((tag) => mistakes.set(tag, (mistakes.get(tag) || 0) + 1)));
    const topMistakes = [...mistakes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    $("tagStats").innerHTML = `<h3>高频错题知识点</h3>${topMistakes.length ? topMistakes.map(([tag, count]) => `<div class="insight-row"><span># ${escapeHtml(tag)}</span><strong>${count} 次</strong></div>`).join("") : '<p class="hint">暂时还没有可统计的错题知识点。</p>'}`;
  }

  function renderList() {
    $("resultCount").textContent = state.filtered.length + " 道题" + (state.quick ? " · " + quickLabel(state.quick) : "");
    if (!state.filtered.length) {
      els.list.innerHTML = '<li class="empty-list">没有符合条件的题目<br>试试清除筛选</li>';
      return;
    }
    els.list.innerHTML = state.filtered.map((q) =>
      '<li><button data-id="' + escapeHtml(q.id) + '" class="' + (q.id === state.currentId ? "active" : "") + '" aria-current="' + (q.id === state.currentId ? "true" : "false") + '">' +
        '<span class="q-index">' + escapeHtml(q.number) + "</span>" +
        '<span class="q-list-copy"><b>' + escapeHtml(q.subject) + " · " + escapeHtml(masteryLabel(q.mastery)) + "</b><span>" + escapeHtml(q.stem) + "</span></span>" +
        '<span class="status-dot ' + (q.match.status !== "verified" || q.answerStatus !== "verified" ? "pending" : q.mastery === "know" ? "know" : "") + '" aria-label="' + escapeHtml(statusLabel(q.match.status) + "，" + answerStatusLabel(q.answerStatus)) + '"></span>' +
      "</button></li>"
    ).join("");
  }

  function renderQuestion(q) {
    if (!q) {
      $("crumbText").textContent = "没有符合条件的题目";
      els.question.innerHTML = '<div class="empty-list">请调整筛选条件或导入资料。</div>';
      els.review.innerHTML = "";
      return;
    }
    const revealed = state.revealed.has(q.id);
    const selected = state.selected[q.id];
    $("crumbText").textContent = q.season + " / " + q.subject + " / 第 " + q.number + " 题";
    const options = q.options.map((opt) => {
      let className = "option" + (selected === opt.key ? " selected" : "");
      if (revealed && q.answerStatus === "verified" && opt.key === q.answer) className += " correct";
      else if (revealed && q.answerStatus === "verified" && selected === opt.key && selected !== q.answer) className += " wrong";
      const tabIndex = selected ? (selected === opt.key ? 0 : -1) : (opt.key === q.options[0]?.key ? 0 : -1);
      return '<button class="' + className + '" data-option="' + escapeHtml(opt.key) + '" role="radio" aria-checked="' + (selected === opt.key) + '" tabindex="' + tabIndex + '" aria-label="选项 ' + escapeHtml(opt.key) + '：' + escapeHtml(opt.text) + '">' +
        '<span class="option-key">' + escapeHtml(opt.key) + "</span><span>" + escapeHtml(opt.text) + "</span></button>";
    }).join("");
    els.question.innerHTML =
      '<div class="pane-label"><span>QUESTION ' + escapeHtml(q.number) + '</span><span class="badges">' +
        '<span class="badge ' + escapeHtml(q.match.status) + '">' + escapeHtml(statusLabel(q.match.status)) + "</span>" +
        '<span class="badge ' + (q.answerStatus === "verified" ? "verified" : "pending") + '">' + escapeHtml(answerStatusLabel(q.answerStatus)) + "</span>" +
        '<span class="badge">匹配 ' + Math.round((q.match.confidence || 0) * 100) + "%</span></span></div>" +
      '<h2 class="question-title">' + escapeHtml(q.stem) + '</h2><div class="options" role="radiogroup" aria-label="选择答案">' + options + "</div>" +
      '<div class="answer-actions"><button class="btn primary" id="revealBtn">' + (revealed ? "收起答案与复盘" : "查看答案与复盘") + '</button><button class="btn" id="editBtn">编辑复盘</button>' +
        (q.match.status !== "verified" ? '<button class="btn" id="verifyBtn">确认此匹配</button>' : "") +
      '</div><p class="hint">快捷键：← / → 切题，Enter 揭示答案</p>' +
      '<div class="tags">' + q.tags.map((tag) => '<span class="tag"># ' + escapeHtml(tag) + "</span>").join("") + "</div>" +
      (q.note ? '<div class="note"><strong>我的笔记</strong>' + escapeHtml(q.note) + "</div>" : "");

    renderReview(q, revealed);
    $("revealBtn").onclick = () => {
      if (state.revealed.has(q.id)) {
        state.revealed.delete(q.id);
      } else {
        state.revealed.add(q.id);
        recordAnswerAttempt(q, selected);
      }
      renderAll(false);
    };
    $("editBtn").onclick = openEdit;
    if ($("verifyBtn")) {
      $("verifyBtn").onclick = () => {
        q.match.status = "verified";
        q.match.confidence = Math.max(q.match.confidence || 0, 0.9);
        saveData();
        toast("已确认题目与复盘的对应关系");
        renderAll(false);
      };
    }
    els.question.querySelectorAll("[data-option]").forEach((button) => {
      button.onclick = () => {
        if (!revealed) {
          state.selected[q.id] = button.dataset.option;
          renderAll(false);
        }
      };
      button.onkeydown = (event) => {
        if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return;
        event.preventDefault();
        const options = [...els.question.querySelectorAll('[data-option]')];
        const index = options.indexOf(button);
        const next = options[(index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length];
        next.click();
        next.focus();
      };
    });
  }

  function renderReview(q, revealed) {
    if (!revealed) {
      els.review.innerHTML = '<div class="review-placeholder"><div><div class="placeholder-mark">答</div><strong>先独立完成这道题</strong><p>作答后再揭示答案、知识点与原文证据。</p></div></div>';
      return;
    }
    const answerText = q.answerStatus === "pending" ? "暂无可确认答案" : (q.options.find((opt) => opt.key === q.answer)?.text || "答案尚待核验");
    const evidence = (q.match.evidence || []).map((item) => '<p class="hint">• ' + escapeHtml(item) + "</p>").join("");
    const sources = q.sourceRefs.map((ref, index) =>
      '<div class="source-card"><b>' + escapeHtml(ref.file) + "</b><span>" + escapeHtml(ref.locator) + "</span>" +
      (ref.excerpt ? '<span>“' + escapeHtml(ref.excerpt) + '”</span>' : "") +
      (ref.asset ? '<button class="btn" data-source-index="' + index + '">' + (ref.crop ? "查看单题证据" : "查看原图") + '</button>' : "") +
      "</div>"
    ).join("");
    els.review.innerHTML =
      '<div class="review-content"><div class="pane-label"><span>REVIEW</span><button class="btn ghost clear-filter" id="printBtn">打印本题</button></div>' +
      '<div class="answer-line ' + (q.answerStatus === "verified" ? "verified" : "pending") + '"><span class="answer-key">' + escapeHtml(q.answerStatus === "pending" ? "?" : (q.answer || "?")) + '</span><span><small>' + escapeHtml(q.answerStatus === "verified" ? "正确答案" : answerStatusLabel(q.answerStatus)) + '</small><br><strong>' + escapeHtml(answerText) + "</strong></span></div>" +
      "<h2>" + escapeHtml(q.review.summary || "复盘内容待补充") + "</h2>" +
      '<div class="review-block"><h3>逐题复盘</h3><p>' + escapeHtml(q.review.analysis || "暂无详细解析。") + "</p></div>" +
      '<div class="review-block"><h3>易错点</h3><ul class="pitfalls">' + (q.review.pitfalls.length ? q.review.pitfalls.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") : "<li>暂无记录</li>") + "</ul></div>" +
      '<div class="review-block"><h3>记忆提示</h3><p class="memory">' + escapeHtml(q.review.memoryCue || "暂无记忆提示。") + "</p></div>" +
      "<details><summary>来源证据与匹配依据</summary><div>" + evidence + sources + "</div></details>" +
      '<div class="mastery-box"><p>这道题现在掌握得怎么样？选择后会自动安排复习。</p><div class="mastery-actions">' +
        '<button class="btn again" data-mastery="again">不会</button><button class="btn fuzzy" data-mastery="fuzzy">模糊</button><button class="btn know" data-mastery="know">会</button>' +
      '</div><p class="next-review">当前状态：' + escapeHtml(masteryLabel(q.mastery)) + " · 下次复习：" + escapeHtml(formatDate(q.reviewState.nextReviewAt)) + "</p></div></div>";
    $("printBtn").onclick = () => window.print();
    els.review.querySelectorAll("[data-mastery]").forEach((button) => button.onclick = () => markMastery(q, button.dataset.mastery));
    els.review.querySelectorAll("[data-source-index]").forEach((button) => button.onclick = () => {
      const ref = q.sourceRefs[Number(button.dataset.sourceIndex)];
      openSource(ref, ref.file + " · " + ref.locator);
    });
  }

  function recordAnswerAttempt(q, selected) {
    q.reviewState.history = historyOf(q);
    q.reviewState.history.push({
      kind: "answer",
      at: new Date().toISOString(),
      selectedAnswer: selected || null,
      correct: q.answerStatus === "verified" && selected ? selected === q.answer : null,
      answerStatus: q.answerStatus
    });
    saveData();
  }

  function markMastery(q, level) {
    const intervals = { again: [0, 1, 3], fuzzy: [1, 3, 7], know: [3, 7, 21] };
    const steps = q.reviewState.steps = { again: 0, fuzzy: 0, know: 0, ...(q.reviewState.steps || {}) };
    const step = level === "again" && q.mastery !== "again" ? 0 : Math.min(Number(steps[level]) || 0, 2);
    const days = intervals[level][step];
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + days);
    q.mastery = level;
    if (level === "again") {
      q.reviewState.steps = { again: Math.min(step + 1, 2), fuzzy: 0, know: 0 };
    } else {
      q.reviewState.steps[level] = Math.min(step + 1, 2);
    }
    q.reviewState.step = q.reviewState.steps[level];
    q.reviewState.nextReviewAt = next.toISOString();
    q.reviewState.history = Array.isArray(q.reviewState.history) ? q.reviewState.history : [];
    q.reviewState.history.push({ kind: "mastery", at: now.toISOString(), mastery: level, intervalDays: days });
    saveData();
    toast("已标记“" + masteryLabel(level) + "”，下次复习：" + formatDate(next));
    renderAll(false);
  }

  function renderAll(rebuildSeasons = true) {
    if (rebuildSeasons) populateSeasons();
    filterQuestions();
    renderStats();
    renderList();
    renderQuestion(currentQuestion());
    syncDeepLink();
    const index = state.filtered.findIndex((q) => q.id === state.currentId);
    $("prevBtn").disabled = index <= 0;
    $("nextBtn").disabled = index < 0 || index >= state.filtered.length - 1;
  }

  function navigate(delta) {
    const index = state.filtered.findIndex((q) => q.id === state.currentId);
    const next = state.filtered[index + delta];
    if (next) {
      state.currentId = next.id;
      closeMenu();
      renderAll(false);
      $("questionPane").focus();
    }
  }

  function clearFilters(render = true) {
    els.search.value = "";
    els.season.value = "all";
    els.subject.value = "all";
    els.mastery.value = "all";
    els.status.value = "all";
    state.quick = null;
    if (render) renderAll(false);
  }

  function openEdit() {
    const q = currentQuestion();
    if (!q) return;
    $("editAnswer").value = q.answer;
    $("editConfidence").value = q.match.confidence;
    $("editAnswerStatus").value = q.answerStatus;
    $("editMatchStatus").value = q.match.status;
    $("editSummary").value = q.review.summary;
    $("editAnalysis").value = q.review.analysis;
    $("editPitfalls").value = q.review.pitfalls.join("\n");
    $("editMemory").value = q.review.memoryCue;
    $("editTags").value = q.tags.join("，");
    $("editNote").value = q.note;
    els.editDialog.showModal();
  }

  function saveEdit(event) {
    event.preventDefault();
    const q = currentQuestion();
    if (!q) return;
    q.answer = $("editAnswer").value.trim().toUpperCase();
    if (q.answer && !q.options.some((option) => option.key === q.answer)) {
      toast("答案必须是现有选项中的 A、B、C 或 D");
      return;
    }
    q.match.confidence = Math.max(0, Math.min(1, Number($("editConfidence").value) || 0));
    q.answerStatus = $("editAnswerStatus").value;
    q.match.status = $("editMatchStatus").value;
    q.review.summary = $("editSummary").value.trim();
    q.review.analysis = $("editAnalysis").value.trim();
    q.review.pitfalls = $("editPitfalls").value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    q.review.memoryCue = $("editMemory").value.trim();
    q.tags = $("editTags").value.split(/[，,]/).map((value) => value.trim()).filter(Boolean);
    q.note = $("editNote").value.trim();
    saveData();
    els.editDialog.close();
    toast("修改已保存在本机");
    renderAll(false);
  }

  function renderSourcePreview() {
    const ref = state.sourceRef;
    if (!ref) return;
    const cropped = state.sourceCropped && ref.crop;
    els.sourceFrame.classList.toggle("crop", Boolean(cropped));
    els.sourceFrame.style.setProperty("--focus-y", ((ref.crop && ref.crop.focusY) || 50) + "%");
    $("sourceModeLabel").textContent = cropped ? "单题证据裁剪" : "来源整页";
    $("toggleSourceModeBtn").textContent = cropped ? "查看整页" : "回到单题裁剪";
    $("toggleSourceModeBtn").setAttribute("aria-label", cropped ? "查看来源整页" : "回到单题证据裁剪");
    els.sourceImage.alt = cropped ? "来源资料单题证据裁剪" : "来源资料整页原图";
  }

  function openSource(ref, title) {
    if (!ref || !normalizeAssetPath(ref.asset)) {
      toast("来源图片路径无效，已阻止打开");
      return;
    }
    state.sourceRef = ref;
    state.sourceCropped = Boolean(ref?.crop);
    $("sourceTitle").textContent = title || "来源原图";
    $("sourceImage").src = normalizeAssetPath(ref.asset);
    renderSourcePreview();
    els.sourceDialog.showModal();
  }

  function toast(message) {
    clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    state.toastTimer = setTimeout(() => els.toast.classList.remove("show"), 3200);
  }

  function exportData() {
    markBackupComplete();
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "review-data-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast("JSON 备份已导出");
  }

  async function importData(file) {
    try {
      const incoming = JSON.parse(await file.text());
      if (!incoming || !Array.isArray(incoming.questions)) throw new Error("缺少 questions 数组");
      const normalized = incoming.questions.map(normalizeQuestion);
      const oldMap = new Map(state.data.questions.map((q) => [q.id, q]));
      const conflicts = normalized.filter((next) => {
        const old = oldMap.get(next.id);
        if (!old) return false;
        return ["stem", "options", "answer", "answerStatus", "review", "tags", "match", "sourceRefs"].some((field) => JSON.stringify(old[field]) !== JSON.stringify(next[field]));
      }).map((q) => ({ id: q.id, number: q.number, subject: q.subject }));
      state.pendingImport = { incoming: normalized, duplicates: normalized.filter((q) => oldMap.has(q.id)).length, conflicts };
      $("importSummary").textContent = `将导入 ${normalized.length} 题：新增 ${normalized.filter((q) => !oldMap.has(q.id)).length} 题，重复 ${state.pendingImport.duplicates} 题，待核验 ${normalized.filter((q) => q.match.status !== "verified" || q.answerStatus !== "verified").length} 题。`;
      const conflictBox = $("importConflictBox");
      conflictBox.hidden = !conflicts.length;
      $("importConflicts").innerHTML = conflicts.slice(0, 12).map((item) => `<li>${escapeHtml(item.subject)} 第 ${escapeHtml(item.number)} 题：题干、答案或复盘内容有差异</li>`).join("") + (conflicts.length > 12 ? `<li>另有 ${conflicts.length - 12} 条冲突未展开</li>` : "");
      els.importDialog.showModal();
    } catch (error) {
      toast("导入失败：" + error.message);
    }
  }

  function confirmImport() {
    if (!state.pendingImport) return;
    state.undoSnapshot = JSON.parse(JSON.stringify(state.data));
    state.data.questions = mergeQuestions(state.data.questions, state.pendingImport.incoming, true);
    state.data.version = 1;
    saveData();
    clearFilters(false);
    populateSeasons();
    renderAll(false);
    const count = state.pendingImport.incoming.length;
    const duplicates = state.pendingImport.duplicates;
    state.pendingImport = null;
    els.importDialog.close();
    $("undoText").textContent = `已导入 ${count} 题，合并重复 ${duplicates} 题`;
    $("undoBar").hidden = false;
    toast("资料已合并，可在短时间内撤销");
  }

  function undoImport() {
    if (!state.undoSnapshot) return;
    state.data = state.undoSnapshot;
    state.undoSnapshot = null;
    saveData();
    $("undoBar").hidden = true;
    clearFilters(false);
    populateSeasons();
    renderAll(false);
    toast("已撤销本次导入");
  }

  function syncDeepLink() {
    if (!state.currentId) return;
    const hash = "#q=" + encodeURIComponent(state.currentId);
    if (window.location.hash !== hash) history.replaceState(null, "", hash);
  }

  function applyDeepLink() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const id = params.get("q");
    if (id && state.data.questions.some((q) => q.id === id)) state.currentId = id;
    state.initialHashApplied = true;
  }

  function openMenu() {
    els.sidebar.classList.add("open");
    els.backdrop.classList.add("show");
  }

  function closeMenu() {
    els.sidebar.classList.remove("open");
    els.backdrop.classList.remove("show");
  }

  [els.search, els.season, els.subject, els.mastery, els.status].forEach((control) => {
    control.addEventListener(control === els.search ? "input" : "change", () => {
      state.quick = null;
      renderAll(false);
    });
  });
  els.list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (button) {
      state.currentId = button.dataset.id;
      closeMenu();
      renderAll(false);
    }
  });
  $("prevBtn").onclick = () => navigate(-1);
  $("nextBtn").onclick = () => navigate(1);
  $("clearFilterBtn").onclick = () => clearFilters(true);
  $("menuBtn").onclick = openMenu;
  els.backdrop.onclick = closeMenu;
  $("importBtn").onclick = () => $("fileInput").click();
  $("fileInput").onchange = (event) => {
    if (event.target.files[0]) importData(event.target.files[0]);
    event.target.value = "";
  };
  $("exportBtn").onclick = exportData;
  $("resetBtn").onclick = () => {
    if (confirm("恢复原始资料会清除本机的掌握度、笔记和修改，确定继续吗？")) {
      localStorage.removeItem(STORAGE_KEY);
      state.data = { ...seed, questions: seed.questions.map(normalizeQuestion) };
      state.data.dirty = false;
      state.revealed.clear();
      state.selected = {};
      state.undoSnapshot = null;
      $("undoBar").hidden = true;
      clearFilters(false);
      populateSeasons();
      renderAll(false);
      toast("已恢复原始资料");
    }
  };
  $("saveEditBtn").onclick = saveEdit;
  $("cancelImportBtn").onclick = () => els.importDialog.close();
  $("cancelImportBtnBottom").onclick = () => els.importDialog.close();
  $("confirmImportBtn").onclick = confirmImport;
  $("undoImportBtn").onclick = undoImport;
  $("closeSourceBtn").onclick = () => els.sourceDialog.close();
  $("toggleSourceModeBtn").onclick = () => {
    state.sourceCropped = !state.sourceCropped;
    renderSourcePreview();
  };
  document.addEventListener("keydown", (event) => {
    if (reviewRoot.style.display === "none" || !reviewRoot.contains(event.target)) return;
    if (event.target.matches("input,textarea,select,button,a,[role=radio]") || els.editDialog.open || els.sourceDialog.open || els.importDialog.open) return;
    if (event.key === "ArrowLeft") navigate(-1);
    if (event.key === "ArrowRight") navigate(1);
    if (event.key === "Enter") {
      const q = currentQuestion();
      if (q) {
        state.revealed.has(q.id) ? state.revealed.delete(q.id) : state.revealed.add(q.id);
        renderAll(false);
      }
    }
  });
  reviewRoot.querySelectorAll("[data-stat]").forEach((button) => {
    button.onclick = () => {
      clearFilters(false);
      state.quick = button.dataset.stat;
      renderAll(false);
      const workspace = reviewRoot.querySelector(".review-workspace");
      if (workspace) workspace.scrollIntoView();
    };
  });

  applyDeepLink();
  window.addEventListener("hashchange", () => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const id = params.get("q");
    if (id && state.data.questions.some((q) => q.id === id)) {
      state.currentId = id;
      renderAll(false);
    }
  });
  window.ReviewApp = {
    refresh() {
      state.data = loadData();
      applyDeepLink();
      renderAll(true);
      syncCloudData();
    }
  };
  renderAll(true);
  syncCloudData();
})();
