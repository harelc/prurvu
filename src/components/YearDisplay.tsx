import { useState, useRef } from 'react';
import type { AgeGroup } from '../types';
import { getTotalPopulation, getMedianAge, getDependencyRatio } from '../simulation/engine';

interface YearDisplayProps {
  year: number;
  population: AgeGroup[];
  tfr: number;
  targetTFR?: number;
  comparePopulation?: AgeGroup[];
  compareTFR?: number;
}

function formatPopulation(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.round(n).toString();
}

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => { if (timerRef.current) clearTimeout(timerRef.current); setOpen(true); };
  const hide = () => { timerRef.current = setTimeout(() => setOpen(false), 150); };
  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        className="inline-flex items-center justify-center h-3 w-3 rounded-full bg-slate-200 text-[7px] font-bold text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-colors cursor-help leading-none"
        tabIndex={-1}
      >i</button>
      {open && (
        <div
          onMouseEnter={show} onMouseLeave={hide}
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded-lg bg-slate-800 px-3 py-2 text-[10px] leading-relaxed text-slate-100 shadow-lg normal-case tracking-normal font-normal"
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800" />
        </div>
      )}
    </span>
  );
}

export function YearDisplay({ year, population, tfr, targetTFR, comparePopulation, compareTFR }: YearDisplayProps) {
  const totalPop = getTotalPopulation(population);
  const medianAge = getMedianAge(population);
  const depRatio = getDependencyRatio(population);

  const tfrLabel = targetTFR != null
    ? `${tfr.toFixed(2)} \u2192 ${targetTFR.toFixed(2)}`
    : tfr.toFixed(2);

  const hasCompare = !!comparePopulation;
  const cmpPop = comparePopulation ? getTotalPopulation(comparePopulation) : 0;
  const cmpMedian = comparePopulation ? getMedianAge(comparePopulation) : 0;
  const cmpDep = comparePopulation ? getDependencyRatio(comparePopulation) : 0;

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-5">
      <Stat label="Year" value={String(year)} />
      <Stat
        label="Population"
        value={formatPopulation(totalPop)}
        compare={hasCompare ? formatPopulation(cmpPop) : undefined}
      />
      <Stat
        label="Median Age"
        value={String(medianAge)}
        compare={hasCompare ? String(cmpMedian) : undefined}
      />
      <Stat
        label="TFR"
        value={tfrLabel}
        compare={hasCompare && compareTFR != null ? compareTFR.toFixed(2) : undefined}
      />
      <Stat
        label="Dependency Ratio"
        value={depRatio.toFixed(1) + '%'}
        compare={hasCompare ? cmpDep.toFixed(1) + '%' : undefined}
        info="Ratio of dependents (ages 0–14 and 65+) to working-age population (15–64). Higher values mean more dependents per worker."
      />
    </div>
  );
}

function Stat({ label, value, compare, info }: { label: string; value: string; compare?: string; info?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}{info && <InfoTip text={info} />}
      </div>
      <div className="text-base font-bold tabular-nums text-slate-800">{value}</div>
      {compare != null && (
        <div className="text-xs font-semibold tabular-nums text-emerald-600">B: {compare}</div>
      )}
    </div>
  );
}
