import { useRef, useEffect } from 'react';

export interface TimeSeriesPoint {
  year: number;
  value: number;
}

interface DualAxisChartProps {
  popData: TimeSeriesPoint[];
  tfrData: TimeSeriesPoint[];
  currentYear: number;
}

function formatPop(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return Math.round(n).toString();
}

export function DualAxisChart({ popData, tfrData, currentYear }: DualAxisChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || popData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    const padLeft = 52;
    const padRight = 42;
    const padTop = 12;
    const padBottom = 30;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    ctx.clearRect(0, 0, w, h);

    // Compute ranges
    const allYears = popData.map(d => d.year);
    const minYear = Math.min(...allYears);
    const maxYear = Math.max(...allYears);

    const popVals = popData.map(d => d.value);
    const rawPopMax = Math.max(...popVals);
    // Zero-based population axis
    const popMin = 0;
    const popMax = rawPopMax * 1.1;

    // Fixed TFR axis range
    const tfrMin = 0.7;
    const tfrMax = 5;

    const xScale = (year: number) => padLeft + ((year - minYear) / Math.max(maxYear - minYear, 1)) * plotW;
    const yPop = (v: number) => padTop + plotH - ((v - popMin) / Math.max(popMax - popMin, 1)) * plotH;
    const yTfr = (v: number) => padTop + plotH - ((v - tfrMin) / Math.max(tfrMax - tfrMin, 1)) * plotH;

    const popColor = '#3b82f6';
    const tfrColor = '#f97316';

    // Grid lines (based on pop axis)
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();
    }

    // Left axis labels (Population)
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const v = popMin + (popMax - popMin) * ((4 - i) / 4);
      const y = padTop + (plotH * i) / 4;
      ctx.fillStyle = popColor;
      ctx.fillText(formatPop(v), padLeft - 5, y + 3);
    }

    // Right axis labels (TFR)
    ctx.textAlign = 'left';
    for (let i = 0; i <= 4; i++) {
      const v = tfrMin + (tfrMax - tfrMin) * ((4 - i) / 4);
      const y = padTop + (plotH * i) / 4;
      ctx.fillStyle = tfrColor;
      ctx.fillText(v.toFixed(1), padLeft + plotW + 5, y + 3);
    }

    // X axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const baseY = h - 4;
    ctx.fillText(String(minYear), xScale(minYear), baseY);
    if (maxYear > minYear) {
      ctx.fillText(String(maxYear), xScale(maxYear), baseY);
      const midYear = Math.round((minYear + maxYear) / 2);
      if (maxYear - minYear > 6) {
        ctx.fillText(String(midYear), xScale(midYear), baseY);
      }
    }

    // Draw population area + line
    if (popData.length >= 2) {
      // Area
      ctx.beginPath();
      ctx.moveTo(xScale(popData[0].year), yPop(popData[0].value));
      for (let i = 1; i < popData.length; i++) {
        ctx.lineTo(xScale(popData[i].year), yPop(popData[i].value));
      }
      ctx.lineTo(xScale(popData[popData.length - 1].year), padTop + plotH);
      ctx.lineTo(xScale(popData[0].year), padTop + plotH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
      grad.addColorStop(0, popColor + '20');
      grad.addColorStop(1, popColor + '05');
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(xScale(popData[0].year), yPop(popData[0].value));
      for (let i = 1; i < popData.length; i++) {
        ctx.lineTo(xScale(popData[i].year), yPop(popData[i].value));
      }
      ctx.strokeStyle = popColor;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Draw TFR line
    if (tfrData.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(xScale(tfrData[0].year), yTfr(tfrData[0].value));
      for (let i = 1; i < tfrData.length; i++) {
        ctx.lineTo(xScale(tfrData[i].year), yTfr(tfrData[i].value));
      }
      ctx.strokeStyle = tfrColor;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Replacement rate reference line (TFR = 2.1)
    if (tfrMin < 2.1 && tfrMax > 2.1) {
      const refY = yTfr(2.1);
      ctx.beginPath();
      ctx.moveTo(padLeft, refY);
      ctx.lineTo(padLeft + plotW, refY);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.7;
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('2.1', padLeft + 2, refY - 3);
    }

    // Current year dots
    const curPop = popData.find(d => d.year === currentYear);
    if (curPop) {
      ctx.beginPath();
      ctx.arc(xScale(curPop.year), yPop(curPop.value), 4, 0, Math.PI * 2);
      ctx.fillStyle = popColor;
      ctx.fill();
    }
    const curTfr = tfrData.find(d => d.year === currentYear);
    if (curTfr) {
      ctx.beginPath();
      ctx.arc(xScale(curTfr.year), yTfr(curTfr.value), 4, 0, Math.PI * 2);
      ctx.fillStyle = tfrColor;
      ctx.fill();
    }

    // Legend
    const legendY = padTop + 2;
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.textAlign = 'left';
    // Pop legend
    ctx.fillStyle = popColor;
    ctx.fillRect(padLeft + 2, legendY - 4, 10, 2);
    ctx.fillText('Population', padLeft + 16, legendY);
    // TFR legend
    const tfrLegendX = padLeft + 80;
    ctx.fillStyle = tfrColor;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(tfrLegendX, legendY - 3);
    ctx.lineTo(tfrLegendX + 10, legendY - 3);
    ctx.strokeStyle = tfrColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('TFR', tfrLegendX + 14, legendY);

  }, [popData, tfrData, currentYear]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <canvas ref={canvasRef} className="flex-1 w-full min-h-0" style={{ imageRendering: 'auto' }} />
    </div>
  );
}
