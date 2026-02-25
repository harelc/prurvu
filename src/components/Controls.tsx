import { useState, useMemo } from 'react';
import { countriesByRegion, countriesAlphabetic, countryFlag } from '../data/countries';
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
  tfrConvergenceYears: number; // 0=instant, 1–100=years to ~95% convergence
  onTFRConvergenceYearsChange: (years: number) => void;
  mortalityMultiplier: number;
  onMortalityChange: (value: number) => void;
  userSexRatio: number;
  baseSexRatio: number;
  onSexRatioChange: (value: number) => void;
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
  tfrConvergenceYears,
  onTFRConvergenceYearsChange,
  mortalityMultiplier,
  onMortalityChange,
  userSexRatio,
  baseSexRatio,
  onSexRatioChange,
  loading,
}: ControlsProps) {
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'region' | 'alpha'>('region');

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

  const filteredAlpha = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return countriesAlphabetic;
    return countriesAlphabetic.filter(c => c.name.toLowerCase().includes(q));
  }, [search]);

  const mortalityPct = Math.round((1 - mortalityMultiplier) * -100);
  const mortalityLabel = mortalityPct === 0 ? 'Baseline' : mortalityPct > 0 ? `+${mortalityPct}%` : `${mortalityPct}%`;

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
          <span>
            {selectedCountry
              ? `${countryFlag(selectedCountry.iso3)} ${selectedCountry.name}`
              : 'Select a country...'}
          </span>
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-2 space-y-1.5">
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  autoFocus
                />
                <div className="flex gap-1">
                  {(['region', 'alpha'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setSortMode(mode)}
                      className={`flex-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                        sortMode === mode
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {mode === 'region' ? 'By Region' : 'A–Z'}
                    </button>
                  ))}
                </div>
              </div>

              {sortMode === 'region' ? (
                filteredGroups.map(group => (
                  <div key={group.region}>
                    <div className="sticky top-[72px] bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {group.region}
                    </div>
                    {group.countries.map(country => (
                      <CountryOption
                        key={country.id}
                        country={country}
                        selected={selectedCountry?.id === country.id}
                        onSelect={() => {
                          onSelectCountry(country);
                          setDropdownOpen(false);
                          setSearch('');
                        }}
                      />
                    ))}
                  </div>
                ))
              ) : (
                filteredAlpha.map(country => (
                  <CountryOption
                    key={country.id}
                    country={country}
                    selected={selectedCountry?.id === country.id}
                    onSelect={() => {
                      onSelectCountry(country);
                      setDropdownOpen(false);
                      setSearch('');
                    }}
                  />
                ))
              )}
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
              {([['Slow', 0.5], ['Normal', 0.25], ['Fast', 0.1]] as const).map(([label, s]) => (
                <button
                  key={s}
                  onClick={() => onSpeedChange(s)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    speed === s
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Modified TFR Slider */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Modified TFR</span>
              <span className="text-sm font-bold tabular-nums text-blue-600">{tfr.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.01"
              value={tfr}
              onChange={e => onTFRChange(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-300">
              <span>0.5</span>
              <button
                onClick={() => onTFRChange(baseTFR)}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                title="Reset TFR to baseline"
              >
                Base: {baseTFR.toFixed(2)} ↺
              </button>
              <span>8.0</span>
            </div>
          </div>

          {/* TFR Convergence in Years */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>TFR Convergence</span>
              <span className="text-sm font-bold tabular-nums text-blue-600">
                {tfrConvergenceYears === 0 ? 'Instant' : `${tfrConvergenceYears} yr`}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={tfrConvergenceYears}
              onChange={e => onTFRConvergenceYearsChange(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-300">
              <span>Instant</span>
              <span className="text-slate-400">Years to reach target</span>
              <span>100 yr</span>
            </div>
          </div>

          {/* Mortality Multiplier Slider */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Mortality Change</span>
              <span className={`text-sm font-bold tabular-nums ${mortalityMultiplier < 1 ? 'text-green-600' : mortalityMultiplier > 1 ? 'text-red-500' : 'text-slate-600'}`}>
                {mortalityLabel}
              </span>
            </label>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.01"
              value={mortalityMultiplier}
              onChange={e => onMortalityChange(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-300">
              <span>-50%</span>
              <button
                onClick={() => onMortalityChange(1)}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                title="Reset mortality to baseline"
              >
                Baseline ↺
              </button>
              <span>+50%</span>
            </div>
          </div>

          {/* Sex Ratio at Birth Slider */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Sex Ratio at Birth</span>
              <span className="text-sm font-bold tabular-nums text-blue-600">{userSexRatio.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0.90"
              max="1.20"
              step="0.01"
              value={userSexRatio}
              onChange={e => onSexRatioChange(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-300">
              <span>0.90</span>
              <button
                onClick={() => onSexRatioChange(baseSexRatio)}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                title="Reset sex ratio to baseline"
              >
                Base: {baseSexRatio.toFixed(2)} ↺
              </button>
              <span>1.20</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CountryOption({
  country,
  selected,
  onSelect,
}: {
  country: Country;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-blue-50 ${
        selected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600'
      }`}
    >
      <span className="text-base leading-none">{countryFlag(country.iso3)}</span>
      <span>{country.name}</span>
    </button>
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
