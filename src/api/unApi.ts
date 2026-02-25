import type { AgeGroup, ASFRGroup, CountrySnapshot } from '../types';

const BASE_URL = 'https://population.un.org/dataportalapi/api/v1';
const TOKEN = import.meta.env.VITE_UN_API_TOKEN as string;

type CachedEntry = {
  population: AgeGroup[];
  asfr: ASFRGroup[];
  mortality: AgeGroup[];
  sexRatio: number;
  tfr: number;
};

let cachedData: Record<string, CachedEntry> | null = null;
let cacheLoadAttempted = false;

async function loadCache(): Promise<Record<string, CachedEntry> | null> {
  if (cacheLoadAttempted) return cachedData;
  cacheLoadAttempted = true;
  try {
    // Dynamic import with variable to prevent TS from resolving at compile time
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
    nextUrl = json.nextPage ?? null;
  }

  return results;
}

interface PopRecord {
  ageStart: number;
  sex: string;
  value: number;
}

export async function fetchPopulationByAge(
  locationId: number,
  year: number
): Promise<AgeGroup[]> {
  const url = `${BASE_URL}/data/indicators/47/locations/${locationId}/start/${year}/end/${year}?variant=4&sexId=1,2&pageSize=100`;
  const records = await fetchAllPages<PopRecord>(url);

  const byAge = new Map<number, { male: number; female: number }>();
  for (const r of records) {
    const age = r.ageStart;
    if (age < 0 || age > 100) continue;
    const entry = byAge.get(age) ?? { male: 0, female: 0 };
    if (r.sex === 'Male') entry.male = r.value * 1000;
    else if (r.sex === 'Female') entry.female = r.value * 1000;
    byAge.set(age, entry);
  }

  const result: AgeGroup[] = [];
  for (let age = 0; age <= 100; age++) {
    const entry = byAge.get(age) ?? { male: 0, female: 0 };
    result.push({ age, male: entry.male, female: entry.female });
  }
  return result;
}

interface ASFRRecord {
  ageStart: number;
  ageEnd: number;
  value: number;
}

export async function fetchASFR(
  locationId: number,
  year: number
): Promise<ASFRGroup[]> {
  const url = `${BASE_URL}/data/indicators/17/locations/${locationId}/start/${year}/end/${year}?variant=4&pageSize=100`;
  const records = await fetchAllPages<ASFRRecord>(url);

  return records
    .filter(r => r.ageStart >= 15 && r.ageStart <= 45)
    .map(r => ({
      ageStart: r.ageStart,
      ageEnd: r.ageEnd ?? r.ageStart + 5,
      rate: r.value,
    }))
    .sort((a, b) => a.ageStart - b.ageStart);
}

interface MortalityRecord {
  ageStart: number;
  sex: string;
  value: number;
}

export async function fetchMortalityByAge(
  locationId: number,
  year: number
): Promise<AgeGroup[]> {
  const urlMale = `${BASE_URL}/data/indicators/80/locations/${locationId}/start/${year}/end/${year}?variant=4&sexId=1&pageSize=100`;
  const urlFemale = `${BASE_URL}/data/indicators/80/locations/${locationId}/start/${year}/end/${year}?variant=4&sexId=2&pageSize=100`;

  const [maleRecords, femaleRecords] = await Promise.all([
    fetchAllPages<MortalityRecord>(urlMale),
    fetchAllPages<MortalityRecord>(urlFemale),
  ]);

  const maleMap = new Map<number, number>();
  const femaleMap = new Map<number, number>();

  for (const r of maleRecords) {
    if (r.ageStart >= 0 && r.ageStart <= 100) maleMap.set(r.ageStart, r.value);
  }
  for (const r of femaleRecords) {
    if (r.ageStart >= 0 && r.ageStart <= 100) femaleMap.set(r.ageStart, r.value);
  }

  const result: AgeGroup[] = [];
  for (let age = 0; age <= 100; age++) {
    result.push({
      age,
      male: maleMap.get(age) ?? 0,
      female: femaleMap.get(age) ?? 0,
    });
  }
  return result;
}

interface SingleValueRecord {
  value: number;
}

export async function fetchSexRatioAtBirth(
  locationId: number,
  year: number
): Promise<number> {
  const url = `${BASE_URL}/data/indicators/58/locations/${locationId}/start/${year}/end/${year}?variant=4&pageSize=100`;
  const records = await fetchAllPages<SingleValueRecord>(url);
  return records.length > 0 ? records[0].value : 1.05;
}

export async function fetchTFR(
  locationId: number,
  year: number
): Promise<number> {
  const url = `${BASE_URL}/data/indicators/19/locations/${locationId}/start/${year}/end/${year}?variant=4&pageSize=100`;
  const records = await fetchAllPages<SingleValueRecord>(url);
  return records.length > 0 ? records[0].value : 2.1;
}

export async function fetchAllCountryData(
  locationId: number,
  year: number
): Promise<CountrySnapshot> {
  // Check cached data first (for base year 2024)
  if (year === 2024) {
    const cache = await loadCache();
    if (cache) {
      const cached = cache[String(locationId)];
      if (cached) {
        return {
          locationId,
          year,
          population: cached.population,
          asfr: cached.asfr,
          mortality: cached.mortality,
          sexRatio: cached.sexRatio,
          tfr: cached.tfr,
        };
      }
    }
  }

  // Fall back to API
  const [population, asfr, mortality, sexRatio, tfr] = await Promise.all([
    fetchPopulationByAge(locationId, year),
    fetchASFR(locationId, year),
    fetchMortalityByAge(locationId, year),
    fetchSexRatioAtBirth(locationId, year),
    fetchTFR(locationId, year),
  ]);

  return { locationId, year, population, asfr, mortality, sexRatio, tfr };
}
