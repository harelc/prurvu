import type { AgeGroup } from '../types';
import { getTotalPopulation, getMedianAge, getDependencyRatio } from '../simulation/engine';

interface YearDisplayProps {
  year: number;
  population: AgeGroup[];
  tfr: number;
  targetTFR?: number; // shown when gradual mode is active
}

function formatPopulation(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.round(n).toString();
}

export function YearDisplay({ year, population, tfr, targetTFR }: YearDisplayProps) {
  const totalPop = getTotalPopulation(population);
  const medianAge = getMedianAge(population);
  const depRatio = getDependencyRatio(population);

  const tfrLabel = targetTFR != null
    ? `${tfr.toFixed(2)} → ${targetTFR.toFixed(2)}`
    : tfr.toFixed(2);

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
      <Stat label="Year" value={String(year)} />
      <Stat label="Population" value={formatPopulation(totalPop)} />
      <Stat label="Median Age" value={String(medianAge)} />
      <Stat label="TFR" value={tfrLabel} />
      <Stat label="Dep. Ratio" value={depRatio.toFixed(1) + '%'} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-xl font-bold tabular-nums text-slate-800">{value}</div>
    </div>
  );
}
