import { useState, useCallback, useRef, useEffect } from 'react';
import type { Country, CountrySnapshot } from './types';
import { fetchAllCountryData } from './api/unApi';
import { stepForward, simulateYears, computeBaseTFR, getTotalPopulation } from './simulation/engine';
import type { SimulationParams } from './simulation/engine';
import { Pyramid } from './components/Pyramid';
import { Controls } from './components/Controls';
import { YearDisplay } from './components/YearDisplay';
import { DualAxisChart } from './components/PopulationChart';
import type { TimeSeriesPoint } from './components/PopulationChart';
import { LoadingState, ErrorState } from './components/LoadingState';
import { HowItWorks } from './components/HowItWorks';

const BASE_YEAR = 2024;

export default function App() {
  const [country, setCountry] = useState<Country | null>(null);
  const [baseSnapshot, setBaseSnapshot] = useState<CountrySnapshot | null>(null);
  const [currentSnapshot, setCurrentSnapshot] = useState<CountrySnapshot | null>(null);
  const [snapshotCache, setSnapshotCache] = useState<Map<number, CountrySnapshot>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.25);
  const [userTFR, setUserTFR] = useState<number | null>(null);
  const [tfrConvergenceYears, setTfrConvergenceYears] = useState(0); // 0=instant
  const [mortalityMultiplier, setMortalityMultiplier] = useState(1);
  const [userSexRatio, setUserSexRatio] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [popHistory, setPopHistory] = useState<TimeSeriesPoint[]>([]);
  const [tfrHistory, setTfrHistory] = useState<TimeSeriesPoint[]>([]);

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const baseTFR = baseSnapshot ? computeBaseTFR(baseSnapshot.asfr) : 2.1;
  const effectiveTFR = userTFR ?? baseTFR;
  const baseSexRatio = baseSnapshot?.sexRatio ?? 1.05;
  const effectiveSexRatio = userSexRatio ?? baseSexRatio;

  // Convert convergence years to rate: rate per year so that ~95% of gap is closed in N years
  // (1-rate)^N = 0.05  →  rate = 1 - 0.05^(1/N)
  const tfrConvergenceRate = tfrConvergenceYears === 0 ? 1 : 1 - Math.pow(0.05, 1 / tfrConvergenceYears);

  const simParams: SimulationParams = {
    userTFR: userTFR ?? undefined,
    mortalityMultiplier,
    userSexRatio: userSexRatio ?? undefined,
    tfrConvergenceRate,
  };

  const buildHistory = useCallback((base: CountrySnapshot, yearsForward: number, params: SimulationParams) => {
    const ph: TimeSeriesPoint[] = [];
    const th: TimeSeriesPoint[] = [];
    let s = base;
    ph.push({ year: s.year, value: getTotalPopulation(s.population) });
    th.push({ year: s.year, value: s.tfr });
    for (let i = 0; i < yearsForward; i++) {
      s = stepForward(s, params);
      ph.push({ year: s.year, value: getTotalPopulation(s.population) });
      th.push({ year: s.year, value: s.currentTFR ?? s.tfr });
    }
    return { ph, th, final: s };
  }, []);

  const handleSelectCountry = useCallback(async (c: Country) => {
    setPlaying(false);
    setCountry(c);
    setBaseSnapshot(null);
    setCurrentSnapshot(null);
    setSnapshotCache(new Map());
    setError(null);
    setUserTFR(null);
    setTfrConvergenceYears(0);
    setMortalityMultiplier(1);
    setUserSexRatio(null);
    setPopHistory([]);
    setTfrHistory([]);
    setLoading(true);

    try {
      const snap = await fetchAllCountryData(c.id, BASE_YEAR);
      setBaseSnapshot(snap);
      setCurrentSnapshot(snap);
      const cache = new Map<number, CountrySnapshot>();
      cache.set(BASE_YEAR, snap);
      setSnapshotCache(cache);
      setPopHistory([{ year: snap.year, value: getTotalPopulation(snap.population) }]);
      setTfrHistory([{ year: snap.year, value: snap.tfr }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-restart: when parameters change and we're past base year, recompute from base
  const resimulate = useCallback((params: SimulationParams) => {
    if (!baseSnapshot || !currentSnapshot) return;
    const yearsForward = currentSnapshot.year - BASE_YEAR;
    if (yearsForward <= 0) return;
    const { ph, th, final } = buildHistory(baseSnapshot, yearsForward, params);
    setCurrentSnapshot(final);
    setPopHistory(ph);
    setTfrHistory(th);
  }, [baseSnapshot, currentSnapshot, buildHistory]);

  const handleStepForward = useCallback(() => {
    if (!currentSnapshot) return;
    const next = stepForward(currentSnapshot, simParams);
    setCurrentSnapshot(next);
    setPopHistory(prev => [...prev, { year: next.year, value: getTotalPopulation(next.population) }]);
    setTfrHistory(prev => [...prev, { year: next.year, value: next.currentTFR ?? next.tfr }]);
    setSnapshotCache(prev => {
      const newCache = new Map(prev);
      newCache.set(next.year, next);
      return newCache;
    });
  }, [currentSnapshot, simParams]);

  const handleStepBack = useCallback(() => {
    if (!currentSnapshot || !baseSnapshot) return;
    const prevYear = currentSnapshot.year - 1;
    if (prevYear < BASE_YEAR) return;
    const yearsForward = prevYear - BASE_YEAR;
    const { ph, th, final } = buildHistory(baseSnapshot, yearsForward, simParams);
    setCurrentSnapshot(final);
    setPopHistory(ph);
    setTfrHistory(th);
  }, [currentSnapshot, baseSnapshot, simParams, buildHistory]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    if (baseSnapshot) {
      setCurrentSnapshot(baseSnapshot);
      setPopHistory([{ year: baseSnapshot.year, value: getTotalPopulation(baseSnapshot.population) }]);
      setTfrHistory([{ year: baseSnapshot.year, value: baseSnapshot.tfr }]);
    }
  }, [baseSnapshot]);

  const handleTogglePlay = useCallback(() => {
    setPlaying(prev => !prev);
  }, []);

  const handleTFRChange = useCallback((newTFR: number) => {
    setUserTFR(newTFR);
    const params: SimulationParams = { ...simParams, userTFR: newTFR };
    resimulate(params);
  }, [simParams, resimulate]);

  const handleMortalityChange = useCallback((value: number) => {
    setMortalityMultiplier(value);
    const params: SimulationParams = { ...simParams, mortalityMultiplier: value };
    resimulate(params);
  }, [simParams, resimulate]);

  const handleSexRatioChange = useCallback((value: number) => {
    setUserSexRatio(value);
    const params: SimulationParams = { ...simParams, userSexRatio: value };
    resimulate(params);
  }, [simParams, resimulate]);

  const handleTFRConvergenceYearsChange = useCallback((years: number) => {
    setTfrConvergenceYears(years);
    const rate = years === 0 ? 1 : 1 - Math.pow(0.05, 1 / years);
    const params: SimulationParams = { ...simParams, tfrConvergenceRate: rate };
    resimulate(params);
  }, [simParams, resimulate]);

  useEffect(() => {
    if (playing && currentSnapshot) {
      playIntervalRef.current = setInterval(() => {
        setCurrentSnapshot(prev => {
          if (!prev) return prev;
          const next = stepForward(prev, simParams);
          setTimeout(() => {
            setPopHistory(h => [...h, { year: next.year, value: getTotalPopulation(next.population) }]);
            setTfrHistory(h => [...h, { year: next.year, value: next.currentTFR ?? next.tfr }]);
          }, 0);
          return next;
        });
      }, speed * 1000);
    }
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [playing, speed, simParams]);

  const effectiveDisplayTFR = currentSnapshot?.currentTFR ?? effectiveTFR;
  const yearsSimulated = currentSnapshot ? currentSnapshot.year - BASE_YEAR : 0;

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-sky-50 via-white to-amber-50 text-slate-800 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Age Pyramid Simulator
          </h1>
          <p className="text-xs text-slate-400">
            UN World Population Prospects 2024 — Cohort-component projection
          </p>
        </div>
        <button
          onClick={() => setShowTutorial(true)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          How it works
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white/60 backdrop-blur p-5">
          <Controls
            selectedCountry={country}
            onSelectCountry={handleSelectCountry}
            year={currentSnapshot?.year ?? BASE_YEAR}
            baseYear={BASE_YEAR}
            onStepForward={handleStepForward}
            onStepBack={handleStepBack}
            onReset={handleReset}
            playing={playing}
            onTogglePlay={handleTogglePlay}
            speed={speed}
            onSpeedChange={setSpeed}
            tfr={effectiveTFR}
            baseTFR={baseTFR}
            onTFRChange={handleTFRChange}
            tfrConvergenceYears={tfrConvergenceYears}
            onTFRConvergenceYearsChange={handleTFRConvergenceYearsChange}
            mortalityMultiplier={mortalityMultiplier}
            onMortalityChange={handleMortalityChange}
            userSexRatio={effectiveSexRatio}
            baseSexRatio={baseSexRatio}
            onSexRatioChange={handleSexRatioChange}
            loading={loading}
          />
        </aside>

        {/* Main content */}
        <main className="flex flex-1 flex-col overflow-hidden p-6">
          {loading && <LoadingState message={`Loading data for ${country?.name}...`} />}

          {error && (
            <ErrorState
              message={error}
              onRetry={country ? () => handleSelectCountry(country) : undefined}
            />
          )}

          {!loading && !error && !currentSnapshot && (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mb-4 text-6xl">🌍</div>
                <p className="text-lg font-medium text-slate-400">Select a country to begin</p>
                <p className="mt-1 text-sm text-slate-300">Watch population pyramids evolve year by year</p>
              </div>
            </div>
          )}

          {!loading && !error && currentSnapshot && (
            <>
              <div className="mb-4 shrink-0 rounded-xl border border-slate-200 bg-white/80 backdrop-blur p-4 shadow-sm">
                <YearDisplay
                  year={currentSnapshot.year}
                  population={currentSnapshot.population}
                  tfr={effectiveDisplayTFR}
                  targetTFR={tfrConvergenceYears > 0 && userTFR != null ? userTFR : undefined}
                />
              </div>

              <div className="flex flex-1 gap-4 overflow-hidden">
                {/* Pyramid */}
                <div className="relative flex-1 rounded-xl border border-slate-200 bg-white/70 backdrop-blur p-2 shadow-sm overflow-hidden">
                  <Pyramid
                    population={currentSnapshot.population}
                    countryName={country?.name ?? ''}
                    yearsSimulated={yearsSimulated}
                    currentYear={currentSnapshot.year}
                  />
                </div>

                {/* Dual-axis time series chart — always visible */}
                <div className="w-72 shrink-0 rounded-xl border border-slate-200 bg-white/70 backdrop-blur p-3 shadow-sm min-h-0">
                  <DualAxisChart
                    popData={popHistory}
                    tfrData={tfrHistory}
                    currentYear={currentSnapshot.year}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="shrink-0 border-t border-slate-200 bg-white/60 px-6 py-2.5 text-center text-xs text-slate-400">
        <p>
          &copy; Harel Cain |{' '}
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-600 transition-colors">
            CC BY-NC-SA 4.0
          </a>{' '}|{' '}
          <a href="https://github.com/harelc/prurvu" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-600 transition-colors">
            Source Code
          </a>{' '}|{' '}
          <a href="https://www.buymeacoffee.com/harelc" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-500 transition-colors">
            <img src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg" alt="" className="h-3.5 w-3.5" />
            Buy me a coffee
          </a>
        </p>
      </footer>

      {/* Tutorial Modal */}
      {showTutorial && <HowItWorks onClose={() => setShowTutorial(false)} />}
    </div>
  );
}
