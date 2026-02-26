import { useRef, useEffect, useState, useCallback } from 'react';
import type { SplinePoint } from '../utils/spline';

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
  // TFR editing mode props
  tfrEditMode?: 'convergence' | 'custom';
  tfrControlPoints?: SplinePoint[];
  onTfrControlPointsChange?: (points: SplinePoint[]) => void;
  tfrSplinePath?: SplinePoint[];
}

// Chart padding constants (shared between canvas and SVG overlay)
const PAD_LEFT = 52;
const PAD_RIGHT = 42;
const PAD_TOP = 12;
const PAD_BOTTOM = 36;
const TFR_MIN = 0.7;
const TFR_MAX = 5;

function formatPop(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return Math.round(n).toString();
}

export function DualAxisChart({
  popData,
  tfrData,
  currentYear,
  baseYear,
  maxYear,
  popDataB,
  tfrDataB,
  tfrEditMode = 'convergence',
  tfrControlPoints,
  onTfrControlPointsChange,
  tfrSplinePath,
}: DualAxisChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{ x: number; y: number; year: number; tfr: number } | null>(null);

  // Compute scale functions based on current size
  const getScales = useCallback((w: number, h: number) => {
    const plotW = w - PAD_LEFT - PAD_RIGHT;
    const plotH = h - PAD_TOP - PAD_BOTTOM;
    const minYear = baseYear;
    const fixedMaxYear = maxYear;

    const xScale = (year: number) => PAD_LEFT + ((year - minYear) / Math.max(fixedMaxYear - minYear, 1)) * plotW;
    const yTfr = (v: number) => PAD_TOP + plotH - ((v - TFR_MIN) / Math.max(TFR_MAX - TFR_MIN, 1)) * plotH;

    const xInv = (px: number) => minYear + ((px - PAD_LEFT) / plotW) * (fixedMaxYear - minYear);
    const yTfrInv = (py: number) => TFR_MIN + ((PAD_TOP + plotH - py) / plotH) * (TFR_MAX - TFR_MIN);

    return { xScale, yTfr, xInv, yTfrInv, plotW, plotH };
  }, [baseYear, maxYear]);

  // Watch for container resize
  useEffect(() => {
    const el = containerRef.current;
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

  // Canvas drawing effect
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

    const padLeft = PAD_LEFT;
    const padRight = PAD_RIGHT;
    const padTop = PAD_TOP;
    const padBottom = PAD_BOTTOM;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    ctx.clearRect(0, 0, w, h);

    const minYear = baseYear;
    const fixedMaxYear = maxYear;

    const allPopVals = [...popData.map(d => d.value), ...(popDataB?.map(d => d.value) ?? [])];
    const rawPopMax = Math.max(...allPopVals);
    const popMin = 0;
    const popMax = rawPopMax * 1.1;

    const tfrMin = TFR_MIN;
    const tfrMax = TFR_MAX;

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

    // X axis labels
    ctx.fillStyle = '#64748b';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const labelY = padTop + plotH + 16;
    const span = fixedMaxYear - minYear;
    const step = span > 150 ? 50 : span > 60 ? 25 : span > 20 ? 10 : 5;
    for (let yr = minYear; yr <= fixedMaxYear; yr += step) {
      const x = xScale(yr);
      ctx.beginPath();
      ctx.moveTo(x, padTop + plotH);
      ctx.lineTo(x, padTop + plotH + 4);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();
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

    // Draw TFR line (only in convergence mode — custom mode draws the spline instead)
    if (tfrEditMode !== 'custom') {
      drawLine(tfrData, yTfr, tfrColor, true);
    }

    // Draw scenario B lines
    if (popDataB && popDataB.length >= 2) {
      drawLine(popDataB, yPop, popColorB);
    }
    if (tfrDataB && tfrDataB.length >= 2) {
      drawLine(tfrDataB, yTfr, tfrColorB, true);
    }

    // Draw the custom TFR spline path on canvas (dashed blue line)
    if (tfrEditMode === 'custom' && tfrSplinePath && tfrSplinePath.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(xScale(tfrSplinePath[0].year), yTfr(tfrSplinePath[0].tfr));
      // Draw every few years for smoothness but not too many line segments
      for (let i = 1; i < tfrSplinePath.length; i++) {
        ctx.lineTo(xScale(tfrSplinePath[i].year), yTfr(tfrSplinePath[i].tfr));
      }
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.setLineDash([6, 4]);
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
    ctx.fillStyle = popColor;
    ctx.fillRect(padLeft + 2, legendY - 4, 10, 2);
    ctx.fillText('Pop', padLeft + 16, legendY);
    const tfrLegendX = padLeft + 48;
    const isCustom = tfrEditMode === 'custom';
    const tfrLegColor = isCustom ? '#f97316' : tfrColor;
    ctx.strokeStyle = tfrLegColor;
    ctx.lineWidth = 2;
    ctx.setLineDash(isCustom ? [4, 3] : [3, 2]);
    ctx.beginPath();
    ctx.moveTo(tfrLegendX, legendY - 3);
    ctx.lineTo(tfrLegendX + 10, legendY - 3);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = tfrLegColor;
    ctx.fillText(isCustom ? 'TFR Path' : 'TFR', tfrLegendX + 14, legendY);

    if (popDataB) {
      const bLegendX = isCustom ? padLeft + 110 : padLeft + 90;
      ctx.fillStyle = popColorB;
      ctx.fillRect(bLegendX, legendY - 4, 10, 2);
      ctx.fillText('B', bLegendX + 14, legendY);
    }

  }, [popData, tfrData, currentYear, baseYear, maxYear, popDataB, tfrDataB, canvasSize, tfrEditMode, tfrSplinePath]);

  // SVG overlay interaction handlers
  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (tfrEditMode !== 'custom' || !onTfrControlPointsChange || !tfrControlPoints) return;
    // Only add on left click and not while dragging
    if (e.button !== 0 || draggingIdx !== null) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Only allow clicks within the plot area
    const plotW = rect.width - PAD_LEFT - PAD_RIGHT;
    const plotH = rect.height - PAD_TOP - PAD_BOTTOM;
    if (x < PAD_LEFT || x > PAD_LEFT + plotW || y < PAD_TOP || y > PAD_TOP + plotH) return;

    const { xInv, yTfrInv } = getScales(rect.width, rect.height);
    const year = Math.round(xInv(x));
    const tfr = Math.max(0.5, Math.min(8, yTfrInv(y)));

    // Don't add if too close to existing point
    const existingClose = tfrControlPoints.some(p => Math.abs(p.year - year) < 3);
    if (existingClose) return;

    const newPoints = [...tfrControlPoints, { year, tfr }].sort((a, b) => a.year - b.year);
    onTfrControlPointsChange(newPoints);
  }, [tfrEditMode, tfrControlPoints, onTfrControlPointsChange, draggingIdx, getScales]);

  const handlePointMouseDown = useCallback((idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0) return; // only left button for drag
    setDraggingIdx(idx);
  }, []);

  const handlePointRightClick = useCallback((idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tfrControlPoints || !onTfrControlPointsChange) return;
    // Don't allow removing the first anchor point
    if (idx === 0) return;
    const newPoints = tfrControlPoints.filter((_, i) => i !== idx);
    onTfrControlPointsChange(newPoints);
  }, [tfrControlPoints, onTfrControlPointsChange]);

  const handlePointDoubleClick = useCallback((idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tfrControlPoints || !onTfrControlPointsChange) return;
    if (idx === 0) return;
    const newPoints = tfrControlPoints.filter((_, i) => i !== idx);
    onTfrControlPointsChange(newPoints);
  }, [tfrControlPoints, onTfrControlPointsChange]);

  // Global mouse move/up for dragging
  useEffect(() => {
    if (draggingIdx === null) return;
    if (!tfrControlPoints || !onTfrControlPointsChange) return;

    const handleMouseMove = (e: MouseEvent) => {
      const svg = containerRef.current?.querySelector('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const { xInv, yTfrInv } = getScales(rect.width, rect.height);
      let year = Math.round(xInv(x));
      let tfr = yTfrInv(y);

      // Clamp TFR
      tfr = Math.max(0.5, Math.min(8, tfr));

      // First point: anchored horizontally at base year
      if (draggingIdx === 0) {
        year = baseYear;
      } else {
        // Clamp year within range, and don't overlap neighbors
        year = Math.max(baseYear, Math.min(maxYear, year));
        // Keep at least 1 year from neighbors
        if (draggingIdx > 0 && tfrControlPoints[draggingIdx - 1]) {
          year = Math.max(year, tfrControlPoints[draggingIdx - 1].year + 1);
        }
        if (draggingIdx < tfrControlPoints.length - 1 && tfrControlPoints[draggingIdx + 1]) {
          year = Math.min(year, tfrControlPoints[draggingIdx + 1].year - 1);
        }
      }

      const newPoints = [...tfrControlPoints];
      newPoints[draggingIdx] = { year, tfr };

      // Update tooltip
      setTooltipInfo({ x: e.clientX - rect.left, y: e.clientY - rect.top, year, tfr });

      onTfrControlPointsChange(newPoints);
    };

    const handleMouseUp = () => {
      setDraggingIdx(null);
      setTooltipInfo(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingIdx, tfrControlPoints, onTfrControlPointsChange, getScales, baseYear, maxYear]);

  // Compute SVG control point positions
  const controlPointPositions = tfrControlPoints && canvasSize.w > 0 ? tfrControlPoints.map(pt => {
    const { xScale, yTfr } = getScales(canvasSize.w, canvasSize.h);
    return { x: xScale(pt.year), y: yTfr(pt.tfr), year: pt.year, tfr: pt.tfr };
  }) : [];

  const isCustomMode = tfrEditMode === 'custom';

  return (
    <div ref={containerRef} className="relative flex flex-col h-full min-h-0">
      <canvas ref={canvasRef} className="flex-1 w-full min-h-0" style={{ imageRendering: 'auto' }} />
      {/* SVG overlay for interactive control points */}
      {isCustomMode && canvasSize.w > 0 && canvasSize.h > 0 && (
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ cursor: draggingIdx !== null ? 'grabbing' : 'crosshair', pointerEvents: 'all' }}
          onClick={handleSvgClick}
          onContextMenu={e => e.preventDefault()}
        >
          {/* Control points */}
          {controlPointPositions.map((pt, idx) => (
            <g key={idx}>
              {/* Invisible larger hit area */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={12}
                fill="transparent"
                style={{ cursor: idx === 0 ? 'ns-resize' : 'grab' }}
                onMouseDown={e => handlePointMouseDown(idx, e)}
                onContextMenu={e => handlePointRightClick(idx, e)}
                onDoubleClick={e => handlePointDoubleClick(idx, e)}
              />
              {/* Visible control point */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={6}
                fill="white"
                stroke="#f97316"
                strokeWidth={2}
                style={{ cursor: idx === 0 ? 'ns-resize' : 'grab', pointerEvents: 'none' }}
              />
              {/* Small year label below point when not dragging */}
              {draggingIdx !== idx && (
                <text
                  x={pt.x}
                  y={pt.y + 18}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#64748b"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {pt.year}
                </text>
              )}
            </g>
          ))}

          {/* Tooltip while dragging */}
          {tooltipInfo && (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={tooltipInfo.x + 12}
                y={tooltipInfo.y - 28}
                width={90}
                height={22}
                rx={4}
                fill="#1e293b"
                fillOpacity={0.9}
              />
              <text
                x={tooltipInfo.x + 57}
                y={tooltipInfo.y - 14}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="white"
                style={{ userSelect: 'none' }}
              >
                {tooltipInfo.year} | TFR {tooltipInfo.tfr.toFixed(2)}
              </text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
