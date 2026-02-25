export interface AgeGroup {
  age: number;
  male: number;
  female: number;
}

export interface ASFRGroup {
  ageStart: number;
  ageEnd: number;
  rate: number; // per 1000 women
}

export interface CountrySnapshot {
  locationId: number;
  year: number;
  population: AgeGroup[];
  asfr: ASFRGroup[];
  mortality: AgeGroup[]; // rate m(x) per age, male/female
  sexRatio: number; // males per female at birth
  tfr: number; // total fertility rate (reference)
}

export interface Country {
  id: number;
  name: string;
  iso3: string;
  region: string;
}
