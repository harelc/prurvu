import type { AgeGroup } from '../types';
import type { TimeSeriesPoint } from '../components/PopulationChart';

export interface PNGExportMeta {
  countryName: string;
  year: number;
  baseYear: number;
  totalPopulation: string;
  medianAge: number;
  tfr: number;
  mortalityMultiplier: number;
  netMigrationRate: number;
  asfrShiftYears: number;
  tfrConvergenceYears: number;
  dependencyRatio: number;
}



export function exportPyramidPNG(
  svgElement: SVGSVGElement,
  meta: PNGExportMeta,
  filename: string = 'pyramid.png'
): void {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const svgW = svgElement.clientWidth;
    const svgH = svgElement.clientHeight;
    const headerH = 64;
    const footerH = 52;
    const totalW = svgW;
    const totalH = svgH + headerH + footerH;

    const canvas = document.createElement('canvas');
    canvas.width = totalW * scale;
    canvas.height = totalH * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalW, totalH);

    // --- Header ---
    const padX = 16;

    // Title line
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${meta.countryName} — ${meta.year}`, padX, 26);

    // Stats line
    ctx.font = '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#475569';
    const statsLine = `Population: ${meta.totalPopulation}  |  Median Age: ${meta.medianAge}  |  TFR: ${meta.tfr.toFixed(2)}  |  Dependency Ratio: ${meta.dependencyRatio.toFixed(1)}%`;
    ctx.fillText(statsLine, padX, 46);

    // Parameters line (only show non-default)
    const params: string[] = [];
    const mortalityPct = Math.round((1 - meta.mortalityMultiplier) * -100);
    if (mortalityPct !== 0) params.push(`Mortality: ${mortalityPct > 0 ? '+' : ''}${mortalityPct}%`);
    if (meta.netMigrationRate !== 0) params.push(`Migration: ${meta.netMigrationRate > 0 ? '+' : ''}${(meta.netMigrationRate * 100).toFixed(1)}%`);
    if (meta.asfrShiftYears !== 0) params.push(`Childbearing shift: ${meta.asfrShiftYears > 0 ? '+' : ''}${meta.asfrShiftYears}yr`);
    if (meta.tfrConvergenceYears > 0) params.push(`Convergence: ${meta.tfrConvergenceYears}yr`);

    if (params.length > 0) {
      ctx.font = '11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(params.join('  |  '), padX, 60);
    }

    // --- Pyramid SVG ---
    ctx.drawImage(img, 0, headerH);
    URL.revokeObjectURL(url);

    // --- Footer ---
    const footerY = headerH + svgH;

    // Divider line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padX, footerY + 8);
    ctx.lineTo(totalW - padX, footerY + 8);
    ctx.stroke();

    // Left: credit
    ctx.font = '11px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('Age Pyramid Simulator — prurvu.com', padX, footerY + 26);

    // Left: data source
    ctx.font = '10px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`UN World Population Prospects 2024  |  Base year: ${meta.baseYear}  |  Simulated to: ${meta.year}`, padX, footerY + 42);

    // Right: date
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), totalW - padX, footerY + 26);

    canvas.toBlob(blob => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };
  img.src = url;
}

export function exportPopulationCSV(population: AgeGroup[], filename: string = 'population.csv'): void {
  const rows = ['Age,Male,Female,Total'];
  for (const g of population) {
    rows.push(`${g.age},${Math.round(g.male)},${Math.round(g.female)},${Math.round(g.male + g.female)}`);
  }
  downloadCSV(rows.join('\n'), filename);
}

export function exportTimeSeriesCSV(
  popData: TimeSeriesPoint[],
  tfrData: TimeSeriesPoint[],
  filename: string = 'timeseries.csv'
): void {
  const rows = ['Year,Population,TFR'];
  for (let i = 0; i < popData.length; i++) {
    const pop = popData[i];
    const tfr = tfrData[i];
    rows.push(`${pop.year},${Math.round(pop.value)},${tfr?.value.toFixed(3) ?? ''}`);
  }
  downloadCSV(rows.join('\n'), filename);
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
