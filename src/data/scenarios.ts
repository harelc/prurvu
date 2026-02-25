import type { SimulationParams } from '../simulation/engine';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  countryIso3: string; // Forces this country
  params: Partial<SimulationParams> & {
    tfrConvergenceYears?: number;
  };
}

export const scenarios: Scenario[] = [
  {
    id: 'japan-decline',
    name: 'Japan Decline',
    description: 'Ultra-low fertility with medical advances',
    countryIso3: 'JPN',
    params: {
      userTFR: 0.8,
      mortalityImprovementRate: 0.01,
    },
  },
  {
    id: 'subsaharan-transition',
    name: 'Nigeria: Demographic Transition',
    description: 'Gradual TFR decline to replacement over 40 years',
    countryIso3: 'NGA',
    params: {
      userTFR: 2.1,
      tfrConvergenceYears: 40,
    },
  },
  {
    id: 'uae-open-borders',
    name: 'UAE: Open Borders',
    description: 'High immigration rate',
    countryIso3: 'ARE',
    params: {
      netMigrationRate: 0.02,
    },
  },
  {
    id: 'israel-baby-boom',
    name: 'Israel: Baby Boom',
    description: 'High fertility scenario',
    countryIso3: 'ISR',
    params: {
      userTFR: 3.5,
    },
  },
  {
    id: 'germany-aging',
    name: 'Germany: Aging Europe',
    description: 'Low fertility with improving longevity',
    countryIso3: 'DEU',
    params: {
      userTFR: 1.3,
      mortalityImprovementRate: 0.015,
    },
  },
  {
    id: 'korea-late-motherhood',
    name: 'South Korea: Late Motherhood',
    description: 'Childbearing delayed by 5 years',
    countryIso3: 'KOR',
    params: {
      asfrShiftYears: 5,
    },
  },
  {
    id: 'ukraine-emigration',
    name: 'Ukraine: Emigration Crisis',
    description: 'Population loss from heavy emigration',
    countryIso3: 'UKR',
    params: {
      netMigrationRate: -0.015,
      userTFR: 1.4,
    },
  },
  {
    id: 'india-medical-breakthrough',
    name: 'India: Medical Breakthrough',
    description: 'Rapid mortality improvement',
    countryIso3: 'IND',
    params: {
      mortalityImprovementRate: 0.03,
    },
  },
];
