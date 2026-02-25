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
  birthCalibrationFactor: number; // actual_age0 / simulated_age0
  currentTFR?: number; // tracked effective TFR for gradual convergence
  mortalityImprovementAccumulated?: number; // compounds each year (starts 1.0)
}

export interface Country {
  id: number;
  name: string;
  iso3: string;
  region: string;
}
