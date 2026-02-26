/**
 * Monotone cubic interpolation (Fritsch-Carlson method).
 * Given a set of control points sorted by year, produces a smooth curve
 * that passes through all points and preserves monotonicity between consecutive points.
 */

export interface SplinePoint {
  year: number;
  tfr: number;
}

/**
 * Generate a full TFR path from control points using monotone cubic interpolation.
 * Returns one {year, tfr} entry for every integer year in [minYear, maxYear].
 */
export function interpolateSpline(
  controlPoints: SplinePoint[],
  minYear: number,
  maxYear: number
): SplinePoint[] {
  if (controlPoints.length === 0) return [];

  // Sort by year
  const pts = [...controlPoints].sort((a, b) => a.year - b.year);

  if (pts.length === 1) {
    // Single point: constant TFR
    const result: SplinePoint[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      result.push({ year: y, tfr: pts[0].tfr });
    }
    return result;
  }

  const n = pts.length;
  const xs = pts.map(p => p.year);
  const ys = pts.map(p => p.tfr);

  // Step 1: Compute slopes of secant lines
  const deltas: number[] = [];
  const hs: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    hs.push(xs[i + 1] - xs[i]);
    deltas.push((ys[i + 1] - ys[i]) / hs[i]);
  }

  // Step 2: Initialize tangents
  const ms: number[] = new Array(n);
  ms[0] = deltas[0];
  ms[n - 1] = deltas[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (deltas[i - 1] * deltas[i] <= 0) {
      ms[i] = 0;
    } else {
      ms[i] = (deltas[i - 1] + deltas[i]) / 2;
    }
  }

  // Step 3: Fritsch-Carlson modification to ensure monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(deltas[i]) < 1e-12) {
      ms[i] = 0;
      ms[i + 1] = 0;
    } else {
      const alpha = ms[i] / deltas[i];
      const beta = ms[i + 1] / deltas[i];
      // Ensure we stay in the monotonicity region
      const s = alpha * alpha + beta * beta;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        ms[i] = tau * alpha * deltas[i];
        ms[i + 1] = tau * beta * deltas[i];
      }
    }
  }

  // Step 4: Evaluate the Hermite interpolant at each integer year
  const result: SplinePoint[] = [];

  for (let y = minYear; y <= maxYear; y++) {
    let tfr: number;

    if (y <= xs[0]) {
      tfr = ys[0];
    } else if (y >= xs[n - 1]) {
      tfr = ys[n - 1];
    } else {
      // Find the interval
      let seg = 0;
      for (let i = 0; i < n - 1; i++) {
        if (y >= xs[i] && y < xs[i + 1]) {
          seg = i;
          break;
        }
      }

      const h = hs[seg];
      const t = (y - xs[seg]) / h;
      const t2 = t * t;
      const t3 = t2 * t;

      // Hermite basis functions
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;

      tfr = h00 * ys[seg] + h10 * h * ms[seg] + h01 * ys[seg + 1] + h11 * h * ms[seg + 1];
    }

    // Clamp TFR to reasonable range
    result.push({ year: y, tfr: Math.max(0, Math.min(15, tfr)) });
  }

  return result;
}
