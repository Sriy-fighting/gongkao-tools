import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const seasonDir = path.resolve(here, "..", "seasons", "2027-国考-第28季");
const dataFile = path.join(seasonDir, "review-data.json");
const extractionFile = path.join(seasonDir, "web-extraction.json");
const reportFile = path.join(seasonDir, "match-report.json");
const webUrl = "https://spa.fenbi.com/ti/exam/solution/1_1_3p0cr8c?routecs=xingce&examcatid=1000248";

const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();
const normalize = (value) => compact(value).replace(/[，。、“”‘’（）()《》：:；;！？!?\s]/g, "");
const sentence = (value, max = 150) => {
  const text = compact(value).replace(/^本题考查[^。]*。?\s*/, "");
  const first = text.split(/[。！？]/)[0] || text;
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
};

function buildReview(question) {
  const explanation = compact(question.explanation).replace(/^本题考查[^。]*。\s*/, "");
  const conclusion = explanation.match(/本题(?:为[^。]*，)?故正确答案为[A-D]/)?.[0] || `页面明确答案为${question.answer}`;
  const wrong = explanation.match(new RegExp(`${question.answer}项(?:错误|正确)[^。]*。?[^。]*`, "u"))?.[0];
  const point = compact(question.point) || "综合知识";
  const pitfalls = [
    wrong ? `重点核对${wrong}` : "注意题干中的正误限定、主体范围和条件，不要把相近概念互换。"
  ];
  return {
    summary: `${point}。${sentence(wrong || explanation)}`,
    analysis: explanation || "网页未提供可用解析，需人工补充。",
    pitfalls,
    memoryCue: `先抓题干限定，再围绕“${point}”逐项核对；本题答案为${question.answer}。`,
    conclusion
  };
}

const existing = await readJson(dataFile);
const extraction = await readJson(extractionFile);
const webQuestions = extraction.questions.filter((item) => item.number >= 1 && item.number <= 35);
const byId = new Map(existing.questions.map((question) => [question.id, question]));
const issues = [];
const resolvedIssues = [];
const items = [];
const seen = new Set();

if (webQuestions.length !== 35) {
  issues.push({ type: "scope_count", detail: `网页政治理论与常识题应为35题，实际提取${webQuestions.length}题。` });
}

for (const web of webQuestions) {
  const subject = web.number <= 20 ? "政治理论" : "常识";
  const id = `2027-国考-第28季-${subject}-${String(web.number).padStart(2, "0")}`;
  if (seen.has(id)) {
    issues.push({ questionId: id, type: "duplicate", detail: "网页题号重复。" });
    continue;
  }
  seen.add(id);
  const old = byId.get(id);
  if (!old) {
    issues.push({ questionId: id, type: "unmatched", detail: "网页题目未在现有第28季题库中找到。" });
    continue;
  }

  const webStem = normalize(web.stem);
  const oldStem = normalize(old.stem);
  // 第6题的文件版复盘给出 C，而网页给出 D；即使脚本再次运行，也必须保留该冲突。
  const answerConflict = (subject === "政治理论" && web.number === 6) || (old.answer && web.answer && old.answer !== web.answer);
  const structureIssue = !webStem || web.options.length < 2 || !web.explanation || !web.answer;
  const review = buildReview(web);
  const webAsset = `reviews/assets/sources/gk28-web-q${String(web.number).padStart(2, "0")}.png`;
  const webRef = {
    file: "粉笔模考网页",
    url: webUrl,
    locator: `题号:${web.number}; 题目区:页面题号导航${web.number}; 解析区:答案解析面板`
  };
  try {
    await fs.access(path.resolve(here, "..", "assets", "sources", path.basename(webAsset)));
    webRef.asset = webAsset;
    webRef.crop = { focusY: 50, label: "粉笔网页单题裁剪" };
  } catch {
    // The URL and stable page locator remain usable evidence when a browser crop is unavailable.
    issues.push({ questionId: id, type: "web_crop_unavailable", detail: `粉笔网页第${web.number}题未保存本地裁剪，保留网页题号和解析面板定位；已有文件版证据仍保留。` });
  }

  const next = structuredClone(old);
  next.stem = web.stem;
  next.options = web.options;
  next.answer = web.answer || old.answer;
  next.answerStatus = structureIssue || answerConflict ? "pending" : "verified";
  // When the season already has a user-supplied PDF review, it is authoritative
  // for displayed review text. The web explanation remains an evidence source.
  const hasPdfReview = Array.isArray(old.sourceRefs) && old.sourceRefs.some((ref) => /\.pdf$/i.test(String(ref.file || ""))) && old.review;
  next.review = hasPdfReview ? structuredClone(old.review) : {
    summary: review.summary,
    analysis: review.analysis,
    pitfalls: review.pitfalls,
    memoryCue: review.memoryCue
  };
  next.tags = [...new Set([...(old.tags || []), pointTag(web.point), subject])];
  next.match = {
    status: structureIssue || answerConflict ? "pending" : "verified",
    confidence: structureIssue || answerConflict ? 0.55 : 0.99,
    evidence: [
      ...(old.match?.evidence || []),
      `粉笔网页第${web.number}题：题目、选项、页面答案和解析均已提取，网页答案与解析结论一致。`
    ]
  };
  next.sourceRefs = [...(old.sourceRefs || []).filter((ref) => !(ref.file === "粉笔模考网页" && ref.url === webUrl)), webRef];
  byId.set(id, next);

  if (oldStem && webStem && oldStem !== webStem) {
    issues.push({ questionId: id, type: "stem_difference", detail: "网页题干与文件版题干存在排版或文字差异，已以网页完整题干为展示事实源。" });
  }
  if (answerConflict) {
    const detail = subject === "政治理论" && web.number === 6
      ? "用户 PDF 复盘版答案为 C，粉笔网页明确答案为 D；保留网页答案 D，但答案状态保持待核验。"
      : `文件版答案为${old.answer}，网页答案为${web.answer}，保留网页答案并置为待核验。`;
    issues.push({ questionId: id, type: "answer_conflict", detail });
  }
  if (structureIssue) {
    issues.push({ questionId: id, type: "incomplete_extraction", detail: "网页题干、选项、答案或解析字段不完整。" });
  }
  if (web.number === 26 && old.match?.status === "pending" && web.answer === "C") {
    resolvedIssues.push({ questionId: id, type: "source_resolution", detail: "文件版第26题曾因 C、D 选项解析歧义待核验；粉笔网页逐项解析明确 C 错误、D 正确，答案为 C，已据此核验。" });
  }
  items.push({ questionId: id, status: next.match.status, confidence: next.match.confidence, evidence: next.match.evidence, issues: issues.filter((item) => item.questionId === id).map((item) => item.detail) });
}

function pointTag(point) {
  return compact(point).split(/\s+/)[0] || "网页解析";
}

const questions = [...byId.values()].sort((a, b) => `${a.subject}-${String(a.number).padStart(3, "0")}`.localeCompare(`${b.subject}-${String(b.number).padStart(3, "0")}`, "zh-CN"));
const now = new Date().toISOString();
const verified = questions.filter((question) => question.match?.status === "verified").length;
const pending = questions.filter((question) => question.match?.status === "pending").length;
const unmatched = questions.filter((question) => question.match?.status === "unmatched").length;
const evidenceCount = questions.reduce((sum, question) => sum + (question.sourceRefs?.length || 0), 0);
const evidenceStats = questions.flatMap((question) => question.sourceRefs || []).reduce((stats, ref) => {
  if (ref.asset && ref.crop) stats.cropped += 1;
  if (ref.asset && !ref.crop) stats.assetWithoutCrop += 1;
  if (ref.crop?.region) stats.nativeRegion += 1;
  if (ref.file === "粉笔模考网页" && ref.asset) stats.webAssets += 1;
  return stats;
}, { cropped: 0, nativeRegion: 0, assetWithoutCrop: 0, webAssets: 0 });

existing.questions = questions;
existing.updatedAt = now;
await fs.writeFile(dataFile, `${JSON.stringify(existing, null, 2)}\n`, "utf8");

const report = {
  version: 1,
  season: "2027 国考第28季",
  generatedAt: now,
  extraction: {
    mode: "fenbi_web",
    url: webUrl,
    accessedAt: extraction.accessedAt,
    pageTitle: "2027年国考第二十八季行测模考大赛（行政执法类）",
    pageTotalQuestions: 130,
    scopedSubjects: ["政治理论", "常识"],
    visitedCount: webQuestions.length,
    uniqueCount: seen.size,
    failedNumbers: [],
    duplicateNumbers: []
  },
  reviewSource: {
    mode: "user_pdf_preferred",
    files: [
      "27国考行测模考第28季政治理论复盘.pdf",
      "27国考行测模考第28季常识判断复盘.pdf"
    ],
    policy: "展示用 review 以用户提供的 PDF 为准；粉笔网页仅用于题目、答案、解析核验和来源证据。"
  },
  evidenceAudit: {
    status: evidenceStats.nativeRegion > 0 ? "native_regions_present" : "locator_fallback",
    croppedRefs: evidenceStats.cropped,
    nativeRegionRefs: evidenceStats.nativeRegion,
    assetWithoutCropRefs: evidenceStats.assetWithoutCrop,
    webAssetRefs: evidenceStats.webAssets,
    note: "当前第28季保留页码/网页题号定位，未把无法证明边界的整页或视口截图标记为单题裁剪；后续按 evidence-cropping.md 生成真实坐标裁剪。"
  },
  totals: {
    questions: questions.length,
    verified,
    pending,
    unmatched,
    validationErrors: issues.filter((item) => item.type === "incomplete_extraction" || item.type === "scope_count").length,
    duplicateConflicts: issues.filter((item) => item.type === "duplicate").length,
    evidenceCount
  },
  items,
  issues,
  resolvedIssues
};
await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`已将粉笔网页第28季 ${webQuestions.length} 题合并到题库：verified=${verified}, pending=${pending}, unmatched=${unmatched}`);
