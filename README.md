# Age Pyramid Simulator

Interactive population pyramid simulator powered by **UN World Population Prospects 2024** data. Watch demographic structures evolve year-by-year using cohort-component projection.

*Be fruitful and multiply (Genesis 1:28)*

**[Live Demo](https://prurvu.com)**

## Features

### Core Simulation
- **69 countries** with pre-cached demographic data (population by age/sex, fertility, mortality)
- **Cohort-component projection** engine — births, deaths, and aging each year
- **Birth calibration** — corrects for migration and mid-year timing so simulated age-0 matches actual data
- **200-year projection** horizon (2024–2224)

### Interactive Controls
- **Target TFR** — set target fertility rate with configurable time to reach it
- **Mortality change** — scale all death rates -50% to +50%
- **Sex ratio at birth** — adjust male-to-female newborn ratio
- **Net migration** — Rogers-Castro age profile, -2% to +2% of population per year
- **Childbearing age shift** — shift the ASFR schedule earlier or later (-5 to +10 years)
- Play/pause animation at adjustable speed, keyboard shortcuts (Space, arrows, R)

### Visualizations
- **Population pyramid** with gender excess highlighting, future-born separator line, and childbearing-age momentum overlay
- **Dual-axis time chart** — population and TFR over the full simulation range
- **ASFR distribution** histogram showing fertility by age group
- **Hover tooltips** on pyramid bars with detailed breakdowns
- All charts resize responsively on browser zoom

### Compare Mode
- Overlay a second scenario (B) as dashed green outlines on the pyramid
- Dual lines on the time chart for side-by-side comparison
- A/B tab selector to control each scenario independently

### Share & Export
- **Shareable URL** — all parameters including simulation year encoded in the URL hash
- **PNG export** — pyramid image with country name, stats, simulation parameters, and site credit
- **CSV export** — population by age or time series data

### UI
- Country selector with flags, search, region grouping or A–Z sorting
- Info tooltips on advanced parameters explaining what each control does
- Muted, low-contrast design with translucent panes

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

For live API access (optional — cached data is bundled for 69 countries):

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

1. **Deaths** — apply age/sex-specific mortality rates (scaled by mortality multiplier, with optional annual improvement compounding)
2. **Aging** — shift survivors up one year; age 100+ accumulates
3. **Births** — apply age-specific fertility rates to women 15–49, shifted by ASFR offset, scaled by TFR ratio and birth calibration factor
4. **Migration** — distribute net migrants by Rogers-Castro age profile, split 50/50 male/female
5. **Split** — divide newborns by sex ratio into male/female age-0 cohort

When "Time to Target" is set to N years, the effective TFR blends exponentially toward the target TFR, reaching ~95% in N years (default: 50 years).

## Data Sources

- [UN World Population Prospects 2024](https://population.un.org/wpp/)
- Population by single-year age and sex (indicator 47)
- Age-specific fertility rates (indicator 17)
- Age-specific mortality rates (indicator 80)
- Sex ratio at birth (indicator 58)
- Total fertility rate (indicator 19)

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — Harel Cain
