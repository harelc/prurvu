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
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200"
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
              age-specific mortality rate <Eq tex="m(a,s)" /> to compute survivors:
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="\text{Survivors}(a, s) = P(a, s) \times \bigl(1 - m(a, s)\bigr)" display />
            </div>
            <p>
              where <Eq tex="P(a,s)" /> is the population at age <Eq tex="a" /> and sex <Eq tex="s" />,
              and <Eq tex="m(a,s)" /> is the central death rate from the UN life tables (indicator 80).
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
              <Eq tex="B_x = \text{ASFR}_x \times \frac{1}{1000} \times \sum_{a=x}^{x+4} P(a, \text{female})" display />
            </div>
            <p>
              Total births:
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="B = \sum_{x \in \{15,20,25,30,35,40,45\}} B_x" display />
            </div>
            <p>
              Births are split by sex using the sex ratio at birth <Eq tex="r" /> (males per female):
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="P'(0, \text{male}) = B \cdot \frac{r}{1+r}, \qquad P'(0, \text{female}) = B \cdot \frac{1}{1+r}" display />
            </div>
          </section>

          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2">TFR Scaling (What-If)</h3>
            <p>
              The Total Fertility Rate is the sum of all age-specific rates across the childbearing span:
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="\text{TFR} = \sum_x \text{ASFR}_x \times \frac{5}{1000}" display />
            </div>
            <p>
              When you adjust the TFR slider to a user value <Eq tex="\text{TFR}^*" />,
              all ASFR values are uniformly scaled:
            </p>
            <div className="my-3 rounded-lg bg-slate-50 px-4 py-3 overflow-x-auto">
              <Eq tex="\text{ASFR}'_x = \text{ASFR}_x \times \frac{\text{TFR}^*}{\text{TFR}_{\text{base}}}" display />
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
            <h3 className="text-base font-bold text-slate-800 mb-2">Limitations</h3>
            <ul className="list-disc ml-5 space-y-1.5">
              <li>Migration is not modeled — only natural change (births minus deaths)</li>
              <li>Mortality and ASFR age schedules are held constant from the base year</li>
              <li>The open-ended age group (100+) is simplified</li>
              <li>Results diverge further from UN projections over longer time horizons</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
