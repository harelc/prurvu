import { useRef, useEffect, useState } from 'react';

export interface TimeSeriesPoint {
  year: number;
  value: number;
}

interface DualAxisChartProps {
  popData: TimeSeriesPoint[];
  tfrData: TimeSeriesPoint[];
  currentYear: number;
  baseYear: number;
  maxYear: number;
  popDataB?: TimeSeriesPoint[];
  tfrDataB?: TimeSeriesPoint[];
}

function formatPop(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return Math.round(n).toString();
}

export function DualAxisChart({ popData, tfrData, currentYear, baseYear, maxYear, popDataB, tfrDataB }: DualAxisChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  // Watch for container resize (browser zoom, layout changes)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize(prev =>
        prev.w === Math.round(width) && prev.h === Math.round(height)
          ? prev
          : { w: Math.round(width), h: Math.round(height) }
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    const padBottom = 24;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    ctx.clearRect(0, 0, w, h);

    // Fixed X axis range
    const minYear = baseYear;
    const fixedMaxYear = maxYear;

    const allPopVals = [...popData.map(d => d.value), ...(popDataB?.map(d => d.value) ?? [])];
    const rawPopMax = Math.max(...allPopVals);
    const popMin = 0;
    const popMax = rawPopMax * 1.1;

    const tfrMin = 0.7;
    const tfrMax = 5;

    const xScale = (year: number) => padLeft + ((year - minYear) / Math.max(fixedMaxYear - minYear, 1)) * plotW;
    const yPop = (v: number) => padTop + plotH - ((v - popMin) / Math.max(popMax - popMin, 1)) * plotH;
    const yTfr = (v: number) => padTop + plotH - ((v - tfrMin) / Math.max(tfrMax - tfrMin, 1)) * plotH;

    const popColor = '#3b82f6';
    const tfrColor = '#f97316';
    const popColorB = '#10b981';
    const tfrColorB = '#8b5cf6';

    // Grid lines
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

    // X axis line
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop + plotH);
    ctx.lineTo(padLeft + plotW, padTop + plotH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    // X axis labels — every 50 years
    ctx.fillStyle = '#64748b';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const labelY = padTop + plotH + 16;
    const span = fixedMaxYear - minYear;
    const step = span > 150 ? 50 : span > 60 ? 25 : span > 20 ? 10 : 5;
    for (let yr = minYear; yr <= fixedMaxYear; yr += step) {
      const x = xScale(yr);
      // Tick mark
      ctx.beginPath();
      ctx.moveTo(x, padTop + plotH);
      ctx.lineTo(x, padTop + plotH + 4);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Label
      ctx.fillText(String(yr), x, labelY);
    }

    // Helper to draw line
    function drawLine(data: TimeSeriesPoint[], scaleFn: (v: number) => number, color: string, dashed: boolean = false) {
      if (data.length < 2) return;
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(xScale(data[0].year), scaleFn(data[0].value));
      for (let i = 1; i < data.length; i++) {
        ctx.lineTo(xScale(data[i].year), scaleFn(data[i].value));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      if (dashed) ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw population area + line
    if (popData.length >= 2) {
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

      drawLine(popData, yPop, popColor);
    }

    // Draw TFR line
    drawLine(tfrData, yTfr, tfrColor, true);

    // Draw scenario B lines
    if (popDataB && popDataB.length >= 2) {
      drawLine(popDataB, yPop, popColorB);
    }
    if (tfrDataB && tfrDataB.length >= 2) {
      drawLine(tfrDataB, yTfr, tfrColorB, true);
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
    ctx.fillStyle = popColor;
    ctx.fillRect(padLeft + 2, legendY - 4, 10, 2);
    ctx.fillText('Pop', padLeft + 16, legendY);
    const tfrLegendX = padLeft + 48;
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

    if (popDataB) {
      const bLegendX = padLeft + 90;
      ctx.fillStyle = popColorB;
      ctx.fillRect(bLegendX, legendY - 4, 10, 2);
      ctx.fillText('B', bLegendX + 14, legendY);
    }

  }, [popData, tfrData, currentYear, baseYear, maxYear, popDataB, tfrDataB, canvasSize]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <canvas ref={canvasRef} className="flex-1 w-full min-h-0" style={{ imageRendering: 'auto' }} />
    </div>
  );
}
