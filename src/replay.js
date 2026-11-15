// Only game results live here. The browser's storage can be disabled, full, or
// unavailable; none of those conditions should interrupt a run.
export const BEST_STORAGE_KEY = "zatto-stage-bests-v1";
export const COURSE_BEST_STORAGE_KEY = "zatto-course-bests-v1";
export const MAX_LOCAL_BESTS = 40;

function validSeed(seed) {
  return Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff;
}

function validStage(stage) {
  // 0–4 are individual chapters; 5 is the full five-chapter journey.
  return Number.isInteger(stage) && stage >= 0 && stage <= 5;
}

function validResult(result) {
  return result && validSeed(result.seed) && validStage(result.stage) &&
    Number.isFinite(result.elapsed) && result.elapsed >= 0 &&
    Number.isInteger(result.hits) && result.hits >= 0;
}

function metric(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function normalize(result) {
  return {
    seed: result.seed,
    stage: result.stage,
    elapsed: Math.round(result.elapsed * 1000) / 1000,
    hits: result.hits,
    score: metric(result.score),
    maxFlow: metric(result.maxFlow),
  };
}

function readRecords(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(BEST_STORAGE_KEY) || "null");
    if (parsed?.version !== 1 || !Array.isArray(parsed.records)) return [];
    return parsed.records.slice(0, MAX_LOCAL_BESTS).filter(validResult).map(normalize);
  } catch {
    return [];
  }
}

function isFaster(result, previous) {
  return result.elapsed < previous.elapsed ||
    (result.elapsed === previous.elapsed && result.hits < previous.hits);
}

export function readLocalBest(storage, seed, stage) {
  if (!validSeed(seed) || !validStage(stage)) return null;
  return readRecords(storage).find((record) =>
    record.seed === seed && record.stage === stage) || null;
}

function recordBest(storage, key, current, records, matches) {
  const previous = records.find(matches);
  const improved = !previous || isFaster(current, previous);
  const scoreImproved = current.score > (previous?.score ?? 0);
  const best = {
    ...(improved ? current : previous),
    score: Math.max(current.score, previous?.score ?? 0),
    maxFlow: Math.max(current.maxFlow, previous?.maxFlow ?? 0),
  };
  if (previous && !improved && !scoreImproved && best.maxFlow === previous.maxFlow)
    return { best, improved, scoreImproved, stored: true };
  const next = [best, ...records.filter((record) => !matches(record))].slice(0, MAX_LOCAL_BESTS);
  try {
    storage?.setItem(key, JSON.stringify({ version: 1, records: next }));
    return { best, improved, scoreImproved, stored: !!storage };
  } catch {
    return { best, improved, scoreImproved, stored: false };
  }
}

export function recordLocalBest(storage, result) {
  if (!validResult(result)) return { best: null, improved: false, scoreImproved: false, stored: false };
  const current = normalize(result);
  return recordBest(storage, BEST_STORAGE_KEY, current, readRecords(storage),
    (record) => record.seed === current.seed && record.stage === current.stage);
}

function validCourseResult(result) {
  return result && validStage(result.stage) &&
    Number.isFinite(result.elapsed) && result.elapsed >= 0 &&
    Number.isInteger(result.hits) && result.hits >= 0;
}

function readCourseRecords(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(COURSE_BEST_STORAGE_KEY) || "null");
    if (parsed?.version !== 1 || !Array.isArray(parsed.records)) return [];
    return parsed.records.slice(0, MAX_LOCAL_BESTS).filter(validCourseResult)
      .map(({ stage, elapsed, hits, score, maxFlow }) => ({ stage, elapsed: Math.round(elapsed * 1000) / 1000, hits, score: metric(score), maxFlow: metric(maxFlow) }));
  } catch {
    return [];
  }
}

export function readCourseBest(storage, stage) {
  if (!validStage(stage)) return null;
  return readCourseRecords(storage).find((record) => record.stage === stage) || null;
}

export function recordCourseBest(storage, result) {
  if (!validCourseResult(result)) return { best: null, improved: false, scoreImproved: false, stored: false };
  const { stage, elapsed, hits, score, maxFlow } = normalize(result);
  const current = { stage, elapsed, hits, score, maxFlow };
  return recordBest(storage, COURSE_BEST_STORAGE_KEY, current, readCourseRecords(storage),
    (record) => record.stage === current.stage);
}

export function recordCourseResults(storage, { stage, elapsed, hits, score, maxFlow, total, totalEligible }) {
  const stageResult = recordCourseBest(storage, { stage, elapsed, hits, score, maxFlow });
  const useTotal = stage === 4 && totalEligible;
  const result = useTotal
    ? recordCourseBest(storage, { stage: 5, elapsed: total?.elapsed, hits: total?.hits,
        score: total?.score, maxFlow: total?.maxFlow })
    : stageResult;
  return result.stored && result.best ? { kind: useTotal ? "total" : "stage", ...result, stageResult } : null;
}

export function seedShareUrl(href, seed) {
  if (!validSeed(seed)) throw new RangeError("Invalid seed");
  const url = new URL(href);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new TypeError("Only browser URLs can be shared");
  url.search = new URLSearchParams({ seed: String(seed) }).toString();
  url.hash = "";
  return url.toString();
}
