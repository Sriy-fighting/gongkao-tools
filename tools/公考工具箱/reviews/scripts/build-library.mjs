import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const reviewsDir = path.resolve(here, "..");
const seasonsDir = path.join(reviewsDir, "seasons");
const assetDir = path.join(reviewsDir, "assets", "sources");
const allowedSubjects = new Set(["政治理论", "常识", "公基"]);

const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));

function normalizeAsset(asset) {
  if (!asset) return asset;
  const normalized = String(asset).replaceAll("\\", "/");
  if (normalized.startsWith("reviews/")) return normalized;
  if (normalized.startsWith("assets/sources/")) return `reviews/${normalized}`;
  return normalized;
}

function normalizeQuestion(question, seasonName) {
  const next = structuredClone(question);
  next.season = next.season || seasonName;
  next.sourceRefs = Array.isArray(next.sourceRefs) ? next.sourceRefs : [];
  next.sourceRefs = next.sourceRefs.map((ref) => ({
    ...ref,
    asset: normalizeAsset(ref.asset)
  }));
  return next;
}

function comparable(question) {
  const clone = structuredClone(question);
  delete clone.mastery;
  delete clone.reviewState;
  delete clone.note;
  return JSON.stringify(clone);
}

async function scanSeasons() {
  const entries = await fs.readdir(seasonsDir, { withFileTypes: true });
  const seasons = [];
  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))) {
    const dataFile = path.join(seasonsDir, entry.name, "review-data.json");
    try {
      const data = await readJson(dataFile);
      if (!Array.isArray(data.questions)) throw new Error("缺少 questions 数组");
      seasons.push({ name: entry.name, data, file: dataFile });
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error(`${entry.name}/review-data.json：${error.message}`);
    }
  }
  return seasons;
}

function validateQuestion(question, errors) {
  const label = `${question.id || "无 ID"}`;
  if (!allowedSubjects.has(question.subject)) errors.push(`${label} 科目不在白名单内：${question.subject || "未填写"}`);
  if (!question.id) errors.push(`${label} 缺少稳定 ID`);
  if (!question.stem || !String(question.stem).trim()) errors.push(`${label} 缺少题干`);
  if (!Array.isArray(question.options) || question.options.length < 2) errors.push(`${label} 选项少于 2 个`);
  if (!["verified", "pending", "unmatched"].includes(question.match?.status)) errors.push(`${label} 匹配状态非法`);
  if (!["verified", "inferred", "pending"].includes(question.answerStatus)) errors.push(`${label} 答案状态非法`);
  if (!Array.isArray(question.sourceRefs) || question.sourceRefs.length === 0) errors.push(`${label} 缺少来源证据`);
  for (const [index, ref] of (question.sourceRefs || []).entries()) {
    const region = ref?.crop?.region;
    if (!region) continue;
    const valid = ["x", "y", "width", "height"].every((key) => Number.isFinite(Number(region[key])))
      && Number(region.x) >= 0 && Number(region.y) >= 0
      && Number(region.width) > 0 && Number(region.height) > 0;
    if (!valid) errors.push(`${label} 来源证据 ${index + 1} 的 crop.region 非法`);
  }
}

async function build() {
  const seasons = await scanSeasons();
  const questions = new Map();
  const duplicateConflicts = [];
  const validationErrors = [];
  const seasonReports = [];

  for (const season of seasons) {
    let verified = 0;
    let pending = 0;
    let unmatched = 0;
    for (const raw of season.data.questions) {
      const question = normalizeQuestion(raw, season.data.season || season.name);
      validateQuestion(question, validationErrors);
      if (question.match.status === "verified") verified += 1;
      else if (question.match.status === "unmatched") unmatched += 1;
      else pending += 1;
      const old = questions.get(question.id);
      if (old && comparable(old) !== comparable(question)) {
        duplicateConflicts.push({ id: question.id, season: season.name, message: "同一稳定 ID 的内容不一致，保留先出现的版本" });
        continue;
      }
      if (!old) questions.set(question.id, question);
    }
    seasonReports.push({
      season: season.data.season || season.name,
      directory: season.name,
      questions: season.data.questions.length,
      verified,
      pending,
      unmatched
    });
  }

  for (const question of questions.values()) {
    for (const ref of question.sourceRefs) {
      if (!ref.asset) continue;
      const assetName = path.basename(ref.asset);
      try {
        await fs.access(path.join(assetDir, assetName));
      } catch {
        validationErrors.push(`${question.id} 来源图片不存在：${assetName}`);
      }
    }
  }

  const library = {
    version: 1,
    libraryName: "政治理论、常识与公基复盘资料库",
    generatedAt: new Date().toISOString(),
    seasons: seasonReports,
    questions: [...questions.values()]
  };
  const matchReport = {
    version: 1,
    generatedAt: library.generatedAt,
    totals: {
      questions: library.questions.length,
      verified: library.questions.filter((q) => q.match.status === "verified").length,
      pending: library.questions.filter((q) => q.match.status === "pending").length,
      unmatched: library.questions.filter((q) => q.match.status === "unmatched").length
    },
    seasons: seasonReports,
    duplicateConflicts,
    validationErrors,
    matches: library.questions.map((q) => ({
      id: q.id,
      number: q.number,
      subject: q.subject,
      status: q.match.status,
      confidence: q.match.confidence,
      evidence: q.match.evidence,
      sourceRefs: q.sourceRefs
    }))
  };
  const safeJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
  await fs.writeFile(path.join(reviewsDir, "library.json"), `${JSON.stringify(library, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(reviewsDir, "match-report.json"), `${JSON.stringify(matchReport, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(reviewsDir, "review-data.js"), `window.REVIEW_SEED = ${safeJson({ ...library, questions: library.questions })};\n`, "utf8");
  console.log(`已汇总 ${library.questions.length} 道题，${seasonReports.length} 个季度`);
  if (duplicateConflicts.length || validationErrors.length) {
    console.warn(`发现 ${duplicateConflicts.length} 条重复冲突、${validationErrors.length} 条数据问题，请查看 match-report.json`);
    process.exitCode = 1;
  }
}

build().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
