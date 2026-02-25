import { useState, useCallback, useRef, useEffect } from 'react';
import type { Country, CountrySnapshot } from './types';
import { fetchAllCountryData, getCachedCountryIds } from './api/unApi';
import { stepForward, computeBaseTFR, getTotalPopulation, getMedianAge, getDependencyRatio, getEffectiveASFR } from './simulation/engine';
import type { SimulationParams } from './simulation/engine';
import { Pyramid } from './components/Pyramid';
import { Controls } from './components/Controls';
import { YearDisplay } from './components/YearDisplay';
import { DualAxisChart } from './components/PopulationChart';
import type { TimeSeriesPoint } from './components/PopulationChart';
import { LoadingState, ErrorState } from './components/LoadingState';
import { HowItWorks } from './components/HowItWorks';
import { ASFRChart } from './components/ASFRChart';
import { findCountryByIso3 } from './data/countries';
import type { Scenario } from './data/scenarios';
import { exportPyramidPNG, exportPopulationCSV, exportTimeSeriesCSV } from './utils/export';
import type { PNGExportMeta } from './utils/export';

const BASE_YEAR = 2024;
const MAX_YEAR = 2224; // 200 years into the future

// --- URL Hash Encoding/Decoding ---
function encodeStateToHash(params: {
  iso3?: string;
  years?: number;
  tfr?: number | null;
  convYears?: number;
  mort?: number;
  sexRatio?: number | null;
  mortImprove?: number;
  migration?: number;
  asfrShift?: number;
}): string {
  const parts: string[] = [];
  if (params.iso3) parts.push(params.iso3);
  if (params.years && params.years > 0) parts.push(`y${params.years}`);
  if (params.tfr != null) parts.push(`tfr${params.tfr.toFixed(2)}`);
  if (params.convYears && params.convYears > 0) parts.push(`conv${params.convYears}`);
  if (params.mort != null && params.mort !== 1) parts.push(`mort${params.mort.toFixed(2)}`);
  if (params.sexRatio != null) parts.push(`sr${params.sexRatio.toFixed(2)}`);
  if (params.mortImprove && params.mortImprove > 0) parts.push(`mi${params.mortImprove.toFixed(3)}`);
  if (params.migration && params.migration !== 0) parts.push(`mig${params.migration.toFixed(3)}`);
  if (params.asfrShift && params.asfrShift !== 0) parts.push(`as${params.asfrShift}`);
  return parts.length > 0 ? '#' + parts.join(',') : '';
}

function decodeHashToState(hash: string): {
  iso3?: string;
  years?: number;
  tfr?: number;
  convYears?: number;
  mort?: number;
  sexRatio?: number;
  mortImprove?: number;
  migration?: number;
  asfrShift?: number;
} {
  if (!hash || hash.length < 2) return {};
  const parts = hash.slice(1).split(',');
  const result: ReturnType<typeof decodeHashToState> = {};
  for (const p of parts) {
    if (p.startsWith('y')) result.years = parseInt(p.slice(1));
    else if (p.startsWith('tfr')) result.tfr = parseFloat(p.slice(3));
    else if (p.startsWith('conv')) result.convYears = parseInt(p.slice(4));
    else if (p.startsWith('mort')) result.mort = parseFloat(p.slice(4));
    else if (p.startsWith('sr')) result.sexRatio = parseFloat(p.slice(2));
    else if (p.startsWith('mi')) result.mortImprove = parseFloat(p.slice(2));
    else if (p.startsWith('mig')) result.migration = parseFloat(p.slice(3));
    else if (p.startsWith('as')) result.asfrShift = parseInt(p.slice(2));
    else if (/^[A-Z]{3}$/.test(p)) result.iso3 = p;
  }
  return result;
}

export default function App() {
  const [country, setCountry] = useState<Country | null>(null);
  const [baseSnapshot, setBaseSnapshot] = useState<CountrySnapshot | null>(null);
  const [currentSnapshot, setCurrentSnapshot] = useState<CountrySnapshot | null>(null);
  const [, setSnapshotCache] = useState<Map<number, CountrySnapshot>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.25);
  const [userTFR, setUserTFR] = useState<number | null>(null);
  const [tfrConvergenceYears, setTfrConvergenceYears] = useState(0);
  const [mortalityMultiplier, setMortalityMultiplier] = useState(1);
  const [userSexRatio, setUserSexRatio] = useState<number | null>(null);
  const [mortalityImprovementRate, setMortalityImprovementRate] = useState(0);
  const [netMigrationRate, setNetMigrationRate] = useState(0);
  const [asfrShiftYears, setAsfrShiftYears] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [popHistory, setPopHistory] = useState<TimeSeriesPoint[]>([]);
  const [tfrHistory, setTfrHistory] = useState<TimeSeriesPoint[]>([]);
  const showMomentum = true; // always highlight childbearing age
  const [copyToast, setCopyToast] = useState(false);
  const [cachedCountryIds, setCachedCountryIds] = useState<Set<number>>(new Set());

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [activeScenario, setActiveScenario] = useState<'A' | 'B'>('A');
  const [scenarioBSnapshot, setScenarioBSnapshot] = useState<CountrySnapshot | null>(null);
  const [scenarioBPopHistory, setScenarioBPopHistory] = useState<TimeSeriesPoint[]>([]);
  const [scenarioBTfrHistory, setScenarioBTfrHistory] = useState<TimeSeriesPoint[]>([]);
  // Scenario B params
  const [bUserTFR, setBUserTFR] = useState<number | null>(null);
  const [bTfrConvergenceYears, setBTfrConvergenceYears] = useState(0);
  const [bMortalityMultiplier, setBMortalityMultiplier] = useState(1);
  const [bUserSexRatio, setBUserSexRatio] = useState<number | null>(null);
  const [bMortalityImprovementRate, setBMortalityImprovementRate] = useState(0);
  const [bNetMigrationRate, setBNetMigrationRate] = useState(0);
  const [bAsfrShiftYears, setBAsfrShiftYears] = useState(0);

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pyramidRef = useRef<SVGSVGElement>(null);
  const pendingHashRef = useRef<ReturnType<typeof decodeHashToState> | null>(null);
  const hashUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const baseTFR = baseSnapshot ? computeBaseTFR(baseSnapshot.asfr) : 2.1;
  const baseSexRatio = baseSnapshot?.sexRatio ?? 1.05;

  // Active params depend on compare scenario
  const isB = compareMode && activeScenario === 'B';
  const activeUserTFR = isB ? bUserTFR : userTFR;
  const activeTfrConvergenceYears = isB ? bTfrConvergenceYears : tfrConvergenceYears;
  const activeMortalityMultiplier = isB ? bMortalityMultiplier : mortalityMultiplier;
  const activeUserSexRatio = isB ? bUserSexRatio : userSexRatio;
  const activeNetMigrationRate = isB ? bNetMigrationRate : netMigrationRate;
  const activeAsfrShiftYears = isB ? bAsfrShiftYears : asfrShiftYears;

  const effectiveTFR = activeUserTFR ?? baseTFR;
  const effectiveSexRatio = activeUserSexRatio ?? baseSexRatio;

  const simParams: SimulationParams = {
    userTFR: userTFR ?? undefined,
    mortalityMultiplier,
    userSexRatio: userSexRatio ?? undefined,
    tfrConvergenceRate: tfrConvergenceYears === 0 ? 1 : 1 - Math.pow(0.05, 1 / tfrConvergenceYears),
    mortalityImprovementRate,
    netMigrationRate,
    asfrShiftYears,
  };

  const simParamsB: SimulationParams = {
    userTFR: bUserTFR ?? undefined,
    mortalityMultiplier: bMortalityMultiplier,
    userSexRatio: bUserSexRatio ?? undefined,
    tfrConvergenceRate: bTfrConvergenceYears === 0 ? 1 : 1 - Math.pow(0.05, 1 / bTfrConvergenceYears),
    mortalityImprovementRate: bMortalityImprovementRate,
    netMigrationRate: bNetMigrationRate,
    asfrShiftYears: bAsfrShiftYears,
  };

  const effectiveDisplayTFR = currentSnapshot?.currentTFR ?? effectiveTFR;
  const yearsSimulated = currentSnapshot ? currentSnapshot.year - BASE_YEAR : 0;

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
    setMortalityImprovementRate(0);
    setNetMigrationRate(0);
    setAsfrShiftYears(0);
    setPopHistory([]);
    setTfrHistory([]);
    setCompareMode(false);
    setActiveScenario('A');
    setScenarioBSnapshot(null);
    setScenarioBPopHistory([]);
    setScenarioBTfrHistory([]);
    setBUserTFR(null);
    setBTfrConvergenceYears(0);
    setBMortalityMultiplier(1);
    setBUserSexRatio(null);
    setBMortalityImprovementRate(0);
    setBNetMigrationRate(0);
    setBAsfrShiftYears(0);
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

      // Apply pending hash params if any
      const pending = pendingHashRef.current;
      if (pending) {
        pendingHashRef.current = null;
        if (pending.tfr != null) setUserTFR(pending.tfr);
        if (pending.convYears != null) setTfrConvergenceYears(pending.convYears);
        if (pending.mort != null) setMortalityMultiplier(pending.mort);
        if (pending.sexRatio != null) setUserSexRatio(pending.sexRatio);
        if (pending.mortImprove != null) setMortalityImprovementRate(pending.mortImprove);
        if (pending.migration != null) setNetMigrationRate(pending.migration);
        if (pending.asfrShift != null) setAsfrShiftYears(pending.asfrShift);

        if (pending.years && pending.years > 0) {
          const params: SimulationParams = {
            userTFR: pending.tfr,
            mortalityMultiplier: pending.mort ?? 1,
            userSexRatio: pending.sexRatio,
            tfrConvergenceRate: pending.convYears ? 1 - Math.pow(0.05, 1 / pending.convYears) : 1,
            mortalityImprovementRate: pending.mortImprove ?? 0,
            netMigrationRate: pending.migration ?? 0,
            asfrShiftYears: pending.asfrShift ?? 0,
          };
          const { ph, th, final } = buildHistory(snap, Math.min(pending.years, MAX_YEAR - BASE_YEAR), params);
          setCurrentSnapshot(final);
          setPopHistory(ph);
          setTfrHistory(th);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [buildHistory]);

  const resimulate = useCallback((params: SimulationParams) => {
    if (!baseSnapshot || !currentSnapshot) return;
    const yearsForward = currentSnapshot.year - BASE_YEAR;
    if (yearsForward <= 0) return;
    const { ph, th, final } = buildHistory(baseSnapshot, yearsForward, params);
    setCurrentSnapshot(final);
    setPopHistory(ph);
    setTfrHistory(th);
  }, [baseSnapshot, currentSnapshot, buildHistory]);

  const resimulateB = useCallback((params: SimulationParams) => {
    if (!baseSnapshot || !currentSnapshot) return;
    const yearsForward = currentSnapshot.year - BASE_YEAR;
    if (yearsForward <= 0) {
      setScenarioBSnapshot(baseSnapshot);
      setScenarioBPopHistory([{ year: baseSnapshot.year, value: getTotalPopulation(baseSnapshot.population) }]);
      setScenarioBTfrHistory([{ year: baseSnapshot.year, value: baseSnapshot.tfr }]);
      return;
    }
    const { ph, th, final } = buildHistory(baseSnapshot, yearsForward, params);
    setScenarioBSnapshot(final);
    setScenarioBPopHistory(ph);
    setScenarioBTfrHistory(th);
  }, [baseSnapshot, currentSnapshot, buildHistory]);

  const handleStepForward = useCallback(() => {
    if (!currentSnapshot || currentSnapshot.year >= MAX_YEAR) return;
    const next = stepForward(currentSnapshot, simParams);
    setCurrentSnapshot(next);
    setPopHistory(prev => [...prev, { year: next.year, value: getTotalPopulation(next.population) }]);
    setTfrHistory(prev => [...prev, { year: next.year, value: next.currentTFR ?? next.tfr }]);
    setSnapshotCache(prev => {
      const newCache = new Map(prev);
      newCache.set(next.year, next);
      return newCache;
    });

    // Also advance scenario B
    if (compareMode && scenarioBSnapshot) {
      const nextB = stepForward(scenarioBSnapshot, simParamsB);
      setScenarioBSnapshot(nextB);
      setScenarioBPopHistory(prev => [...prev, { year: nextB.year, value: getTotalPopulation(nextB.population) }]);
      setScenarioBTfrHistory(prev => [...prev, { year: nextB.year, value: nextB.currentTFR ?? nextB.tfr }]);
    }
  }, [currentSnapshot, simParams, compareMode, scenarioBSnapshot, simParamsB]);

  const handleStepBack = useCallback(() => {
    if (!currentSnapshot || !baseSnapshot) return;
    const prevYear = currentSnapshot.year - 1;
    if (prevYear < BASE_YEAR) return;
    const yearsForward = prevYear - BASE_YEAR;
    const { ph, th, final } = buildHistory(baseSnapshot, yearsForward, simParams);
    setCurrentSnapshot(final);
    setPopHistory(ph);
    setTfrHistory(th);

    if (compareMode) {
      const { ph: phB, th: thB, final: finalB } = buildHistory(baseSnapshot, yearsForward, simParamsB);
      setScenarioBSnapshot(finalB);
      setScenarioBPopHistory(phB);
      setScenarioBTfrHistory(thB);
    }
  }, [currentSnapshot, baseSnapshot, simParams, simParamsB, compareMode, buildHistory]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    if (baseSnapshot) {
      setCurrentSnapshot(baseSnapshot);
      setPopHistory([{ year: baseSnapshot.year, value: getTotalPopulation(baseSnapshot.population) }]);
      setTfrHistory([{ year: baseSnapshot.year, value: baseSnapshot.tfr }]);
      if (compareMode) {
        setScenarioBSnapshot(baseSnapshot);
        setScenarioBPopHistory([{ year: baseSnapshot.year, value: getTotalPopulation(baseSnapshot.population) }]);
        setScenarioBTfrHistory([{ year: baseSnapshot.year, value: baseSnapshot.tfr }]);
      }
    }
  }, [baseSnapshot, compareMode]);

  const handleTogglePlay = useCallback(() => {
    setPlaying(prev => !prev);
  }, []);

  // Parameter change handlers — update A or B depending on active scenario
  const handleTFRChange = useCallback((newTFR: number) => {
    if (isB) {
      setBUserTFR(newTFR);
      const params = { ...simParamsB, userTFR: newTFR };
      resimulateB(params);
    } else {
      setUserTFR(newTFR);
      const params = { ...simParams, userTFR: newTFR };
      resimulate(params);
    }
  }, [isB, simParams, simParamsB, resimulate, resimulateB]);

  const handleMortalityChange = useCallback((value: number) => {
    if (isB) {
      setBMortalityMultiplier(value);
      resimulateB({ ...simParamsB, mortalityMultiplier: value });
    } else {
      setMortalityMultiplier(value);
      resimulate({ ...simParams, mortalityMultiplier: value });
    }
  }, [isB, simParams, simParamsB, resimulate, resimulateB]);

  const handleSexRatioChange = useCallback((value: number) => {
    if (isB) {
      setBUserSexRatio(value);
      resimulateB({ ...simParamsB, userSexRatio: value });
    } else {
      setUserSexRatio(value);
      resimulate({ ...simParams, userSexRatio: value });
    }
  }, [isB, simParams, simParamsB, resimulate, resimulateB]);

  const handleTFRConvergenceYearsChange = useCallback((years: number) => {
    const rate = years === 0 ? 1 : 1 - Math.pow(0.05, 1 / years);
    if (isB) {
      setBTfrConvergenceYears(years);
      resimulateB({ ...simParamsB, tfrConvergenceRate: rate });
    } else {
      setTfrConvergenceYears(years);
      resimulate({ ...simParams, tfrConvergenceRate: rate });
    }
  }, [isB, simParams, simParamsB, resimulate, resimulateB]);

  const handleNetMigrationChange = useCallback((value: number) => {
    if (isB) {
      setBNetMigrationRate(value);
      resimulateB({ ...simParamsB, netMigrationRate: value });
    } else {
      setNetMigrationRate(value);
      resimulate({ ...simParams, netMigrationRate: value });
    }
  }, [isB, simParams, simParamsB, resimulate, resimulateB]);

  const handleAsfrShiftChange = useCallback((value: number) => {
    if (isB) {
      setBAsfrShiftYears(value);
      resimulateB({ ...simParamsB, asfrShiftYears: value });
    } else {
      setAsfrShiftYears(value);
      resimulate({ ...simParams, asfrShiftYears: value });
    }
  }, [isB, simParams, simParamsB, resimulate, resimulateB]);

  const handleApplyScenario = useCallback(async (scenario: Scenario) => {
    const p = scenario.params;
    const scenarioCountry = findCountryByIso3(scenario.countryIso3);
    if (!scenarioCountry) return;

    // If different country, load it first, then apply params via pending ref
    if (!country || country.iso3 !== scenario.countryIso3) {
      // Store scenario params to apply after country loads
      pendingHashRef.current = {
        tfr: p.userTFR,
        convYears: p.tfrConvergenceYears,
        mort: p.mortalityMultiplier,
        sexRatio: p.userSexRatio,
        mortImprove: p.mortalityImprovementRate,
        migration: p.netMigrationRate,
        asfrShift: p.asfrShiftYears,
      };
      await handleSelectCountry(scenarioCountry);
      return;
    }

    // Same country — apply params directly
    if (isB) {
      if (p.userTFR != null) setBUserTFR(p.userTFR);
      if (p.mortalityMultiplier != null) setBMortalityMultiplier(p.mortalityMultiplier);
      if (p.userSexRatio != null) setBUserSexRatio(p.userSexRatio);
      if (p.tfrConvergenceYears != null) setBTfrConvergenceYears(p.tfrConvergenceYears);
      if (p.mortalityImprovementRate != null) setBMortalityImprovementRate(p.mortalityImprovementRate);
      if (p.netMigrationRate != null) setBNetMigrationRate(p.netMigrationRate);
      if (p.asfrShiftYears != null) setBAsfrShiftYears(p.asfrShiftYears);
      const newParams: SimulationParams = {
        ...simParamsB,
        ...p,
        tfrConvergenceRate: p.tfrConvergenceYears != null
          ? (p.tfrConvergenceYears === 0 ? 1 : 1 - Math.pow(0.05, 1 / p.tfrConvergenceYears))
          : simParamsB.tfrConvergenceRate,
      };
      resimulateB(newParams);
    } else {
      if (p.userTFR != null) setUserTFR(p.userTFR);
      if (p.mortalityMultiplier != null) setMortalityMultiplier(p.mortalityMultiplier);
      if (p.userSexRatio != null) setUserSexRatio(p.userSexRatio);
      if (p.tfrConvergenceYears != null) setTfrConvergenceYears(p.tfrConvergenceYears);
      if (p.mortalityImprovementRate != null) setMortalityImprovementRate(p.mortalityImprovementRate);
      if (p.netMigrationRate != null) setNetMigrationRate(p.netMigrationRate);
      if (p.asfrShiftYears != null) setAsfrShiftYears(p.asfrShiftYears);
      const newParams: SimulationParams = {
        ...simParams,
        ...p,
        tfrConvergenceRate: p.tfrConvergenceYears != null
          ? (p.tfrConvergenceYears === 0 ? 1 : 1 - Math.pow(0.05, 1 / p.tfrConvergenceYears))
          : simParams.tfrConvergenceRate,
      };
      resimulate(newParams);
    }
  }, [isB, simParams, simParamsB, resimulate, resimulateB, country, handleSelectCountry]);

  const handleCompareModeToggle = useCallback(() => {
    setCompareMode(prev => {
      if (!prev && baseSnapshot && currentSnapshot) {
        // Initialize scenario B with same state
        const yearsForward = currentSnapshot.year - BASE_YEAR;
        if (yearsForward > 0) {
          const { ph, th, final } = buildHistory(baseSnapshot, yearsForward, simParams);
          setScenarioBSnapshot(final);
          setScenarioBPopHistory(ph);
          setScenarioBTfrHistory(th);
        } else {
          setScenarioBSnapshot(baseSnapshot);
          setScenarioBPopHistory([{ year: baseSnapshot.year, value: getTotalPopulation(baseSnapshot.population) }]);
          setScenarioBTfrHistory([{ year: baseSnapshot.year, value: baseSnapshot.tfr }]);
        }
        // Copy A params to B
        setBUserTFR(userTFR);
        setBTfrConvergenceYears(tfrConvergenceYears);
        setBMortalityMultiplier(mortalityMultiplier);
        setBUserSexRatio(userSexRatio);
        setBMortalityImprovementRate(mortalityImprovementRate);
        setBNetMigrationRate(netMigrationRate);
        setBAsfrShiftYears(asfrShiftYears);
      }
      return !prev;
    });
    setActiveScenario('A');
  }, [baseSnapshot, currentSnapshot, simParams, userTFR, tfrConvergenceYears, mortalityMultiplier, userSexRatio, mortalityImprovementRate, netMigrationRate, asfrShiftYears, buildHistory]);

  // Playback effect with 200-year cap
  useEffect(() => {
    if (playing && currentSnapshot) {
      if (currentSnapshot.year >= MAX_YEAR) {
        setPlaying(false);
        return;
      }
      playIntervalRef.current = setInterval(() => {
        setCurrentSnapshot(prev => {
          if (!prev || prev.year >= MAX_YEAR) {
            setPlaying(false);
            return prev;
          }
          const next = stepForward(prev, simParams);
          setTimeout(() => {
            setPopHistory(h => [...h, { year: next.year, value: getTotalPopulation(next.population) }]);
            setTfrHistory(h => [...h, { year: next.year, value: next.currentTFR ?? next.tfr }]);
          }, 0);

          // Also advance B
          if (compareMode) {
            setScenarioBSnapshot(prevB => {
              if (!prevB) return prevB;
              const nextB = stepForward(prevB, simParamsB);
              setTimeout(() => {
                setScenarioBPopHistory(h => [...h, { year: nextB.year, value: getTotalPopulation(nextB.population) }]);
                setScenarioBTfrHistory(h => [...h, { year: nextB.year, value: nextB.currentTFR ?? nextB.tfr }]);
              }, 0);
              return nextB;
            });
          }

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
  }, [playing, speed, simParams, simParamsB, compareMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (currentSnapshot && currentSnapshot.year < MAX_YEAR) {
            setPlaying(prev => !prev);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (!playing) handleStepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (!playing) handleStepBack();
          break;
        case 'KeyR':
          e.preventDefault();
          handleReset();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentSnapshot, playing, handleStepForward, handleStepBack, handleReset]);

  // Load cached country IDs on mount
  useEffect(() => {
    getCachedCountryIds().then(setCachedCountryIds);
  }, []);

  // URL hash: parse on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    const parsed = decodeHashToState(hash);
    if (parsed.iso3) {
      const c = findCountryByIso3(parsed.iso3);
      if (c) {
        pendingHashRef.current = parsed;
        handleSelectCountry(c);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL hash: update on state change (debounced)
  useEffect(() => {
    if (!country || !currentSnapshot) return;
    if (hashUpdateTimerRef.current) clearTimeout(hashUpdateTimerRef.current);
    hashUpdateTimerRef.current = setTimeout(() => {
      const hash = encodeStateToHash({
        iso3: country.iso3,
        years: currentSnapshot.year - BASE_YEAR,
        tfr: userTFR,
        convYears: tfrConvergenceYears,
        mort: mortalityMultiplier,
        sexRatio: userSexRatio,
        mortImprove: mortalityImprovementRate,
        migration: netMigrationRate,
        asfrShift: asfrShiftYears,
      });
      window.history.replaceState(null, '', hash || window.location.pathname);
    }, 500);
  }, [country, currentSnapshot, userTFR, tfrConvergenceYears, mortalityMultiplier, userSexRatio, mortalityImprovementRate, netMigrationRate, asfrShiftYears]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    });
  }, []);

  const handleExportPNG = useCallback(() => {
    if (pyramidRef.current && currentSnapshot) {
      const n = getTotalPopulation(currentSnapshot.population);
      const popStr = n >= 1e9 ? (n / 1e9).toFixed(2) + 'B'
        : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M'
        : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K'
        : Math.round(n).toString();
      const meta: PNGExportMeta = {
        countryName: country?.name ?? 'Unknown',
        year: currentSnapshot.year,
        baseYear: BASE_YEAR,
        totalPopulation: popStr,
        medianAge: getMedianAge(currentSnapshot.population),
        tfr: effectiveDisplayTFR,
        mortalityMultiplier,
        netMigrationRate,
        asfrShiftYears,
        tfrConvergenceYears,
        dependencyRatio: getDependencyRatio(currentSnapshot.population),
      };
      exportPyramidPNG(pyramidRef.current, meta, `pyramid-${country?.iso3 ?? 'data'}-${currentSnapshot.year}.png`);
    }
  }, [country, currentSnapshot, effectiveDisplayTFR, mortalityMultiplier, netMigrationRate, asfrShiftYears, tfrConvergenceYears]);

  const handleExportCSV = useCallback(() => {
    if (currentSnapshot) {
      exportPopulationCSV(currentSnapshot.population, `population-${country?.iso3 ?? 'data'}-${currentSnapshot.year}.csv`);
    }
  }, [currentSnapshot, country]);

  const handleExportTimeSeries = useCallback(() => {
    exportTimeSeriesCSV(popHistory, tfrHistory, `timeseries-${country?.iso3 ?? 'data'}.csv`);
  }, [popHistory, tfrHistory, country]);

  // Compute effective ASFR for histogram
  const effectiveASFR = baseSnapshot
    ? getEffectiveASFR(baseSnapshot.asfr, effectiveDisplayTFR, activeAsfrShiftYears)
    : [];

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-200 via-slate-100 to-stone-200 text-slate-800 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-200 bg-slate-50/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Age Pyramid Simulator
          </h1>
          <p className="text-xs text-slate-400 italic">
            Be fruitful and multiply (Genesis 1:28)
          </p>
          <p className="text-[10px] text-slate-400">
            Based on <a href="https://population.un.org/wpp/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600 transition-colors">UN World Population Prospects 2024</a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {country && (
            <button
              onClick={handleCopyLink}
              className="relative rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              {copyToast ? 'Copied!' : 'Copy link'}
            </button>
          )}
          <button
            onClick={() => setShowTutorial(true)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            How it works
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50/40 backdrop-blur p-5">
          <Controls
            selectedCountry={country}
            onSelectCountry={handleSelectCountry}
            year={currentSnapshot?.year ?? BASE_YEAR}
            baseYear={BASE_YEAR}
            maxYear={MAX_YEAR}
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
            tfrConvergenceYears={activeTfrConvergenceYears}
            onTFRConvergenceYearsChange={handleTFRConvergenceYearsChange}
            mortalityMultiplier={activeMortalityMultiplier}
            onMortalityChange={handleMortalityChange}
            userSexRatio={effectiveSexRatio}
            baseSexRatio={baseSexRatio}
            onSexRatioChange={handleSexRatioChange}
            netMigrationRate={activeNetMigrationRate}
            onNetMigrationChange={handleNetMigrationChange}
            asfrShiftYears={activeAsfrShiftYears}
            onAsfrShiftChange={handleAsfrShiftChange}
            loading={loading}
            cachedCountryIds={cachedCountryIds}
            onApplyScenario={handleApplyScenario}
            compareMode={compareMode}
            onCompareModeToggle={handleCompareModeToggle}
            activeScenario={activeScenario}
            onActiveScenarioChange={setActiveScenario}
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
              <div className="mb-3 shrink-0 rounded-xl border border-slate-200 bg-slate-50/50 backdrop-blur px-4 py-2 shadow-sm">
                <YearDisplay
                  year={currentSnapshot.year}
                  population={currentSnapshot.population}
                  tfr={effectiveDisplayTFR}
                  targetTFR={tfrConvergenceYears > 0 && userTFR != null ? userTFR : undefined}
                  comparePopulation={compareMode ? scenarioBSnapshot?.population : undefined}
                  compareTFR={compareMode ? (scenarioBSnapshot?.currentTFR ?? scenarioBSnapshot?.tfr) : undefined}
                />
              </div>

              <div className="flex flex-1 gap-4 overflow-hidden">
                {/* Pyramid */}
                <div className="relative flex-[3] min-w-0 rounded-xl border border-slate-200 bg-slate-50/40 backdrop-blur p-2 shadow-sm overflow-hidden">
                  {/* Export buttons */}
                  <div className="absolute top-3 right-3 z-10 flex gap-1">
                    <button
                      onClick={handleExportPNG}
                      className="rounded bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                      title="Export pyramid as PNG"
                    >
                      PNG
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="rounded bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                      title="Export population data as CSV"
                    >
                      CSV
                    </button>
                  </div>
                  <Pyramid
                    ref={pyramidRef}
                    population={currentSnapshot.population}
                    countryName={country?.name ?? ''}
                    yearsSimulated={yearsSimulated}
                    currentYear={currentSnapshot.year}
                    comparisonPopulation={compareMode ? scenarioBSnapshot?.population : undefined}
                    showMomentum={showMomentum}
                  />
                </div>

                {/* Right panel: Dual-axis chart + ASFR histogram */}
                <div className="flex-[2] min-w-0 flex flex-col gap-3 overflow-hidden">
                  <div className="flex-[2] rounded-xl border border-slate-200 bg-slate-50/40 backdrop-blur p-3 shadow-sm min-h-0 overflow-hidden">
                    <div className="flex justify-end mb-1">
                      <button
                        onClick={handleExportTimeSeries}
                        className="rounded bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                        title="Export time series as CSV"
                      >
                        CSV
                      </button>
                    </div>
                    <DualAxisChart
                      popData={popHistory}
                      tfrData={tfrHistory}
                      currentYear={currentSnapshot.year}
                      baseYear={BASE_YEAR}
                      maxYear={MAX_YEAR}
                      popDataB={compareMode ? scenarioBPopHistory : undefined}
                      tfrDataB={compareMode ? scenarioBTfrHistory : undefined}
                    />
                  </div>
                  {baseSnapshot && effectiveASFR.length > 0 && (
                    <div className="flex-1 min-h-[10rem] rounded-xl border border-slate-200 bg-slate-50/40 backdrop-blur p-3 shadow-sm">
                      <ASFRChart asfr={effectiveASFR} />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="shrink-0 border-t border-slate-200 bg-slate-50/40 px-6 py-2.5 text-center text-xs text-slate-400">
        <p className="flex items-center justify-center gap-1">
          <span>&copy; Harel Cain</span>
          <span>|</span>
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-600 transition-colors">
            CC BY-NC-SA 4.0
          </a>
          <span>|</span>
          <a href="https://github.com/harelc/prurvu" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-600 transition-colors">
            Source Code
          </a>
          <span>|</span>
          <a href="https://www.buymeacoffee.com/harelc" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-500 transition-colors align-middle">
            <img src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg" alt="" className="h-3.5 w-3.5 inline-block align-middle" />
            <span className="align-middle">Buy me a coffee</span>
          </a>
        </p>
      </footer>

      {/* Tutorial Modal */}
      {showTutorial && <HowItWorks onClose={() => setShowTutorial(false)} />}
    </div>
  );
}
