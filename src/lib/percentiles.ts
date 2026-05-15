import type { TestScore, Subject, ComputedRow, CourseHistoryEntry } from './types';

// ─── Normal CDF & inverse CDF (Acklam's approximation) ──────────────────────

/** Standard normal CDF (mean 0, variance 1) */
export function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;

  const t = 1 / (1 + p * ax);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);

  return 0.5 * (1 + sign * y);
}

/** Inverse normal CDF (Peter Acklam's rational approximation) */
export function invNormalCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  // Central region coefficients (polynomials in r = q², q = p-0.5)
  const a1 = -3.969683028665376e1;
  const a2 = 2.209460984245205e2;
  const a3 = -2.759285104469687e2;
  const a4 = 1.383577518672690e2;
  const a5 = -3.066479806614716e1;
  const a6 = 2.506628277459239e0;

  const b1 = -5.447609879822406e1;
  const b2 = 1.615858368580409e2;
  const b3 = -1.556989798598866e2;
  const b4 = 6.680131188771972e1;
  const b5 = -1.328068155288572e1;

  // Tail coefficients (polynomials in q)
  const c1 = -7.784894002430293e-3;
  const c2 = -3.223964580411365e-1;
  const c3 = -2.400758277161838e0;
  const c4 = -2.549732539343734e0;
  const c5 = 4.374664141464968e0;
  const c6 = 2.938163982698783e0;

  const d1 = 7.784695709041462e-3;
  const d2 = 3.224671290700398e-1;
  const d3 = 2.445134137142996e0;
  const d4 = 3.754408661907416e0;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    // Lower tail
    const q = Math.sqrt(-2 * Math.log(p));
    const num = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6);
    const den = ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    return num / den;
  } else if (p <= pHigh) {
    // Central region
    const q = p - 0.5;
    const r = q * q;
    const num = (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q;
    const den = (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    return num / den;
  } else {
    // Upper tail
    const q = Math.sqrt(-2 * Math.log(1 - p));
    const num = (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6);
    const den = ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    return -(num / den);
  }
}

// ─── Percentile formatting ──────────────────────────────────────────────────

/** Format a percentile with precision that increases near the extremes */
/** Format a school year (start year) as "YY-YY", e.g. 2024 → "24-25" */
export function formatSchoolYear(startYear: number): string {
  const y2 = String(startYear).slice(-2);
  const yNext = String(startYear + 1).slice(-2);
  return `${y2}-${yNext}`;
}

export function formatPercentile(pct: number): string {
  const d = Math.min(pct, 100 - pct);
  if (d >= 10) return pct.toFixed(1);
  if (d >= 1) return pct.toFixed(2);
  if (d >= 0.1) return pct.toFixed(3);
  return pct.toFixed(4);
}

// ─── SAT → percentile lookups (Nationally Representative) ──────────────────

const SAT_ENG: Record<number, number> = {
  200: 0.5, 210: 0.5, 220: 0.5, 230: 0.5, 240: 0.5, 250: 0.5, 260: 0.5, 270: 0.5, 280: 0.5, 290: 0.5,
  300: 1, 310: 1, 320: 2, 330: 2, 340: 3, 350: 5, 360: 7, 370: 9, 380: 11, 390: 13,
  400: 16, 410: 19, 420: 22, 430: 24, 440: 28, 450: 31, 460: 34, 470: 38, 480: 41, 490: 44,
  500: 48, 510: 51, 520: 55, 530: 58, 540: 62, 550: 65, 560: 68, 570: 71, 580: 74, 590: 76,
  600: 79, 610: 81, 620: 84, 630: 86, 640: 88, 650: 90, 660: 92, 670: 93, 680: 95, 690: 96,
  700: 97, 710: 97, 720: 98, 730: 99, 740: 99, 750: 99, 760: 99.5, 770: 99.5, 780: 99.5, 790: 99.5, 800: 99.5,
};

const SAT_MATH: Record<number, number> = {
  200: 0.5, 210: 0.5, 220: 0.5, 230: 0.5, 240: 0.5, 250: 0.5, 260: 0.5, 270: 0.5, 280: 0.5, 290: 0.5,
  300: 1, 310: 1, 320: 2, 330: 3, 340: 4, 350: 5, 360: 7, 370: 9, 380: 10, 390: 13,
  400: 15, 410: 17, 420: 20, 430: 23, 440: 25, 450: 29, 460: 32, 470: 36, 480: 40, 490: 44,
  500: 47, 510: 52, 520: 57, 530: 61, 540: 65, 550: 68, 560: 71, 570: 73, 580: 76, 590: 79,
  600: 81, 610: 83, 620: 85, 630: 87, 640: 89, 650: 90, 660: 91, 670: 92, 680: 93, 690: 94,
  700: 95, 710: 96, 720: 97, 730: 97, 740: 98, 750: 98, 760: 99, 770: 99, 780: 99, 790: 99.5, 800: 99.5,
};

/** Look up SAT percentile by subject and score */
function satPercentile(subject: Subject, score: number): number {
  const table = subject === 'english' ? SAT_ENG : SAT_MATH;
  const clamped = Math.round(score);
  if (clamped <= 200) return 0.5;
  if (clamped >= 800) return 99.5;
  // Linear interpolation
  const lo = Math.floor(clamped / 10) * 10;
  const hi = lo + 10;
  const pLo = table[lo] ?? table[Math.max(200, lo)];
  const pHi = table[hi] ?? table[Math.min(800, hi)];
  if (pLo === undefined || pHi === undefined) return table[clamped] ?? 50;
  return pLo + ((pHi - pLo) * (clamped - lo)) / 10;
}

// ─── PSAT → percentile (approximate, using SAT-like mapping) ───────────────
// PSAT per-section range: 160–760.  We approximate by mapping onto the SAT scale.
function psatPercentile(subject: Subject, score: number): number {
  // Rough linear mapping from PSAT (160-760) to SAT (200-800)
  const satEquiv = 200 + ((score - 160) / 600) * 600;
  return satPercentile(subject, satEquiv);
}

// ─── SBA (Smarter Balanced) → percentile ───────────────────────────────────
// Source: https://validity.smarterbalanced.org/percentiles/
// HS (Grade 11) data from 2017-18 summative assessment.

type SbaGrade = '3' | '4' | '5' | '6' | '7' | '8' | 'HS';

interface SbaEntry {
  mean: number;
  stdev: number;
  /** percentile → score */
  table: Record<number, number>;
}

const SBA_ELA: Record<SbaGrade, SbaEntry> = {
  '3': { mean: 2425, stdev: 90.6, table: {1:2229,2:2247,3:2259,4:2267,5:2274,10:2302,15:2323,20:2342,25:2358,30:2374,35:2388,40:2402,45:2416,50:2428,55:2440,60:2453,65:2466,70:2478,75:2492,80:2506,85:2523,90:2543,95:2569,96:2577,97:2586,98:2599,99:2619} },
  '4': { mean: 2466, stdev: 96.9, table: {1:2249,2:2270,3:2284,4:2294,5:2303,10:2335,15:2358,20:2378,25:2395,30:2412,35:2428,40:2443,45:2457,50:2471,55:2484,60:2497,65:2510,70:2523,75:2537,80:2552,85:2569,90:2590,95:2620,96:2629,97:2639,98:2654,99:2663} },
  '5': { mean: 2500, stdev: 98.4, table: {1:2279,2:2301,3:2315,4:2327,5:2335,10:2367,15:2391,20:2411,25:2428,30:2445,35:2461,40:2476,45:2490,50:2504,55:2518,60:2532,65:2545,70:2559,75:2573,80:2588,85:2604,90:2625,95:2657,96:2666,97:2677,98:2691,99:2701} },
  '6': { mean: 2521, stdev: 98.1, table: {1:2295,2:2318,3:2334,4:2345,5:2355,10:2388,15:2411,20:2432,25:2451,30:2468,35:2484,40:2499,45:2513,50:2526,55:2539,60:2552,65:2565,70:2579,75:2593,80:2608,85:2625,90:2645,95:2675,96:2683,97:2694,98:2708,99:2724} },
  '7': { mean: 2546, stdev: 101.9, table: {1:2308,2:2331,3:2346,4:2358,5:2367,10:2404,15:2432,20:2456,25:2476,30:2494,35:2511,40:2526,45:2540,50:2554,55:2567,60:2580,65:2593,70:2607,75:2621,80:2636,85:2653,90:2674,95:2705,96:2713,97:2724,98:2737,99:2745} },
  '8': { mean: 2561, stdev: 102.2, table: {1:2329,2:2352,3:2367,4:2379,5:2388,10:2422,15:2447,20:2468,25:2487,30:2505,35:2521,40:2537,45:2552,50:2567,55:2581,60:2595,65:2609,70:2623,75:2638,80:2654,85:2671,90:2691,95:2721,96:2729,97:2740,98:2754,99:2769} },
  'HS': { mean: 2598, stdev: 117.0, table: {1:2318,2:2347,3:2364,4:2378,5:2389,10:2432,15:2464,20:2492,25:2517,30:2538,35:2558,40:2576,45:2593,50:2609,55:2624,60:2639,65:2655,70:2670,75:2686,80:2703,85:2721,90:2744,95:2778,96:2788,97:2795,98:2795,99:2795} },
};

const SBA_MATH: Record<SbaGrade, SbaEntry> = {
  '3': { mean: 2432, stdev: 84.7, table: {1:2222,2:2247,3:2265,4:2278,5:2289,10:2323,15:2345,20:2362,25:2376,30:2389,35:2401,40:2413,45:2424,50:2435,55:2446,60:2456,65:2468,70:2479,75:2491,80:2504,85:2520,90:2540,95:2569,96:2578,97:2588,98:2603,99:2621} },
  '4': { mean: 2471, stdev: 86.3, table: {1:2263,2:2291,3:2308,4:2320,5:2329,10:2360,15:2380,20:2397,25:2411,30:2425,35:2437,40:2449,45:2461,50:2472,55:2483,60:2494,65:2506,70:2518,75:2531,80:2545,85:2562,90:2581,95:2610,96:2619,97:2630,98:2645,99:2659} },
  '5': { mean: 2495, stdev: 94.6, table: {1:2281,2:2305,3:2320,4:2332,5:2341,10:2372,15:2393,20:2410,25:2426,30:2440,35:2455,40:2469,45:2482,50:2496,55:2509,60:2522,65:2535,70:2550,75:2564,80:2580,85:2597,90:2618,95:2647,96:2655,97:2666,98:2681,99:2700} },
  '6': { mean: 2514, stdev: 108.4, table: {1:2239,2:2274,3:2295,4:2310,5:2323,10:2367,15:2398,20:2423,25:2444,30:2462,35:2479,40:2493,45:2507,50:2521,55:2535,60:2547,65:2561,70:2575,75:2589,80:2606,85:2624,90:2648,95:2683,96:2694,97:2707,98:2725,99:2748} },
  '7': { mean: 2528, stdev: 115.0, table: {1:2258,2:2290,3:2308,4:2322,5:2333,10:2373,15:2402,20:2427,25:2448,30:2467,35:2484,40:2501,45:2517,50:2532,55:2547,60:2562,65:2578,70:2594,75:2611,80:2630,85:2651,90:2676,95:2711,96:2722,97:2735,98:2752,99:2778} },
  '8': { mean: 2544, stdev: 124.7, table: {1:2267,2:2295,3:2314,4:2327,5:2338,10:2379,15:2409,20:2434,25:2456,30:2475,35:2492,40:2509,45:2525,50:2542,55:2559,60:2578,65:2596,70:2615,75:2635,80:2657,85:2680,90:2709,95:2752,96:2765,97:2781,98:2802,99:2802} },
  'HS': { mean: 2565, stdev: 127.4, table: {1:2280,2:2310,3:2332,4:2348,5:2360,10:2401,15:2429,20:2452,25:2472,30:2492,35:2511,40:2529,45:2547,50:2564,55:2581,60:2598,65:2616,70:2634,75:2654,80:2676,85:2702,90:2734,95:2780,96:2793,97:2808,98:2828,99:2860} },
};

/** Look up SBA percentile by subject and score, defaulting to HS (grade 11) norms. */
function sbaPercentile(subject: Subject, score: number, grade: SbaGrade = 'HS'): number {
  const entry = subject === 'english' ? SBA_ELA[grade] : SBA_MATH[grade];
  if (!entry) return 50;

  const { table, mean, stdev } = entry;

  // Clamp to table range
  const sortedPcts = Object.keys(table).map(Number).sort((a, b) => a - b);
  const minPct = sortedPcts[0];
  const maxPct = sortedPcts[sortedPcts.length - 1];
  const minScore = table[minPct];
  const maxScore = table[maxPct];

  if (score <= minScore) return minPct / 2; // below table → estimate
  if (score >= maxScore) return (100 + maxPct) / 2; // above table → estimate

  // Find the two bracketing percentile points and interpolate
  for (let i = 0; i < sortedPcts.length - 1; i++) {
    const loPct = sortedPcts[i];
    const hiPct = sortedPcts[i + 1];
    const loScore = table[loPct];
    const hiScore = table[hiPct];
    if (score >= loScore && score < hiScore) {
      const fraction = (score - loScore) / (hiScore - loScore);
      return loPct + fraction * (hiPct - loPct);
    }
  }

  // Fallback: z-score based on normal approximation
  const z = (score - mean) / stdev;
  return normalCdf(z) * 100;
}

// ─── Public test → percentile dispatcher ────────────────────────────────────

export function testPercentile(type: string, subject: Subject, score: number, grade?: number): number {
  switch (type) {
    case 'SAT':
      return satPercentile(subject, score);
    case 'PSAT':
      return psatPercentile(subject, score);
    case 'StateTest':
      return sbaPercentile(subject, score, gradeToSbaGrade(grade));
    default:
      return 50;
  }
}

/** Convert a numeric grade (3-12) to the SBA table grade key. Falls back to HS. */
function gradeToSbaGrade(grade: number | undefined): SbaGrade {
  if (grade !== undefined && grade >= 3 && grade <= 8) return String(grade) as SbaGrade;
  return 'HS';
}

// ─── GPA → percentile ──────────────────────────────────────────────────────
// Assume GPA ~ N(3.4, 0.5²) based on typical HS GPA distributions.
const GPA_MEAN = 3.4;
const GPA_STD = 0.5;

export function gpaPercentile(gpa: number): { zScore: number; percentile: number } {
  const z = (gpa - GPA_MEAN) / GPA_STD;
  return { zScore: z, percentile: normalCdf(z) * 100 };
}

// ─── Rigor (AP count per year) → percentile ─────────────────────────────────
//
// 64.3% of all students take 0 APs (over 4 years of HS).  Among the remaining
// 35.7% who take at least 1, the distribution comes from College Board
// "Four-Year Administration Ranges 2022-2025".
//
// We build a lookup for "AP count → all-student percentile" where 0 APs gets
// the midpoint of the 0-AP group and higher counts map to the midpoints of
// their respective population slices.

const AP_PCT_NO_AP = 64.3; // % of all students who take 0 APs

// Percent distribution of AP takers (the 35.7%)
const AP_TAKER_DIST: [number, number][] = [
  [1, 36.5],
  [2, 19.7],
  [3, 12.8],
  [4, 9.0],
  [5, 6.5],
  [6, 4.7],
  [7, 3.4],
  [8, 2.4],
  [9, 1.5],
  [10, 1.0],
  [11, 0.7],
  [12, 0.4],
  [13, 0.3],
  [14, 0.2],
  [15, 0.3], // "More than 14" → approximate as 15
];

/** Map from integer AP count → percentile (0-100) */
const AP_COUNT_TO_PCT: Record<number, number> = (() => {
  const map: Record<number, number> = {};
  const pctTakers = 100 - AP_PCT_NO_AP; // 35.7

  // 0 APs: midpoint of bottom 64.3%
  map[0] = AP_PCT_NO_AP / 2;

  let cum = AP_PCT_NO_AP;
  for (const [count, pctOfTakers] of AP_TAKER_DIST) {
    const pctAll = pctTakers * (pctOfTakers / 100);
    const nextCum = cum + pctAll;
    map[count] = cum + pctAll / 2;
    cum = nextCum;
  }
  return map;
})();

export function apCountPercentile(apCount: number): number {
  // Clamp to valid range so >15 APs don't fall through to the 0-AP entry
  const clampedCount = Math.min(15, Math.max(0, Math.round(apCount)));
  return AP_COUNT_TO_PCT[clampedCount]!;
}

// ─── Test selection: best available per subject ──────────────────────────
//
// Priority:
//   1. Any SAT (take highest score)
//   2. Any PSAT (take highest score)
//   3. Most recent StateTest

export function pickBestTest(
  tests: TestScore[],
  subject: Subject,
): TestScore | undefined {
  const subjectTests = tests.filter((t) => t.subject === subject);
  if (subjectTests.length === 0) return undefined;

  // SAT (highest score)
  const sats = subjectTests.filter((t) => t.type === 'SAT');
  if (sats.length > 0) {
    sats.sort((a, b) => b.score - a.score);
    return sats[0]!;
  }

  // PSAT (highest score)
  const psats = subjectTests.filter((t) => t.type === 'PSAT');
  if (psats.length > 0) {
    psats.sort((a, b) => b.score - a.score);
    return psats[0]!;
  }

  // StateTest (most recent)
  const states = subjectTests.filter((t) => t.type === 'StateTest');
  if (states.length > 0) {
    states.sort((a, b) => b.year - a.year);
    return states[0]!;
  }

  return undefined;
}

// ─── Build computed rows for the table ─────────────────────────────────────

export interface ComputedOutput {
  rows: ComputedRow[];
  latentPercentile: number;
}

/**
 * Given all raw data, produce the full set of computed rows + the latent
 * percentile.
 */
export function computeAll(
  tests: TestScore[],
  gpa: number | null,
  courseHistory: CourseHistoryEntry[],
): ComputedOutput {
  const rows: ComputedRow[] = [];

  // ── 1. Used English & Math ────────────────────────────────────────────
  const usedEnglish = pickBestTest(tests, 'english');
  const usedMath = pickBestTest(tests, 'math');

  let zEnglish = 0;
  let zMath = 0;

  if (usedEnglish) {
    const pct = testPercentile(usedEnglish.type, 'english', usedEnglish.score, usedEnglish.grade);
    zEnglish = invNormalCdf(pct / 100);
    rows.push({
      label: `English (${usedEnglish.type} ${usedEnglish.year})`,
      raw: usedEnglish.score,
      zScore: zEnglish,
      percentile: pct,
      category: 'english',
      year: String(usedEnglish.year),
      type: usedEnglish.type,
      isUsed: true,
      weight: 0.1,
    });
  }

  if (usedMath) {
    const pct = testPercentile(usedMath.type, 'math', usedMath.score, usedMath.grade);
    zMath = invNormalCdf(pct / 100);
    rows.push({
      label: `Math (${usedMath.type} ${usedMath.year})`,
      raw: usedMath.score,
      zScore: zMath,
      percentile: pct,
      category: 'math',
      year: String(usedMath.year),
      type: usedMath.type,
      isUsed: true,
      weight: 0.1,
    });
  }

  // ── 2. GPA ────────────────────────────────────────────────────────────
  let zGpa = 0;
  if (gpa !== null) {
    const result = gpaPercentile(gpa);
    zGpa = result.zScore;
    rows.push({
      label: 'GPA',
      raw: gpa,
      zScore: zGpa,
      percentile: result.percentile,
      category: 'gpa',
      isUsed: true,
      weight: 0.4,
    });
  }

  // ── 3. Rigor (computed across all years) ─────────────────────────────
  let zRigor = 0;
  if (courseHistory.length > 0) {
    const perYear: { percentile: number; zScore: number }[] = [];

    for (const entry of courseHistory) {
      const pct = apCountPercentile(entry.apCount);
      const z = invNormalCdf(pct / 100);
      perYear.push({ percentile: pct, zScore: z });

      rows.push({
        label: `Rigor ${entry.year}`,
        raw: entry.apCount,
        zScore: z,
        percentile: pct,
        category: 'rigor-year',
        year: entry.year,
      });
    }

    zRigor = perYear.reduce((s, y) => s + y.zScore, 0) / perYear.length;

    // Convert back to percentile
    const rigorPct = normalCdf(zRigor) * 100;
    rows.push({
      label: 'Rigor (all years)',
      raw: courseHistory.reduce((s, e) => s + e.apCount, 0) / courseHistory.length,
      zScore: zRigor,
      percentile: rigorPct,
      category: 'rigor',
      isUsed: true,
      weight: 0.4,
    });
  }

  // ── 4. All other tests (not used as primary) ─────────────────────────
  const usedIds = new Set(
    [usedEnglish, usedMath].filter(Boolean).map((t) => t!.id),
  );
  for (const t of tests) {
    if (usedIds.has(t.id)) continue;
    const pct = testPercentile(t.type, t.subject, t.score, t.grade);
    const z = invNormalCdf(pct / 100);
    const subjLabel = t.subject === 'english' ? 'English' : 'Math';
    rows.push({
      label: `${subjLabel} (${t.type} ${t.year})${t.label ? ` – ${t.label}` : ''}`,
      raw: t.score,
      zScore: z,
      percentile: pct,
      category: 'test',
      year: String(t.year),
      type: t.type,
    });
  }

  // ── 5. Compute latent percentile ──────────────────────────────────────
  // Base weights: English 10%, Math 10%, GPA 40%, Rigor 40%.
  // When a component is missing (its z was never set), redistribute its
  // weight proportionally among the components that DO have data.  This
  // way entering great test scores gives a meaningful latent number even
  // when GPA and/or rigor haven't been entered yet.

  interface WeightedZ {
    z: number;
    weight: number;
  }
  const available: WeightedZ[] = [];

  // Only include components that have real data
  if (usedEnglish) available.push({ z: zEnglish, weight: 0.1 });
  if (usedMath) available.push({ z: zMath, weight: 0.1 });
  if (gpa !== null) available.push({ z: zGpa, weight: 0.4 });
  if (courseHistory.length > 0) available.push({ z: zRigor, weight: 0.4 });

  let latentPercentile = 50;

  if (available.length > 0) {
    // Normalise weights so they sum to 1
    const totalWeight = available.reduce((s, c) => s + c.weight, 0);
    const normalised = available.map((c) => ({
      z: c.z,
      w: c.weight / totalWeight,
    }));

    // Weighted average
    const weightedZ = normalised.reduce((s, c) => s + c.z * c.w, 0);

    // Scale the composite so its std dev = 0.8.
    // But with only one component there's nothing to blend — skip
    // scaling so the latent percentile matches that component directly.
    const normVarSum = normalised.reduce((s, c) => s + c.w * c.w, 0);
    const scale =
      available.length === 1 ? 1 : 0.8 / Math.sqrt(normVarSum);

    const latentZ = weightedZ * scale;
    latentPercentile = normalCdf(latentZ) * 100;
  }

  return { rows, latentPercentile };
}
