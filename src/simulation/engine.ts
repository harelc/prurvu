import type { CountrySnapshot, AgeGroup, ASFRGroup } from '../types';

const MAX_AGE = 100;

export interface SimulationParams {
  userTFR?: number;
  mortalityMultiplier?: number; // 0.5–1.5 (default 1.0)
  userSexRatio?: number; // override sex ratio at birth
  tfrConvergenceRate?: number; // 0.0–1.0: fraction of gap closed per year (1 = instant)
}

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

export function stepForward(
  snapshot: CountrySnapshot,
  params: SimulationParams = {}
): CountrySnapshot {
  const {
    userTFR,
    mortalityMultiplier = 1,
    userSexRatio,
    tfrConvergenceRate = 1,
  } = params;

  const { population, asfr, mortality, sexRatio, birthCalibrationFactor } = snapshot;

  // Build indexed lookups
  const popIdx = buildIndex(population);
  const mortIdx = buildIndex(mortality);

  // Determine effective TFR with convergence rate
  const baseTFR = computeBaseTFR(asfr);
  let effectiveTFR: number;
  if (userTFR != null) {
    const currentTFR = snapshot.currentTFR ?? snapshot.tfr;
    if (tfrConvergenceRate >= 1) {
      effectiveTFR = userTFR;
    } else {
      effectiveTFR = currentTFR + (userTFR - currentTFR) * tfrConvergenceRate;
    }
  } else {
    effectiveTFR = snapshot.currentTFR ?? snapshot.tfr;
  }

  // Scale ASFR based on effective TFR
  const scaleFactor = baseTFR > 0 ? effectiveTFR / baseTFR : 1;
  const effectiveASFR = scaleFactor !== 1 ? scaleASFR(asfr, scaleFactor) : asfr;

  // 1. DEATHS: compute survivors for each age with mortality multiplier
  const survivors: AgeGroup[] = new Array(MAX_AGE + 1);
  for (let age = 0; age <= MAX_AGE; age++) {
    const p = popIdx[age];
    const m = mortIdx[age];
    const mMale = Math.min(m.male * mortalityMultiplier, 1);
    const mFemale = Math.min(m.female * mortalityMultiplier, 1);
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
