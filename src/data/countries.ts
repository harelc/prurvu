import type { Country } from '../types';

export const countries: Country[] = [
  // East Asia
  { id: 156, name: 'China', iso3: 'CHN', region: 'East Asia' },
  { id: 392, name: 'Japan', iso3: 'JPN', region: 'East Asia' },
  { id: 410, name: 'South Korea', iso3: 'KOR', region: 'East Asia' },
  { id: 158, name: 'Taiwan', iso3: 'TWN', region: 'East Asia' },

  // Southeast Asia
  { id: 360, name: 'Indonesia', iso3: 'IDN', region: 'Southeast Asia' },
  { id: 608, name: 'Philippines', iso3: 'PHL', region: 'Southeast Asia' },
  { id: 704, name: 'Vietnam', iso3: 'VNM', region: 'Southeast Asia' },
  { id: 764, name: 'Thailand', iso3: 'THA', region: 'Southeast Asia' },
  { id: 104, name: 'Myanmar', iso3: 'MMR', region: 'Southeast Asia' },
  { id: 458, name: 'Malaysia', iso3: 'MYS', region: 'Southeast Asia' },
  { id: 702, name: 'Singapore', iso3: 'SGP', region: 'Southeast Asia' },

  // South Asia
  { id: 356, name: 'India', iso3: 'IND', region: 'South Asia' },
  { id: 586, name: 'Pakistan', iso3: 'PAK', region: 'South Asia' },
  { id: 50, name: 'Bangladesh', iso3: 'BGD', region: 'South Asia' },
  { id: 4, name: 'Afghanistan', iso3: 'AFG', region: 'South Asia' },

  // Middle East
  { id: 792, name: 'Turkey', iso3: 'TUR', region: 'Middle East' },
  { id: 364, name: 'Iran', iso3: 'IRN', region: 'Middle East' },
  { id: 682, name: 'Saudi Arabia', iso3: 'SAU', region: 'Middle East' },
  { id: 368, name: 'Iraq', iso3: 'IRQ', region: 'Middle East' },
  { id: 784, name: 'UAE', iso3: 'ARE', region: 'Middle East' },
  { id: 376, name: 'Israel', iso3: 'ISR', region: 'Middle East' },
  { id: 818, name: 'Egypt', iso3: 'EGY', region: 'Middle East' },

  // Europe - Western
  { id: 276, name: 'Germany', iso3: 'DEU', region: 'Western Europe' },
  { id: 250, name: 'France', iso3: 'FRA', region: 'Western Europe' },
  { id: 826, name: 'United Kingdom', iso3: 'GBR', region: 'Western Europe' },
  { id: 380, name: 'Italy', iso3: 'ITA', region: 'Western Europe' },
  { id: 724, name: 'Spain', iso3: 'ESP', region: 'Western Europe' },
  { id: 528, name: 'Netherlands', iso3: 'NLD', region: 'Western Europe' },
  { id: 56, name: 'Belgium', iso3: 'BEL', region: 'Western Europe' },
  { id: 756, name: 'Switzerland', iso3: 'CHE', region: 'Western Europe' },
  { id: 40, name: 'Austria', iso3: 'AUT', region: 'Western Europe' },
  { id: 372, name: 'Ireland', iso3: 'IRL', region: 'Western Europe' },
  { id: 620, name: 'Portugal', iso3: 'PRT', region: 'Western Europe' },
  { id: 300, name: 'Greece', iso3: 'GRC', region: 'Western Europe' },

  // Europe - Northern
  { id: 752, name: 'Sweden', iso3: 'SWE', region: 'Northern Europe' },
  { id: 578, name: 'Norway', iso3: 'NOR', region: 'Northern Europe' },
  { id: 208, name: 'Denmark', iso3: 'DNK', region: 'Northern Europe' },
  { id: 246, name: 'Finland', iso3: 'FIN', region: 'Northern Europe' },

  // Europe - Eastern
  { id: 616, name: 'Poland', iso3: 'POL', region: 'Eastern Europe' },
  { id: 804, name: 'Ukraine', iso3: 'UKR', region: 'Eastern Europe' },
  { id: 642, name: 'Romania', iso3: 'ROU', region: 'Eastern Europe' },
  { id: 203, name: 'Czech Republic', iso3: 'CZE', region: 'Eastern Europe' },
  { id: 348, name: 'Hungary', iso3: 'HUN', region: 'Eastern Europe' },
  { id: 643, name: 'Russia', iso3: 'RUS', region: 'Eastern Europe' },

  // North America
  { id: 840, name: 'United States', iso3: 'USA', region: 'North America' },
  { id: 124, name: 'Canada', iso3: 'CAN', region: 'North America' },
  { id: 484, name: 'Mexico', iso3: 'MEX', region: 'North America' },
  { id: 192, name: 'Cuba', iso3: 'CUB', region: 'North America' },

  // South America
  { id: 76, name: 'Brazil', iso3: 'BRA', region: 'South America' },
  { id: 32, name: 'Argentina', iso3: 'ARG', region: 'South America' },
  { id: 170, name: 'Colombia', iso3: 'COL', region: 'South America' },
  { id: 604, name: 'Peru', iso3: 'PER', region: 'South America' },
  { id: 862, name: 'Venezuela', iso3: 'VEN', region: 'South America' },
  { id: 152, name: 'Chile', iso3: 'CHL', region: 'South America' },

  // Africa - North
  { id: 504, name: 'Morocco', iso3: 'MAR', region: 'North Africa' },
  { id: 12, name: 'Algeria', iso3: 'DZA', region: 'North Africa' },

  // Africa - Sub-Saharan
  { id: 566, name: 'Nigeria', iso3: 'NGA', region: 'Sub-Saharan Africa' },
  { id: 231, name: 'Ethiopia', iso3: 'ETH', region: 'Sub-Saharan Africa' },
  { id: 710, name: 'South Africa', iso3: 'ZAF', region: 'Sub-Saharan Africa' },
  { id: 404, name: 'Kenya', iso3: 'KEN', region: 'Sub-Saharan Africa' },
  { id: 834, name: 'Tanzania', iso3: 'TZA', region: 'Sub-Saharan Africa' },
  { id: 180, name: 'DR Congo', iso3: 'COD', region: 'Sub-Saharan Africa' },
  { id: 288, name: 'Ghana', iso3: 'GHA', region: 'Sub-Saharan Africa' },
  { id: 508, name: 'Mozambique', iso3: 'MOZ', region: 'Sub-Saharan Africa' },
  { id: 450, name: 'Madagascar', iso3: 'MDG', region: 'Sub-Saharan Africa' },
  { id: 24, name: 'Angola', iso3: 'AGO', region: 'Sub-Saharan Africa' },
  { id: 120, name: 'Cameroon', iso3: 'CMR', region: 'Sub-Saharan Africa' },

  // Oceania
  { id: 36, name: 'Australia', iso3: 'AUS', region: 'Oceania' },
  { id: 554, name: 'New Zealand', iso3: 'NZL', region: 'Oceania' },
];

export const regions = [...new Set(countries.map(c => c.region))];

export const countriesByRegion = regions.map(region => ({
  region,
  countries: countries.filter(c => c.region === region).sort((a, b) => a.name.localeCompare(b.name)),
}));

export const countriesAlphabetic = [...countries].sort((a, b) => a.name.localeCompare(b.name));

// ISO3 → ISO2 mapping for flag emoji generation
const iso3to2: Record<string, string> = {
  AFG:'AF',AGO:'AO',ARE:'AE',ARG:'AR',AUS:'AU',AUT:'AT',BEL:'BE',BGD:'BD',
  BRA:'BR',CHE:'CH',CHL:'CL',CHN:'CN',CMR:'CM',COD:'CD',COL:'CO',CRI:'CR',
  CUB:'CU',CZE:'CZ',DEU:'DE',DNK:'DK',EGY:'EG',ESP:'ES',ETH:'ET',FIN:'FI',
  FRA:'FR',GBR:'GB',GHA:'GH',GRC:'GR',HUN:'HU',IDN:'ID',IND:'IN',IRL:'IE',
  IRN:'IR',IRQ:'IQ',ISR:'IL',ITA:'IT',JPN:'JP',KEN:'KE',KOR:'KR',MAR:'MA',
  MDG:'MG',MEX:'MX',MMR:'MM',MOZ:'MZ',MYS:'MY',NGA:'NG',NLD:'NL',NOR:'NO',
  NZL:'NZ',PAK:'PK',PER:'PE',PHL:'PH',POL:'PL',PRT:'PT',ROU:'RO',RUS:'RU',
  SAU:'SA',SGP:'SG',SWE:'SE',THA:'TH',TUR:'TR',TWN:'TW',TZA:'TZ',UKR:'UA',
  USA:'US',VEN:'VE',VNM:'VN',ZAF:'ZA',DZA:'DZ',CAN:'CA',
};

export function countryFlag(iso3: string): string {
  const iso2 = iso3to2[iso3];
  if (!iso2) return '';
  return String.fromCodePoint(
    ...iso2.split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}
