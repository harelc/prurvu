import { useState, useRef } from 'react';
import type { ASFRGroup } from '../types';

interface ASFRChartProps {
  asfr: ASFRGroup[];
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

const MAX_RATE = 200; // fixed Y axis max: 200 per 1000 women (covers virtually all countries)

export function ASFRChart({ asfr }: ASFRChartProps) {
  if (asfr.length === 0) return null;

  // Compute mean age at childbearing
  let sumRateAge = 0;
  let sumRate = 0;
  for (const g of asfr) {
    const midAge = (g.ageStart + g.ageEnd) / 2;
    sumRateAge += g.rate * midAge;
    sumRate += g.rate;
  }
  const meanAge = sumRate > 0 ? sumRateAge / sumRate : 30;

  // Y axis ticks
  const yTicks = [0, 50, 100, 150, 200];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          ASFR Distribution
          <InfoTip text="These determine the TFR. In the simulation, the ASFR distribution is modified by Modified TFR and childbearing age shift." />
        </span>
        <span className="text-[9px] text-purple-600 font-semibold">
          Mean: {meanAge.toFixed(1)}
        </span>
      </div>
      <div className="flex flex-1 min-h-0">
        {/* Y axis labels */}
        <div style={{ width: '24px', position: 'relative', flexShrink: 0 }}>
          {yTicks.map(t => {
            const bottom = (t / MAX_RATE) * 100;
            return (
              <span
                key={t}
                className="text-[7px] text-slate-400 leading-none"
                style={{
                  position: 'absolute',
                  right: '2px',
                  bottom: `${bottom}%`,
                  transform: 'translateY(50%)',
                }}
              >
                {t}
              </span>
            );
          })}
        </div>
        {/* Bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', flex: 1 }}>
          {asfr.map((g, i) => {
            const pct = Math.max(0.5, (g.rate / MAX_RATE) * 100);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${pct}%`,
                  backgroundColor: 'rgb(192, 132, 252)',
                  borderRadius: '2px 2px 0 0',
                  opacity: 0.8,
                  transition: 'height 0.3s ease',
                }}
                title={`${g.ageStart}\u2013${g.ageEnd}: ${g.rate.toFixed(1)}/1000`}
              />
            );
          })}
        </div>
      </div>
      {/* X axis labels */}
      <div className="shrink-0" style={{ display: 'flex', marginLeft: '24px' }}>
        {asfr.map((g, i) => (
          <span key={i} className="text-[8px] text-slate-400" style={{ flex: 1, textAlign: 'left' }}>
            {g.ageStart}
          </span>
        ))}
      </div>
      <div className="text-[7px] text-slate-400 mt-0.5 shrink-0" style={{ marginLeft: '24px' }}>
        per 1,000 women
      </div>
    </div>
  );
}
