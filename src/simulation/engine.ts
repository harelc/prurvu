import type { CountrySnapshot, AgeGroup, ASFRGroup } from '../types';

const MAX_AGE = 100;

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

export function stepForward(
  snapshot: CountrySnapshot,
  userTFR?: number
): CountrySnapshot {
  const { population, asfr, mortality, sexRatio } = snapshot;

  // Optionally scale ASFR based on user TFR
  const baseTFR = computeBaseTFR(asfr);
  const scaleFactor = userTFR != null && baseTFR > 0 ? userTFR / baseTFR : 1;
  const effectiveASFR = scaleFactor !== 1 ? scaleASFR(asfr, scaleFactor) : asfr;

  // 1. DEATHS: compute survivors for each age
  const survivors: AgeGroup[] = population.map(({ age, male, female }) => {
    const mortalityEntry = mortality.find(m => m.age === age);
    const mMale = mortalityEntry?.male ?? 0;
    const mFemale = mortalityEntry?.female ?? 0;
    return {
      age,
      male: male * (1 - Math.min(mMale, 1)),
      female: female * (1 - Math.min(mFemale, 1)),
    };
  });

  // 2. AGING: shift everyone up one year
  const newPopulation: AgeGroup[] = [];

  // Age 0 will be filled by births
  newPopulation.push({ age: 0, male: 0, female: 0 });

  for (let age = 1; age <= MAX_AGE; age++) {
    const prev = survivors.find(s => s.age === age - 1);
    if (age === MAX_AGE) {
      // Open-ended: accumulate 99->100 + existing 100
      const existing100 = survivors.find(s => s.age === MAX_AGE);
      newPopulation.push({
        age: MAX_AGE,
        male: (prev?.male ?? 0) + (existing100?.male ?? 0),
        female: (prev?.female ?? 0) + (existing100?.female ?? 0),
      });
    } else {
      newPopulation.push({
        age,
        male: prev?.male ?? 0,
        female: prev?.female ?? 0,
      });
    }
  }

  // 3. BIRTHS: apply ASFR to female population aged 15-49
  let totalBirths = 0;
  for (const group of effectiveASFR) {
    let femalePop = 0;
    for (let a = group.ageStart; a < group.ageEnd && a <= MAX_AGE; a++) {
      const pop = population.find(p => p.age === a);
      femalePop += pop?.female ?? 0;
    }
    // Rate is per 1000 women per year, for a 5-year age group
    // Each woman in the group has rate/1000 probability of having a birth this year
    totalBirths += femalePop * (group.rate / 1000);
  }

  const maleBirths = totalBirths * (sexRatio / (1 + sexRatio));
  const femaleBirths = totalBirths * (1 / (1 + sexRatio));

  newPopulation[0] = { age: 0, male: maleBirths, female: femaleBirths };

  const effectiveTFR = userTFR ?? snapshot.tfr;

  return {
    locationId: snapshot.locationId,
    year: snapshot.year + 1,
    population: newPopulation,
    asfr: snapshot.asfr, // keep original ASFR (scaling applied dynamically)
    mortality: snapshot.mortality,
    sexRatio: snapshot.sexRatio,
    tfr: effectiveTFR,
  };
}

export function simulateYears(
  baseSnapshot: CountrySnapshot,
  years: number,
  userTFR?: number
): CountrySnapshot {
  let current = baseSnapshot;
  for (let i = 0; i < years; i++) {
    current = stepForward(current, userTFR);
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
