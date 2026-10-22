// Only game results live here. The browser's storage can be disabled, full, or
// unavailable; none of those conditions should interrupt a run.
export const BEST_STORAGE_KEY = "zatto-stage-bests-v1";
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

function normalize(result) {
  return {
    seed: result.seed,
    stage: result.stage,
    elapsed: Math.round(result.elapsed * 1000) / 1000,
    hits: result.hits,
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

export function recordLocalBest(storage, result) {
  if (!validResult(result)) return { best: null, improved: false, stored: false };
  const current = normalize(result);
  const records = readRecords(storage);
  const previous = records.find((record) =>
    record.seed === current.seed && record.stage === current.stage);
  if (previous && !isFaster(current, previous))
    return { best: previous, improved: false, stored: true };
  const next = [current, ...records.filter((record) =>
    record.seed !== current.seed || record.stage !== current.stage)]
    .slice(0, MAX_LOCAL_BESTS);
  try {
    storage?.setItem(BEST_STORAGE_KEY, JSON.stringify({ version: 1, records: next }));
    return { best: current, improved: true, stored: !!storage };
  } catch {
    return { best: current, improved: true, stored: false };
  }
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
