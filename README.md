# Age Pyramid Simulator

Interactive population pyramid simulator powered by **UN World Population Prospects 2024** data. Watch demographic structures evolve year-by-year using cohort-component projection.

**[Live Demo](https://harelc.github.io/prurvu/)**

## Features

- **96 countries** with real demographic data (population by age/sex, fertility, mortality)
- **Cohort-component projection** engine — births, deaths, and aging each year
- **Interactive controls:**
  - **Modified TFR** — adjust total fertility rate with optional gradual convergence (set how many years to reach target)
  - **Mortality multiplier** — scale all death rates -50% to +50%
  - **Sex ratio at birth** — adjust male-to-female newborn ratio
- **Birth calibration** — corrects for migration and mid-year timing so simulated age-0 matches actual data
- **Population pyramid** with gender excess highlighting and future-born separator line
- **Dual-axis time chart** — population and TFR plotted over simulation years
- **Country selector** with flags, search, region grouping or A–Z sorting
- Play/pause animation at adjustable speed
- All controls reset on country change

## Tech Stack

- React + TypeScript + Vite
- D3.js for the pyramid visualization
- Canvas API for the time series chart
- Tailwind CSS
- UN Population Division Data Portal API

## Getting Started

```bash
npm install
npm run dev
```

For live API access (optional — cached data is bundled for 25 countries):

```bash
# Get a token at https://population.un.org/dataportal/about/dataapi
echo "VITE_UN_API_TOKEN=Bearer <your-token>" > .env
```

### Pre-fetch country data

```bash
npx tsx scripts/fetch-data.ts [limit]
```

Fetches and caches demographic data so the app works without API calls. Skips countries already in the cache.

## How It Works

Each simulation step:

1. **Deaths** — apply age/sex-specific mortality rates (scaled by mortality multiplier)
2. **Aging** — shift survivors up one year; age 100+ accumulates
3. **Births** — apply age-specific fertility rates to women 15–49, scaled by TFR ratio and birth calibration factor
4. **Split** — divide newborns by sex ratio into male/female age-0 cohort

When TFR convergence is set to N years, the effective TFR blends exponentially toward the target, reaching ~95% in N years.

## Data Sources

- [UN World Population Prospects 2024](https://population.un.org/wpp/)
- Population by single-year age and sex (indicator 47)
- Age-specific fertility rates (indicator 17)
- Age-specific mortality rates (indicator 80)
- Sex ratio at birth (indicator 58)
- Total fertility rate (indicator 19)

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — Harel Cain
