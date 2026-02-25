import { useState, useCallback, useRef, useEffect } from 'react';
import type { Country, CountrySnapshot } from './types';
import { fetchAllCountryData } from './api/unApi';
import { stepForward, simulateYears, computeBaseTFR } from './simulation/engine';
import { Pyramid } from './components/Pyramid';
import { Controls } from './components/Controls';
import { YearDisplay } from './components/YearDisplay';
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
  const [speed, setSpeed] = useState(1);
  const [userTFR, setUserTFR] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const baseTFR = baseSnapshot ? computeBaseTFR(baseSnapshot.asfr) : 2.1;
  const effectiveTFR = userTFR ?? baseTFR;

  const handleSelectCountry = useCallback(async (c: Country) => {
    setPlaying(false);
    setCountry(c);
    setBaseSnapshot(null);
    setCurrentSnapshot(null);
    setSnapshotCache(new Map());
    setError(null);
    setUserTFR(null);
    setLoading(true);

    try {
      const snap = await fetchAllCountryData(c.id, BASE_YEAR);
      setBaseSnapshot(snap);
      setCurrentSnapshot(snap);
      const cache = new Map<number, CountrySnapshot>();
      cache.set(BASE_YEAR, snap);
      setSnapshotCache(cache);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStepForward = useCallback(() => {
    if (!currentSnapshot) return;
    const nextYear = currentSnapshot.year + 1;
    const cached = snapshotCache.get(nextYear);

    if (cached && userTFR == null) {
      setCurrentSnapshot(cached);
    } else {
      const next = stepForward(currentSnapshot, userTFR ?? undefined);
      setCurrentSnapshot(next);
      setSnapshotCache(prev => {
        const newCache = new Map(prev);
        newCache.set(nextYear, next);
        return newCache;
      });
    }
  }, [currentSnapshot, snapshotCache, userTFR]);

  const handleStepBack = useCallback(() => {
    if (!currentSnapshot || !baseSnapshot) return;
    const prevYear = currentSnapshot.year - 1;
    if (prevYear < BASE_YEAR) return;
    const snap = prevYear === BASE_YEAR
      ? baseSnapshot
      : simulateYears(baseSnapshot, prevYear - BASE_YEAR, userTFR ?? undefined);
    setCurrentSnapshot(snap);
  }, [currentSnapshot, baseSnapshot, userTFR]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    if (baseSnapshot) setCurrentSnapshot(baseSnapshot);
  }, [baseSnapshot]);

  const handleTogglePlay = useCallback(() => {
    setPlaying(prev => !prev);
  }, []);

  const handleTFRChange = useCallback((newTFR: number) => {
    setUserTFR(newTFR);
    if (baseSnapshot && currentSnapshot) {
      const yearsForward = currentSnapshot.year - BASE_YEAR;
      if (yearsForward > 0) {
        const recomputed = simulateYears(baseSnapshot, yearsForward, newTFR);
        setCurrentSnapshot(recomputed);
      }
    }
  }, [baseSnapshot, currentSnapshot]);

  useEffect(() => {
    if (playing && currentSnapshot) {
      playIntervalRef.current = setInterval(() => {
        setCurrentSnapshot(prev => {
          if (!prev) return prev;
          return stepForward(prev, userTFR ?? undefined);
        });
      }, speed * 1000);
    }
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, [playing, speed, userTFR, currentSnapshot?.year]);

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
                  tfr={effectiveTFR}
                />
              </div>

              <div className="relative flex-1 rounded-xl border border-slate-200 bg-white/70 backdrop-blur p-2 shadow-sm overflow-hidden">
                <Pyramid
                  population={currentSnapshot.population}
                  countryName={country?.name ?? ''}
                />
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
