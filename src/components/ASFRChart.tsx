import type { ASFRGroup } from '../types';

interface ASFRChartProps {
  asfr: ASFRGroup[];
}

const CHART_HEIGHT = 56;
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
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          ASFR Distribution
        </span>
        <span className="text-[9px] text-purple-600 font-semibold">
          Mean: {meanAge.toFixed(1)}
        </span>
      </div>
      <div style={{ display: 'flex', height: `${CHART_HEIGHT}px` }}>
        {/* Y axis labels */}
        <div style={{ width: '24px', height: '100%', position: 'relative', flexShrink: 0 }}>
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
            const h = Math.max(1, (g.rate / MAX_RATE) * CHART_HEIGHT);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h}px`,
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
      <div style={{ display: 'flex', marginLeft: '24px' }}>
        {asfr.map((g, i) => (
          <span key={i} className="text-[8px] text-slate-400" style={{ flex: 1, textAlign: 'left' }}>
            {g.ageStart}
          </span>
        ))}
      </div>
      <div className="text-[7px] text-slate-400 mt-0.5" style={{ marginLeft: '24px' }}>
        per 1,000 women
      </div>
    </div>
  );
}
