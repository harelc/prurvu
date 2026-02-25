import type { AgeGroup, ASFRGroup, CountrySnapshot } from '../types';

const BASE_URL = 'https://population.un.org/dataportalapi/api/v1';
const TOKEN = import.meta.env.VITE_UN_API_TOKEN as string;
const VARIANT = 4; // Median

type CachedEntry = {
  population: AgeGroup[];
  asfr: ASFRGroup[];
  mortality: AgeGroup[];
  sexRatio: number;
  tfr: number;
  birthCalibrationFactor?: number;
};

let cachedData: Record<string, CachedEntry> | null = null;
let cacheLoadAttempted = false;

async function loadCache(): Promise<Record<string, CachedEntry> | null> {
  if (cacheLoadAttempted) return cachedData;
  cacheLoadAttempted = true;
  try {
    const path = '../data/cached-data.json';
    const mod = await import(/* @vite-ignore */ path);
    cachedData = mod.default as Record<string, CachedEntry>;
  } catch {
    // No cached data available
  }
  return cachedData;
}

interface ApiResponse<T> {
  data: T[];
  nextPage?: string | null;
}

async function fetchAllPages<T>(url: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: TOKEN ? { Authorization: TOKEN } : {},
    });
    if (!res.ok) {
      throw new Error(`UN API error: ${res.status} ${res.statusText}`);
    }
    const json: ApiResponse<T> = await res.json();
    results.push(...json.data);
    const next = json.nextPage ?? null;
    nextUrl = next ? next.replace('http://', 'https://') : null;
  }
  return results;
}

// Use the endpoint that supports variants/sexes filters
function dataUrl(indicator: number, locationId: number, year: number, extra: string) {
  return `${BASE_URL}/data/indicators/${indicator}/locations/${locationId}?startYear=${year}&endYear=${year}&variants=${VARIANT}&${extra}&pageSize=100`;
}

interface PopRecord { ageStart: number; sex: string; value: number; }

export async function fetchPopulationByAge(locationId: number, year: number): Promise<AgeGroup[]> {
  const records = await fetchAllPages<PopRecord>(dataUrl(47, locationId, year, 'sexes=1,2'));
  const byAge = new Map<number, { male: number; female: number }>();
  for (const r of records) {
    const age = r.ageStart;
    if (age < 0 || age > 100) continue;
    const entry = byAge.get(age) ?? { male: 0, female: 0 };
    if (r.sex === 'Male') entry.male = r.value;
    else if (r.sex === 'Female') entry.female = r.value;
    byAge.set(age, entry);
  }
  const result: AgeGroup[] = [];
  for (let age = 0; age <= 100; age++) {
    const entry = byAge.get(age) ?? { male: 0, female: 0 };
    result.push({ age, male: entry.male, female: entry.female });
  }
  return result;
}

interface ASFRRecord { ageStart: number; ageEnd: number; value: number; }

export async function fetchASFR(locationId: number, year: number): Promise<ASFRGroup[]> {
  const records = await fetchAllPages<ASFRRecord>(dataUrl(17, locationId, year, 'sexes=3'));
  return records
    .filter(r => r.ageStart >= 15 && r.ageStart <= 45)
    .map(r => ({ ageStart: r.ageStart, ageEnd: r.ageEnd ?? r.ageStart + 5, rate: r.value }))
    .sort((a, b) => a.ageStart - b.ageStart);
}

interface MortRecord { ageStart: number; value: number; }

export async function fetchMortalityByAge(locationId: number, year: number): Promise<AgeGroup[]> {
  const [maleRecs, femaleRecs] = await Promise.all([
    fetchAllPages<MortRecord>(dataUrl(80, locationId, year, 'sexes=1')),
    fetchAllPages<MortRecord>(dataUrl(80, locationId, year, 'sexes=2')),
  ]);
  const maleMap = new Map<number, number>();
  const femaleMap = new Map<number, number>();
  for (const r of maleRecs) { if (r.ageStart >= 0 && r.ageStart <= 100) maleMap.set(r.ageStart, r.value); }
  for (const r of femaleRecs) { if (r.ageStart >= 0 && r.ageStart <= 100) femaleMap.set(r.ageStart, r.value); }

  const result: AgeGroup[] = [];
  for (let age = 0; age <= 100; age++) {
    result.push({ age, male: maleMap.get(age) ?? 0, female: femaleMap.get(age) ?? 0 });
  }
  return result;
}

interface SingleVal { value: number; }

export async function fetchSexRatioAtBirth(locationId: number, year: number): Promise<number> {
  const recs = await fetchAllPages<SingleVal>(dataUrl(58, locationId, year, 'sexes=3'));
  return recs.length > 0 ? recs[0].value : 1.05;
}

export async function fetchTFR(locationId: number, year: number): Promise<number> {
  const recs = await fetchAllPages<SingleVal>(dataUrl(19, locationId, year, 'sexes=3'));
  return recs.length > 0 ? recs[0].value : 2.1;
}

function computeBirthCalibrationFactor(
  population: AgeGroup[],
  asfr: ASFRGroup[],
  mortality: AgeGroup[],
): number {
  // Simulate one year of births from the population to see what ASFR alone produces
  let simulatedBirths = 0;
  for (const group of asfr) {
    let femalePop = 0;
    for (let a = group.ageStart; a < group.ageEnd && a <= 100; a++) {
      const pop = population.find(p => p.age === a);
      femalePop += pop?.female ?? 0;
    }
    simulatedBirths += femalePop * (group.rate / 1000);
  }

  // Actual age-0 cohort from the data (adjusted for infant mortality)
  const age0 = population.find(p => p.age === 0);
  const actualAge0 = (age0?.male ?? 0) + (age0?.female ?? 0);

  // Account for infant mortality: actual births ≈ age0 / (1 - infant_mortality)
  const infantMort = mortality.find(m => m.age === 0);
  const avgInfantMort = infantMort ? (infantMort.male + infantMort.female) / 2 : 0;
  const estimatedActualBirths = actualAge0 / Math.max(1 - avgInfantMort, 0.5);

  if (simulatedBirths <= 0) return 1;
  return estimatedActualBirths / simulatedBirths;
}

export async function fetchAllCountryData(locationId: number, year: number): Promise<CountrySnapshot> {
  if (year === 2024) {
    const cache = await loadCache();
    if (cache) {
      const cached = cache[String(locationId)];
      if (cached) {
        const factor = cached.birthCalibrationFactor
          ?? computeBirthCalibrationFactor(cached.population, cached.asfr, cached.mortality);
        return { locationId, year, ...cached, birthCalibrationFactor: factor };
      }
    }
  }

  const [population, asfr, mortality, sexRatio, tfr] = await Promise.all([
    fetchPopulationByAge(locationId, year),
    fetchASFR(locationId, year),
    fetchMortalityByAge(locationId, year),
    fetchSexRatioAtBirth(locationId, year),
    fetchTFR(locationId, year),
  ]);

  const birthCalibrationFactor = computeBirthCalibrationFactor(population, asfr, mortality);

  return { locationId, year, population, asfr, mortality, sexRatio, tfr, birthCalibrationFactor };
}
