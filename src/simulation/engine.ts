import type { CountrySnapshot, AgeGroup, ASFRGroup } from '../types';

const MAX_AGE = 100;

export interface SimulationParams {
  userTFR?: number;
  mortalityMultiplier?: number; // 0.5–1.5 (default 1.0)
  userSexRatio?: number; // override sex ratio at birth
  tfrConvergenceRate?: number; // 0.0–1.0: fraction of gap closed per year (1 = instant)
  mortalityImprovementRate?: number; // 0–0.03: annual compounding mortality reduction
  netMigrationRate?: number; // -0.02 to +0.02: fraction of total pop per year
  asfrShiftYears?: number; // -5 to +10: shift ASFR age schedule
  tfrPath?: { year: number; tfr: number }[]; // custom TFR path (overrides userTFR + convergence)
}

// Simplified Rogers-Castro migration age profile (101 weights, sum ≈ 1.0)
const MIGRATION_AGE_PROFILE: number[] = (() => {
  const raw: number[] = [];
  for (let age = 0; age <= MAX_AGE; age++) {
    let w: number;
    if (age <= 4) w = 0.012;        // children moving with parents
    else if (age <= 9) w = 0.008;
    else if (age <= 14) w = 0.005;   // dip in teens
    else if (age <= 19) w = 0.015;
    else if (age <= 24) w = 0.025;   // peak working-age migration
    else if (age <= 29) w = 0.028;
    else if (age <= 34) w = 0.022;
    else if (age <= 39) w = 0.015;
    else if (age <= 44) w = 0.010;
    else if (age <= 49) w = 0.007;
    else if (age <= 54) w = 0.005;
    else if (age <= 59) w = 0.003;
    else if (age <= 64) w = 0.002;
    else w = 0.001;                  // near zero after 65
    raw.push(w);
  }
  const total = raw.reduce((s, v) => s + v, 0);
  return raw.map(v => v / total); // normalize to sum to 1.0
})();

export function computeBaseTFR(asfr: ASFRGroup[]): number {
  let sum = 0;
  for (const group of asfr) {
    sum += group.rate;
  }
  // Each group spans 5 years, rate is per 1000 women
  return (sum * 5) / 1000;
}

function scaleASFR(asfr: ASFRGroup[], scaleFactor: number): ASFRGroup[] {
  return asfr.map(g => ({ ...g, rate: g.rate * scaleFactor }));
}

function shiftASFR(asfr: ASFRGroup[], shiftYears: number): ASFRGroup[] {
  if (shiftYears === 0) return asfr;
  return asfr
    .map(g => ({
      ...g,
      ageStart: g.ageStart + shiftYears,
      ageEnd: g.ageEnd + shiftYears,
    }))
    .filter(g => g.ageEnd > 15 && g.ageStart < 50) // biologically plausible
    .map(g => ({
      ...g,
      ageStart: Math.max(15, g.ageStart),
      ageEnd: Math.min(50, g.ageEnd),
    }));
}

// Build indexed arrays for O(1) lookups (ages 0–100)
function buildIndex(groups: AgeGroup[]): AgeGroup[] {
  const indexed: AgeGroup[] = new Array(MAX_AGE + 1);
  for (let i = 0; i <= MAX_AGE; i++) {
    indexed[i] = { age: i, male: 0, female: 0 };
  }
  for (const g of groups) {
    if (g.age >= 0 && g.age <= MAX_AGE) {
      indexed[g.age] = g;
    }
  }
  return indexed;
}

export function getEffectiveASFR(
  asfr: ASFRGroup[],
  effectiveTFR: number,
  asfrShiftYears: number = 0
): ASFRGroup[] {
  let shifted = shiftASFR(asfr, asfrShiftYears);
  const baseTFR = computeBaseTFR(shifted);
  const scaleFactor = baseTFR > 0 ? effectiveTFR / baseTFR : 1;
  return scaleFactor !== 1 ? scaleASFR(shifted, scaleFactor) : shifted;
}

export function stepForward(
  snapshot: CountrySnapshot,
  params: SimulationParams = {}
): CountrySnapshot {
  const {
    userTFR,
    mortalityMultiplier = 1,
    userSexRatio,
    tfrConvergenceRate = 1,
    mortalityImprovementRate = 0,
    netMigrationRate = 0,
    asfrShiftYears = 0,
    tfrPath,
  } = params;

  const { population, asfr, mortality, sexRatio, birthCalibrationFactor } = snapshot;

  // Build indexed lookups
  const popIdx = buildIndex(population);
  const mortIdx = buildIndex(mortality);

  // Mortality improvement: compound the accumulated factor
  const prevImprovement = snapshot.mortalityImprovementAccumulated ?? 1;
  const improvementFactor = prevImprovement * (1 - mortalityImprovementRate);

  // Determine effective TFR
  let effectiveTFR: number;
  const nextYear = snapshot.year + 1;

  if (tfrPath && tfrPath.length > 0) {
    // Custom TFR path mode: look up TFR for this year
    const exact = tfrPath.find(p => p.year === nextYear);
    if (exact) {
      effectiveTFR = exact.tfr;
    } else {
      // Find surrounding points and linearly interpolate
      const sorted = tfrPath;
      if (nextYear <= sorted[0].year) {
        effectiveTFR = sorted[0].tfr;
      } else if (nextYear >= sorted[sorted.length - 1].year) {
        effectiveTFR = sorted[sorted.length - 1].tfr;
      } else {
        let lo = 0;
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].year <= nextYear && sorted[i + 1].year >= nextYear) {
            lo = i;
            break;
          }
        }
        const t = (nextYear - sorted[lo].year) / (sorted[lo + 1].year - sorted[lo].year);
        effectiveTFR = sorted[lo].tfr + t * (sorted[lo + 1].tfr - sorted[lo].tfr);
      }
    }
  } else if (userTFR != null) {
    // Convergence mode
    const currentTFR = snapshot.currentTFR ?? snapshot.tfr;
    if (tfrConvergenceRate >= 1) {
      effectiveTFR = userTFR;
    } else {
      effectiveTFR = currentTFR + (userTFR - currentTFR) * tfrConvergenceRate;
    }
  } else {
    effectiveTFR = snapshot.currentTFR ?? snapshot.tfr;
  }

  // Apply ASFR shift then scale by effective TFR
  const shiftedASFR = shiftASFR(asfr, asfrShiftYears);
  const shiftedBaseTFR = computeBaseTFR(shiftedASFR);
  const scaleFactor = shiftedBaseTFR > 0 ? effectiveTFR / shiftedBaseTFR : 1;
  const effectiveASFR = scaleFactor !== 1 ? scaleASFR(shiftedASFR, scaleFactor) : shiftedASFR;

  // 1. DEATHS: compute survivors for each age with mortality multiplier + improvement
  const survivors: AgeGroup[] = new Array(MAX_AGE + 1);
  for (let age = 0; age <= MAX_AGE; age++) {
    const p = popIdx[age];
    const m = mortIdx[age];
    const mMale = Math.min(m.male * mortalityMultiplier * improvementFactor, 1);
    const mFemale = Math.min(m.female * mortalityMultiplier * improvementFactor, 1);
    survivors[age] = {
      age,
      male: p.male * (1 - mMale),
      female: p.female * (1 - mFemale),
    };
  }

  // 2. AGING: shift everyone up one year
  const newPopulation: AgeGroup[] = new Array(MAX_AGE + 1);

  // Age 0 will be filled by births
  newPopulation[0] = { age: 0, male: 0, female: 0 };

  for (let age = 1; age <= MAX_AGE; age++) {
    const prev = survivors[age - 1];
    if (age === MAX_AGE) {
      // Open-ended: accumulate 99->100 + existing 100
      const existing100 = survivors[MAX_AGE];
      newPopulation[MAX_AGE] = {
        age: MAX_AGE,
        male: prev.male + existing100.male,
        female: prev.female + existing100.female,
      };
    } else {
      newPopulation[age] = {
        age,
        male: prev.male,
        female: prev.female,
      };
    }
  }

  // 3. BIRTHS: apply ASFR to female population aged 15-49
  let totalBirths = 0;
  for (const group of effectiveASFR) {
    let femalePop = 0;
    for (let a = group.ageStart; a < group.ageEnd && a <= MAX_AGE; a++) {
      femalePop += popIdx[a].female;
    }
    totalBirths += femalePop * (group.rate / 1000);
  }

  // Apply birth calibration factor
  totalBirths *= birthCalibrationFactor;

  // Apply sex ratio (user override or data)
  const effectiveSexRatio = userSexRatio ?? sexRatio;
  const maleBirths = totalBirths * (effectiveSexRatio / (1 + effectiveSexRatio));
  const femaleBirths = totalBirths * (1 / (1 + effectiveSexRatio));

  newPopulation[0] = { age: 0, male: maleBirths, female: femaleBirths };

  // 4. NET MIGRATION: distribute migrants by age profile
  if (netMigrationRate !== 0) {
    const totalPop = newPopulation.reduce((s, g) => s + g.male + g.female, 0);
    const totalMigrants = totalPop * netMigrationRate;
    for (let age = 0; age <= MAX_AGE; age++) {
      const migrants = totalMigrants * MIGRATION_AGE_PROFILE[age];
      // Split 50/50 male/female
      newPopulation[age] = {
        age,
        male: Math.max(0, newPopulation[age].male + migrants / 2),
        female: Math.max(0, newPopulation[age].female + migrants / 2),
      };
    }
  }

  return {
    locationId: snapshot.locationId,
    year: snapshot.year + 1,
    population: newPopulation,
    asfr: snapshot.asfr, // keep original ASFR (scaling applied dynamically)
    mortality: snapshot.mortality,
    sexRatio: snapshot.sexRatio,
    tfr: effectiveTFR,
    birthCalibrationFactor,
    currentTFR: effectiveTFR,
    mortalityImprovementAccumulated: improvementFactor,
  };
}

export function simulateYears(
  baseSnapshot: CountrySnapshot,
  years: number,
  params: SimulationParams = {}
): CountrySnapshot {
  let current = baseSnapshot;
  for (let i = 0; i < years; i++) {
    current = stepForward(current, params);
  }
  return current;
}

export function getTotalPopulation(population: AgeGroup[]): number {
  return population.reduce((sum, g) => sum + g.male + g.female, 0);
}

export function getMedianAge(population: AgeGroup[]): number {
  const total = getTotalPopulation(population);
  let cumulative = 0;
  for (const g of population) {
    cumulative += g.male + g.female;
    if (cumulative >= total / 2) return g.age;
  }
  return 50;
}

export function getDependencyRatio(population: AgeGroup[]): number {
  let young = 0;
  let working = 0;
  let old = 0;
  for (const g of population) {
    const total = g.male + g.female;
    if (g.age < 15) young += total;
    else if (g.age < 65) working += total;
    else old += total;
  }
  return working > 0 ? ((young + old) / working) * 100 : 0;
}
