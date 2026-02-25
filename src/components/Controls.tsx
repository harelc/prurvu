import { useState, useMemo } from 'react';
import { countriesByRegion } from '../data/countries';
import type { Country } from '../types';

interface ControlsProps {
  selectedCountry: Country | null;
  onSelectCountry: (country: Country) => void;
  year: number;
  baseYear: number;
  onStepForward: () => void;
  onStepBack: () => void;
  onReset: () => void;
  playing: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  tfr: number;
  baseTFR: number;
  onTFRChange: (tfr: number) => void;
  loading: boolean;
}

export function Controls({
  selectedCountry,
  onSelectCountry,
  year,
  baseYear,
  onStepForward,
  onStepBack,
  onReset,
  playing,
  onTogglePlay,
  speed,
  onSpeedChange,
  tfr,
  baseTFR,
  onTFRChange,
  loading,
}: ControlsProps) {
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return countriesByRegion;
    return countriesByRegion
      .map(g => ({
        region: g.region,
        countries: g.countries.filter(c => c.name.toLowerCase().includes(q)),
      }))
      .filter(g => g.countries.length > 0);
  }, [search]);

  return (
    <div className="flex flex-col gap-5">
      {/* Country Selector */}
      <div className="relative">
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Country
        </label>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={loading}
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 shadow-sm hover:border-blue-300 transition-colors disabled:opacity-50"
        >
          <span>{selectedCountry?.name ?? 'Select a country...'}</span>
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              <div className="sticky top-0 border-b border-slate-100 bg-white p-2">
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  autoFocus
                />
              </div>
              {filteredGroups.map(group => (
                <div key={group.region}>
                  <div className="sticky top-11 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.region}
                  </div>
                  {group.countries.map(country => (
                    <button
                      key={country.id}
                      onClick={() => {
                        onSelectCountry(country);
                        setDropdownOpen(false);
                        setSearch('');
                      }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-blue-50 ${
                        selectedCountry?.id === country.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600'
                      }`}
                    >
                      {country.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Year Controls */}
      {selectedCountry && (
        <>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Simulation
            </label>
            <div className="flex items-center gap-1.5">
              <IconButton onClick={onReset} disabled={year === baseYear || loading} title="Reset">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </IconButton>
              <IconButton onClick={onStepBack} disabled={year <= baseYear || playing || loading} title="Step back">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </IconButton>
              <button
                onClick={onTogglePlay}
                disabled={loading}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors ${
                  playing
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {playing ? 'Pause' : 'Play'}
              </button>
              <IconButton onClick={onStepForward} disabled={playing || loading} title="Step forward">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </IconButton>
            </div>
          </div>

          {/* Speed Control */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Speed
            </label>
            <div className="flex gap-1.5">
              {[0.5, 1, 2].map(s => (
                <button
                  key={s}
                  onClick={() => onSpeedChange(s)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    speed === s
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>

          {/* TFR Slider */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Fertility Rate (TFR)</span>
              <span className="text-sm font-bold tabular-nums text-blue-600">{tfr.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.05"
              value={tfr}
              onChange={e => onTFRChange(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-300">
              <span>0.5</span>
              <span className="text-slate-400">Base: {baseTFR.toFixed(2)}</span>
              <span>8.0</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function IconButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-30"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {children}
      </svg>
    </button>
  );
}
