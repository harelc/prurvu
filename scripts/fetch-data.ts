/**
 * Build-time script to fetch UN WPP data for all countries.
 * Run with: npx tsx scripts/fetch-data.ts
 * Requires VITE_UN_API_TOKEN in .env
 */
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://population.un.org/dataportalapi/api/v1';
const TOKEN = process.env.VITE_UN_API_TOKEN ?? '';
const YEAR = 2024;

// Same country list as in the app
const COUNTRIES = [
  { id: 156, name: 'China' }, { id: 392, name: 'Japan' }, { id: 410, name: 'South Korea' },
  { id: 158, name: 'Taiwan' }, { id: 360, name: 'Indonesia' }, { id: 608, name: 'Philippines' },
  { id: 704, name: 'Vietnam' }, { id: 764, name: 'Thailand' }, { id: 104, name: 'Myanmar' },
  { id: 458, name: 'Malaysia' }, { id: 702, name: 'Singapore' }, { id: 356, name: 'India' },
  { id: 586, name: 'Pakistan' }, { id: 50, name: 'Bangladesh' }, { id: 4, name: 'Afghanistan' },
  { id: 792, name: 'Turkey' }, { id: 364, name: 'Iran' }, { id: 682, name: 'Saudi Arabia' },
  { id: 368, name: 'Iraq' }, { id: 784, name: 'UAE' }, { id: 376, name: 'Israel' },
  { id: 818, name: 'Egypt' }, { id: 276, name: 'Germany' }, { id: 250, name: 'France' },
  { id: 826, name: 'United Kingdom' }, { id: 380, name: 'Italy' }, { id: 724, name: 'Spain' },
  { id: 528, name: 'Netherlands' }, { id: 56, name: 'Belgium' }, { id: 756, name: 'Switzerland' },
  { id: 40, name: 'Austria' }, { id: 372, name: 'Ireland' }, { id: 620, name: 'Portugal' },
  { id: 300, name: 'Greece' }, { id: 752, name: 'Sweden' }, { id: 578, name: 'Norway' },
  { id: 208, name: 'Denmark' }, { id: 246, name: 'Finland' }, { id: 616, name: 'Poland' },
  { id: 804, name: 'Ukraine' }, { id: 642, name: 'Romania' }, { id: 203, name: 'Czech Republic' },
  { id: 348, name: 'Hungary' }, { id: 643, name: 'Russia' }, { id: 840, name: 'United States' },
  { id: 124, name: 'Canada' }, { id: 484, name: 'Mexico' }, { id: 192, name: 'Cuba' },
  { id: 76, name: 'Brazil' }, { id: 32, name: 'Argentina' }, { id: 170, name: 'Colombia' },
  { id: 604, name: 'Peru' }, { id: 862, name: 'Venezuela' }, { id: 152, name: 'Chile' },
  { id: 504, name: 'Morocco' }, { id: 12, name: 'Algeria' }, { id: 566, name: 'Nigeria' },
  { id: 231, name: 'Ethiopia' }, { id: 710, name: 'South Africa' }, { id: 404, name: 'Kenya' },
  { id: 834, name: 'Tanzania' }, { id: 180, name: 'DR Congo' }, { id: 288, name: 'Ghana' },
  { id: 508, name: 'Mozambique' }, { id: 450, name: 'Madagascar' }, { id: 24, name: 'Angola' },
  { id: 120, name: 'Cameroon' }, { id: 36, name: 'Australia' }, { id: 554, name: 'New Zealand' },
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
      throw new Error(`API error: ${res.status} ${res.statusText} for ${nextUrl}`);
    }
    const json: ApiResponse = await res.json();
    results.push(...json.data);
    nextUrl = json.nextPage ?? null;
  }
  return results;
}

interface AgeGroup { age: number; male: number; female: number; }
interface ASFRGroup { ageStart: number; ageEnd: number; rate: number; }

async function fetchCountryData(locationId: number) {
  // Population by single-year age & sex
  const popUrl = `${BASE_URL}/data/indicators/47/locations/${locationId}/start/${YEAR}/end/${YEAR}?variant=4&sexId=1,2&pageSize=100`;
  const popRecords = await fetchAllPages(popUrl);

  const popByAge = new Map<number, { male: number; female: number }>();
  for (const r of popRecords) {
    const age = r.ageStart as number;
    if (age < 0 || age > 100) continue;
    const entry = popByAge.get(age) ?? { male: 0, female: 0 };
    if (r.sex === 'Male') entry.male = (r.value as number) * 1000;
    else if (r.sex === 'Female') entry.female = (r.value as number) * 1000;
    popByAge.set(age, entry);
  }

  const population: AgeGroup[] = [];
  for (let age = 0; age <= 100; age++) {
    const entry = popByAge.get(age) ?? { male: 0, female: 0 };
    population.push({ age, male: Math.round(entry.male), female: Math.round(entry.female) });
  }

  // ASFR
  const asfrUrl = `${BASE_URL}/data/indicators/17/locations/${locationId}/start/${YEAR}/end/${YEAR}?variant=4&pageSize=100`;
  const asfrRecords = await fetchAllPages(asfrUrl);
  const asfr: ASFRGroup[] = asfrRecords
    .filter(r => (r.ageStart as number) >= 15 && (r.ageStart as number) <= 45)
    .map(r => ({
      ageStart: r.ageStart as number,
      ageEnd: (r.ageEnd as number) ?? (r.ageStart as number) + 5,
      rate: r.value as number,
    }))
    .sort((a, b) => a.ageStart - b.ageStart);

  // Mortality by age & sex
  const mortMaleUrl = `${BASE_URL}/data/indicators/80/locations/${locationId}/start/${YEAR}/end/${YEAR}?variant=4&sexId=1&pageSize=100`;
  const mortFemaleUrl = `${BASE_URL}/data/indicators/80/locations/${locationId}/start/${YEAR}/end/${YEAR}?variant=4&sexId=2&pageSize=100`;
  const [mortMale, mortFemale] = await Promise.all([
    fetchAllPages(mortMaleUrl),
    fetchAllPages(mortFemaleUrl),
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

  // Sex ratio at birth
  const srUrl = `${BASE_URL}/data/indicators/58/locations/${locationId}/start/${YEAR}/end/${YEAR}?variant=4&pageSize=100`;
  const srRecords = await fetchAllPages(srUrl);
  const sexRatio = srRecords.length > 0 ? (srRecords[0].value as number) : 1.05;

  // TFR
  const tfrUrl = `${BASE_URL}/data/indicators/19/locations/${locationId}/start/${YEAR}/end/${YEAR}?variant=4&pageSize=100`;
  const tfrRecords = await fetchAllPages(tfrUrl);
  const tfr = tfrRecords.length > 0 ? (tfrRecords[0].value as number) : 2.1;

  return { population, asfr, mortality, sexRatio: Math.round(sexRatio * 1000) / 1000, tfr: Math.round(tfr * 1000) / 1000 };
}

async function main() {
  if (!TOKEN) {
    console.error('Missing VITE_UN_API_TOKEN. Set it in .env');
    process.exit(1);
  }

  console.log(`Fetching data for ${COUNTRIES.length} countries (year ${YEAR})...`);
  const allData: Record<string, unknown> = {};
  let done = 0;

  for (const country of COUNTRIES) {
    try {
      console.log(`  [${++done}/${COUNTRIES.length}] ${country.name}...`);
      const data = await fetchCountryData(country.id);
      allData[String(country.id)] = data;
      // Rate limit: small delay between countries
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`  FAILED: ${country.name} - ${err}`);
    }
  }

  const outDir = path.join(process.cwd(), 'src', 'data');
  const outPath = path.join(outDir, 'cached-data.json');
  fs.writeFileSync(outPath, JSON.stringify(allData));
  console.log(`\nWritten to ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

main();
