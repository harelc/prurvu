import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface HowItWorksProps {
  onClose: () => void;
}

function Eq({ tex, display = false }: { tex: string; display?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      katex.render(tex, ref.current, { displayMode: display, throwOnError: false });
    }
  }, [tex, display]);
  return <span ref={ref} />;
}

export function HowItWorks({ onClose }: HowItWorksProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur px-6 py-4 rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-800">How This Works</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 text-sm text-slate-600 leading-relaxed">
          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2">Overview</h3>
            <p>
              This simulator uses the <strong>cohort-component method</strong>, the standard demographic technique
              for population projection. Starting from real population data by single-year age and sex, it steps
              forward one year at a time by applying three processes: <em>mortality</em>, <em>aging</em>, and <em>fertility</em>.
            </p>
            <p className="mt-2">
              All input data comes from the{' '}
              <a href="https://population.un.org/wpp/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                UN World Population Prospects 2024
              </a>{' '}
              (median variant).
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2">Step 1: Deaths (Survival)</h3>
            <p>
              For each single-year age <Eq tex="a" /> (0 to 100) and sex <Eq tex="s" />, we apply the
              age-specific mortality rate <Eq tex="m(a,s)" /> scaled by the mortality multiplier <Eq tex="\mu" /> to compute survivors:
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="\text{Survivors}(a, s) = P(a, s) \times \bigl(1 - \min(\mu \cdot m(a, s),\; 1)\bigr)" display />
            </div>
            <p>
              where <Eq tex="P(a,s)" /> is the population at age <Eq tex="a" /> and sex <Eq tex="s" />,
              <Eq tex="m(a,s)" /> is the central death rate from the UN life tables (indicator 80),
              and <Eq tex="\mu \in [0.5, 1.5]" /> is the user-adjustable mortality multiplier (default 1).
              Lower <Eq tex="\mu" /> means lower mortality (longer life expectancy).
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2">Step 2: Aging</h3>
            <p>
              All survivors advance one year in age:
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="P'(a+1, s) = \text{Survivors}(a, s)" display />
            </div>
            <p>
              Ages 100+ form an open-ended interval that accumulates:
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="P'(100^+, s) = \text{Survivors}(99, s) + \text{Survivors}(100^+, s)" display />
            </div>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2">Step 3: Births</h3>
            <p>
              Age-specific fertility rates (ASFR) are given for 5-year age groups of women,
              expressed per 1,000 women per year. For each group <Eq tex="[x, x+5)" />:
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="B_x = \text{ASFR}'_x \times \frac{1}{1000} \times \sum_{a=x}^{x+4} P(a, \text{female})" display />
            </div>
            <p>
              Total births are multiplied by a <strong>birth calibration factor</strong> <Eq tex="k" /> that
              corrects for net infant migration and mid-year timing effects. This factor is computed once from
              the base year by comparing the actual age-0 cohort to the ASFR-simulated births:
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="B = k \cdot \sum_{x \in \{15,20,25,30,35,40,45\}} B_x" display />
            </div>
            <p>
              Births are split by sex using the sex ratio at birth <Eq tex="r" /> (males per female, adjustable):
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="P'(0, \text{male}) = B \cdot \frac{r}{1+r}, \qquad P'(0, \text{female}) = B \cdot \frac{1}{1+r}" display />
            </div>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2">TFR Scaling & Convergence</h3>
            <p>
              The Total Fertility Rate is the sum of all age-specific rates across the childbearing span:
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="\text{TFR} = \sum_x \text{ASFR}_x \times \frac{5}{1000}" display />
            </div>
            <p>
              When you set a target TFR <Eq tex="\text{TFR}^*" /> via the Modified TFR slider,
              the effective TFR used each year depends on the <strong>convergence setting</strong>.
            </p>
            <p className="mt-2">
              With convergence set to <Eq tex="N" /> years, the effective TFR blends exponentially toward the target.
              The convergence rate <Eq tex="\alpha" /> is chosen so that 95% of the gap is closed in <Eq tex="N" /> years:
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="\alpha = 1 - 0.05^{1/N}" display />
            </div>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="\text{TFR}_{\text{eff}}(t+1) = \text{TFR}_{\text{eff}}(t) + \alpha \cdot \bigl(\text{TFR}^* - \text{TFR}_{\text{eff}}(t)\bigr)" display />
            </div>
            <p>
              When convergence is set to "Instant" (<Eq tex="N=0" />), the effective TFR jumps immediately to <Eq tex="\text{TFR}^*" />.
              All ASFR values are then uniformly scaled:
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="\text{ASFR}'_x = \text{ASFR}_x \times \frac{\text{TFR}_{\text{eff}}}{\text{TFR}_{\text{base}}}" display />
            </div>
            <p>
              This preserves the age pattern of fertility while changing the overall level.
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2">Key Statistics</h3>
            <ul className="list-disc ml-5 space-y-1.5">
              <li><strong>Total Population</strong>: sum of all age-sex groups</li>
              <li><strong>Median Age</strong>: the age at which half the population is younger</li>
              <li>
                <strong>Dependency Ratio</strong>:
                <div className="mt-1">
                  <Eq tex="\text{DR} = \frac{P_{0\text{-}14} + P_{65+}}{P_{15\text{-}64}} \times 100\%" display />
                </div>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2">Visual Indicators</h3>
            <ul className="list-disc ml-5 space-y-1.5">
              <li><strong>Gender excess</strong>: where one sex outnumbers the other at a given age, the excess portion is highlighted in a brighter shade on the pyramid</li>
              <li><strong>Future-born line</strong>: a dashed red line marks the boundary between cohorts that existed at the base year and those born during the simulation</li>
              <li><strong>Age / birth year</strong>: the center axis shows both age and year of birth for orientation</li>
              <li><strong>Dual-axis chart</strong>: tracks total population (left axis, blue) and effective TFR (right axis, orange) over simulation time. A dashed line at TFR 2.1 marks replacement level</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2">Advanced Parameters</h3>
            <ul className="list-disc ml-5 space-y-1.5">
              <li>
                <strong>Mortality Improvement</strong>: an annual compounding reduction in mortality rates (0–3%/year), simulating
                medical advances. Each year, all mortality rates are multiplied by an accumulated factor that compounds:
                <div className="mt-1">
                  <Eq tex="f(t) = f(t-1) \times (1 - r)" display />
                </div>
                where <Eq tex="r" /> is the improvement rate. At 1.5%/yr, mortality drops ~53% after 50 years.
              </li>
              <li>
                <strong>Net Migration</strong>: migrants distributed by a simplified Rogers-Castro age profile (peak at ages 25-30,
                children bump at 0-4, near zero after 65). Positive values = immigration, negative = emigration.
              </li>
              <li>
                <strong>Childbearing Age Shift</strong>: shifts the entire ASFR age schedule by N years, simulating delayed or
                earlier motherhood. The shifted schedule is clipped to the biologically plausible range (15–50) and then
                rescaled to preserve the target TFR.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2">Compare Mode</h3>
            <p>
              Toggle Compare Mode to overlay a second scenario (B) on the pyramid as dashed green outlines,
              with a second line on the time series chart. Switch between editing Scenario A and B parameters
              using the A/B tab selector. Both scenarios advance in lockstep.
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2">Keyboard Shortcuts</h3>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>Space</strong>: Play / Pause</li>
              <li><strong>Right arrow</strong>: Step forward one year</li>
              <li><strong>Left arrow</strong>: Step back one year</li>
              <li><strong>R</strong>: Reset to base year</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2">Limitations</h3>
            <ul className="list-disc ml-5 space-y-1.5">
              <li>Mortality and ASFR age schedules are held constant from the base year (only the level changes, not the shape)</li>
              <li>Migration uses a simplified age profile, not country-specific data</li>
              <li>The open-ended age group (100+) is simplified</li>
              <li>Results diverge further from UN projections over longer time horizons</li>
              <li>Simulation is capped at 200 years into the future</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
