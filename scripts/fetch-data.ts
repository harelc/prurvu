/**
 * Build-time script to fetch UN WPP data for all countries.
 * Run with: npx tsx scripts/fetch-data.ts [limit]
 * Requires VITE_UN_API_TOKEN in env
 */
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://population.un.org/dataportalapi/api/v1';
const TOKEN = process.env.VITE_UN_API_TOKEN ?? '';
const YEAR = 2024;
const VARIANT = 4; // Median

const COUNTRIES = [
  { id: 840, name: 'United States' }, { id: 392, name: 'Japan' }, { id: 566, name: 'Nigeria' },
  { id: 356, name: 'India' }, { id: 156, name: 'China' }, { id: 276, name: 'Germany' },
  { id: 76, name: 'Brazil' }, { id: 826, name: 'United Kingdom' }, { id: 643, name: 'Russia' },
  { id: 410, name: 'South Korea' }, { id: 376, name: 'Israel' }, { id: 36, name: 'Australia' },
  { id: 250, name: 'France' }, { id: 380, name: 'Italy' }, { id: 724, name: 'Spain' },
  { id: 158, name: 'Taiwan' }, { id: 360, name: 'Indonesia' }, { id: 608, name: 'Philippines' },
  { id: 704, name: 'Vietnam' }, { id: 764, name: 'Thailand' }, { id: 104, name: 'Myanmar' },
  { id: 458, name: 'Malaysia' }, { id: 702, name: 'Singapore' },
  { id: 586, name: 'Pakistan' }, { id: 50, name: 'Bangladesh' }, { id: 4, name: 'Afghanistan' },
  { id: 792, name: 'Turkey' }, { id: 364, name: 'Iran' }, { id: 682, name: 'Saudi Arabia' },
  { id: 368, name: 'Iraq' }, { id: 784, name: 'UAE' },
  { id: 818, name: 'Egypt' },
  { id: 528, name: 'Netherlands' }, { id: 56, name: 'Belgium' }, { id: 756, name: 'Switzerland' },
  { id: 40, name: 'Austria' }, { id: 372, name: 'Ireland' }, { id: 620, name: 'Portugal' },
  { id: 300, name: 'Greece' }, { id: 752, name: 'Sweden' }, { id: 578, name: 'Norway' },
  { id: 208, name: 'Denmark' }, { id: 246, name: 'Finland' }, { id: 616, name: 'Poland' },
  { id: 804, name: 'Ukraine' }, { id: 642, name: 'Romania' }, { id: 203, name: 'Czech Republic' },
  { id: 348, name: 'Hungary' },
  { id: 124, name: 'Canada' }, { id: 484, name: 'Mexico' }, { id: 192, name: 'Cuba' },
  { id: 32, name: 'Argentina' }, { id: 170, name: 'Colombia' },
  { id: 604, name: 'Peru' }, { id: 862, name: 'Venezuela' }, { id: 152, name: 'Chile' },
  { id: 504, name: 'Morocco' }, { id: 12, name: 'Algeria' },
  { id: 231, name: 'Ethiopia' }, { id: 710, name: 'South Africa' }, { id: 404, name: 'Kenya' },
  { id: 834, name: 'Tanzania' }, { id: 180, name: 'DR Congo' }, { id: 288, name: 'Ghana' },
  { id: 508, name: 'Mozambique' }, { id: 450, name: 'Madagascar' }, { id: 24, name: 'Angola' },
  { id: 120, name: 'Cameroon' }, { id: 554, name: 'New Zealand' },
];

interface ApiResponse {
  data: Record<string, unknown>[];
  nextPage?: string | null;
}

async function fetchAllPages(url: string): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: TOKEN },
    });
    if (!res.ok) {
      throw new Error(`API ${res.status} ${res.statusText} — ${nextUrl}`);
    }
    const json: ApiResponse = await res.json();
    results.push(...json.data);
    const next = json.nextPage ?? null;
    nextUrl = next ? next.replace('http://', 'https://') : null;
  }
  return results;
}

// Use the first endpoint format which supports variants/sexes/startAge/endAge filters
function dataUrl(indicator: number, locationId: number, extra: string) {
  return `${BASE_URL}/data/indicators/${indicator}/locations/${locationId}?startYear=${YEAR}&endYear=${YEAR}&variants=${VARIANT}&${extra}&pageSize=100`;
}

interface AgeGroup { age: number; male: number; female: number; }
interface ASFRGroup { ageStart: number; ageEnd: number; rate: number; }

async function fetchCountryData(locationId: number) {
  // Population by single-year age & sex (indicator 47)
  const popRecords = await fetchAllPages(dataUrl(47, locationId, 'sexes=1,2'));
  const popByAge = new Map<number, { male: number; female: number }>();
  for (const r of popRecords) {
    const age = r.ageStart as number;
    if (age < 0 || age > 100) continue;
    const entry = popByAge.get(age) ?? { male: 0, female: 0 };
    if (r.sex === 'Male') entry.male = r.value as number;
    else if (r.sex === 'Female') entry.female = r.value as number;
    popByAge.set(age, entry);
  }
  const population: AgeGroup[] = [];
  for (let age = 0; age <= 100; age++) {
    const entry = popByAge.get(age) ?? { male: 0, female: 0 };
    population.push({ age, male: Math.round(entry.male), female: Math.round(entry.female) });
  }

  // ASFR (indicator 17) — only for females (sex 2)
  const asfrRecords = await fetchAllPages(dataUrl(17, locationId, 'sexes=3'));
  const asfr: ASFRGroup[] = asfrRecords
    .filter(r => (r.ageStart as number) >= 15 && (r.ageStart as number) <= 45)
    .map(r => ({
      ageStart: r.ageStart as number,
      ageEnd: (r.ageEnd as number) ?? (r.ageStart as number) + 5,
      rate: r.value as number,
    }))
    .sort((a, b) => a.ageStart - b.ageStart);

  // Mortality by age & sex (indicator 80)
  const [mortMale, mortFemale] = await Promise.all([
    fetchAllPages(dataUrl(80, locationId, 'sexes=1')),
    fetchAllPages(dataUrl(80, locationId, 'sexes=2')),
  ]);
  const maleMap = new Map<number, number>();
  const femaleMap = new Map<number, number>();
  for (const r of mortMale) {
    const age = r.ageStart as number;
    if (age >= 0 && age <= 100) maleMap.set(age, r.value as number);
  }
  for (const r of mortFemale) {
    const age = r.ageStart as number;
    if (age >= 0 && age <= 100) femaleMap.set(age, r.value as number);
  }
  const mortality: AgeGroup[] = [];
  for (let age = 0; age <= 100; age++) {
    mortality.push({
      age,
      male: Math.round((maleMap.get(age) ?? 0) * 1e6) / 1e6,
      female: Math.round((femaleMap.get(age) ?? 0) * 1e6) / 1e6,
    });
  }

  // Sex ratio at birth (indicator 58)
  const srRecords = await fetchAllPages(dataUrl(58, locationId, 'sexes=3'));
  const sexRatio = srRecords.length > 0 ? (srRecords[0].value as number) : 1.05;

  // TFR (indicator 19)
  const tfrRecords = await fetchAllPages(dataUrl(19, locationId, 'sexes=3'));
  const tfr = tfrRecords.length > 0 ? (tfrRecords[0].value as number) : 2.1;

  return {
    population, asfr, mortality,
    sexRatio: Math.round(sexRatio * 1000) / 1000,
    tfr: Math.round(tfr * 1000) / 1000,
  };
}

async function main() {
  if (!TOKEN) {
    console.error('Missing VITE_UN_API_TOKEN env var');
    process.exit(1);
  }

  const limit = parseInt(process.argv[2] ?? '0') || COUNTRIES.length;
  const toFetch = COUNTRIES.slice(0, limit);
  console.log(`Fetching data for ${toFetch.length} countries (year ${YEAR})...`);

  // Load existing cached data so we can merge
  const outPath = path.join(process.cwd(), 'src', 'data', 'cached-data.json');
  let allData: Record<string, unknown> = {};
  try {
    allData = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    console.log(`  Loaded existing cache with ${Object.keys(allData).length} countries`);
  } catch { /* no existing cache */ }

  let done = 0;
  for (const country of toFetch) {
    if (allData[String(country.id)]) {
      console.log(`  [${++done}/${toFetch.length}] ${country.name} — cached, skipping`);
      continue;
    }
    try {
      console.log(`  [${++done}/${toFetch.length}] ${country.name}...`);
      const data = await fetchCountryData(country.id);
      allData[String(country.id)] = data;
      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`  FAILED: ${country.name} — ${err}`);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(allData));
  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`\nWritten ${Object.keys(allData).length} countries to ${outPath} (${sizeMB} MB)`);
}

main();
