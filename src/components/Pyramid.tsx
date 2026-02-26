import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import type { AgeGroup } from '../types';

interface PyramidProps {
  population: AgeGroup[];
  countryName: string;
  yearsSimulated?: number;
  currentYear?: number;
  comparisonPopulation?: AgeGroup[];
  showMomentum?: boolean;
}

const MARGIN = { top: 24, right: 40, bottom: 34, left: 40 };
const BAR_GAP = 0.5;
const LABEL_WIDTH = 52; // wider for "age / birth year"

export const Pyramid = forwardRef<SVGSVGElement, PyramidProps>(function Pyramid(
  { population, countryName, yearsSimulated = 0, currentYear = 2024, comparisonPopulation, showMomentum = false },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useImperativeHandle(ref, () => svgRef.current!);

  // Watch for container resize (browser zoom, layout changes)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize(prev =>
        prev.w === Math.round(width) && prev.h === Math.round(height)
          ? prev
          : { w: Math.round(width), h: Math.round(height) }
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || population.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const isMobile = container.clientWidth < 640;
    const height = Math.max(isMobile ? 400 : 500, container.clientHeight);
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;
    const sideWidth = (innerWidth - LABEL_WIDTH) / 2;

    const svg = d3.select(svgRef.current);
    svg.attr('width', width).attr('height', height);

    const maxPop = d3.max(population, d => Math.max(d.male, d.female)) ?? 1;

    const xScaleMale = d3.scaleLinear().domain([0, maxPop]).range([sideWidth, 0]);
    const xScaleFemale = d3.scaleLinear().domain([0, maxPop]).range([0, sideWidth]);
    const yScale = d3.scaleBand<number>()
      .domain(population.map(d => d.age))
      .range([innerHeight, 0])
      .padding(0.05);

    // Color scales
    const maleColor = d3.scaleSequential()
      .domain([0, 100])
      .interpolator(d3.interpolateRgb('#3b82f6', '#1e3a5f'));
    const femaleColor = d3.scaleSequential()
      .domain([0, 100])
      .interpolator(d3.interpolateRgb('#f97316', '#7c2d12'));

    let g = svg.select<SVGGElement>('g.main');
    if (g.empty()) {
      g = svg.append('g').attr('class', 'main');
      g.append('g').attr('class', 'axis-male');
      g.append('g').attr('class', 'axis-female');
      g.append('g').attr('class', 'axis-age');
      g.append('g').attr('class', 'bars-male');
      g.append('g').attr('class', 'bars-female');
      g.append('g').attr('class', 'excess-male');
      g.append('g').attr('class', 'excess-female');
      g.append('g').attr('class', 'compare-male');
      g.append('g').attr('class', 'compare-female');
      g.append('g').attr('class', 'momentum-overlay');
      g.append('g').attr('class', 'hover-zones');
      g.append('g').attr('class', 'tooltip-group').attr('opacity', 0);
      g.append('text').attr('class', 'label-male')
        .attr('text-anchor', 'middle')
        .attr('fill', '#3b82f6')
        .attr('font-size', '12px')
        .attr('font-weight', '700');
      g.append('text').attr('class', 'label-female')
        .attr('text-anchor', 'middle')
        .attr('fill', '#f97316')
        .attr('font-size', '12px')
        .attr('font-weight', '700');
    }

    g.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Male bars
    const maleGroup = g.select<SVGGElement>('g.bars-male');
    const maleBars = maleGroup.selectAll<SVGRectElement, AgeGroup>('rect').data(population, d => String(d.age));

    maleBars.enter()
      .append('rect')
      .attr('x', sideWidth)
      .attr('width', 0)
      .attr('y', d => yScale(d.age) ?? 0)
      .attr('height', yScale.bandwidth() - BAR_GAP)
      .attr('fill', d => maleColor(d.age))
      .attr('rx', 1)
      .merge(maleBars)
      .transition()
      .duration(400)
      .attr('x', d => xScaleMale(d.male))
      .attr('y', d => yScale(d.age) ?? 0)
      .attr('width', d => sideWidth - xScaleMale(d.male))
      .attr('height', yScale.bandwidth() - BAR_GAP)
      .attr('fill', d => maleColor(d.age));

    maleBars.exit().remove();

    // Female bars
    const femaleGroup = g.select<SVGGElement>('g.bars-female');
    const femaleBarsOffset = sideWidth + LABEL_WIDTH;
    const femaleBars = femaleGroup.selectAll<SVGRectElement, AgeGroup>('rect').data(population, d => String(d.age));

    femaleBars.enter()
      .append('rect')
      .attr('x', femaleBarsOffset)
      .attr('width', 0)
      .attr('y', d => yScale(d.age) ?? 0)
      .attr('height', yScale.bandwidth() - BAR_GAP)
      .attr('fill', d => femaleColor(d.age))
      .attr('rx', 1)
      .merge(femaleBars)
      .transition()
      .duration(400)
      .attr('x', femaleBarsOffset)
      .attr('y', d => yScale(d.age) ?? 0)
      .attr('width', d => xScaleFemale(d.female))
      .attr('height', yScale.bandwidth() - BAR_GAP)
      .attr('fill', d => femaleColor(d.age));

    femaleBars.exit().remove();

    // Gender excess overlays
    const excessMaleGroup = g.select<SVGGElement>('g.excess-male');
    const maleExcessData = population.filter(d => d.male > d.female);
    const excessMaleBars = excessMaleGroup.selectAll<SVGRectElement, AgeGroup>('rect').data(maleExcessData, d => String(d.age));
    excessMaleBars.enter()
      .append('rect')
      .attr('opacity', 0.5)
      .merge(excessMaleBars)
      .transition().duration(400)
      .attr('x', d => xScaleMale(d.male))
      .attr('y', d => yScale(d.age) ?? 0)
      .attr('width', d => xScaleMale(d.female) - xScaleMale(d.male))
      .attr('height', yScale.bandwidth() - BAR_GAP)
      .attr('fill', '#60a5fa')
      .attr('opacity', 0.45);
    excessMaleBars.exit().remove();

    const excessFemaleGroup = g.select<SVGGElement>('g.excess-female');
    const femaleExcessData = population.filter(d => d.female > d.male);
    const excessFemaleBars = excessFemaleGroup.selectAll<SVGRectElement, AgeGroup>('rect').data(femaleExcessData, d => String(d.age));
    excessFemaleBars.enter()
      .append('rect')
      .attr('opacity', 0.5)
      .merge(excessFemaleBars)
      .transition().duration(400)
      .attr('x', d => femaleBarsOffset + xScaleFemale(d.male))
      .attr('y', d => yScale(d.age) ?? 0)
      .attr('width', d => xScaleFemale(d.female) - xScaleFemale(d.male))
      .attr('height', yScale.bandwidth() - BAR_GAP)
      .attr('fill', '#fdba74')
      .attr('opacity', 0.45);
    excessFemaleBars.exit().remove();

    // Comparison overlay (dashed outline bars)
    const compareMaleGroup = g.select<SVGGElement>('g.compare-male');
    const compareFemaleGroup = g.select<SVGGElement>('g.compare-female');
    if (comparisonPopulation) {
      const cmpMaleBars = compareMaleGroup.selectAll<SVGRectElement, AgeGroup>('rect').data(comparisonPopulation, d => String(d.age));
      cmpMaleBars.enter()
        .append('rect')
        .merge(cmpMaleBars)
        .attr('x', d => xScaleMale(d.male))
        .attr('y', d => yScale(d.age) ?? 0)
        .attr('width', d => sideWidth - xScaleMale(d.male))
        .attr('height', yScale.bandwidth() - BAR_GAP)
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,2')
        .attr('rx', 1);
      cmpMaleBars.exit().remove();

      const cmpFemaleBars = compareFemaleGroup.selectAll<SVGRectElement, AgeGroup>('rect').data(comparisonPopulation, d => String(d.age));
      cmpFemaleBars.enter()
        .append('rect')
        .merge(cmpFemaleBars)
        .attr('x', femaleBarsOffset)
        .attr('y', d => yScale(d.age) ?? 0)
        .attr('width', d => xScaleFemale(d.female))
        .attr('height', yScale.bandwidth() - BAR_GAP)
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,2')
        .attr('rx', 1);
      cmpFemaleBars.exit().remove();
    } else {
      compareMaleGroup.selectAll('rect').remove();
      compareFemaleGroup.selectAll('rect').remove();
    }

    // Momentum overlay (female ages 15-49)
    const momentumGroup = g.select<SVGGElement>('g.momentum-overlay');
    momentumGroup.selectAll('*').remove();
    if (showMomentum) {
      const reproductiveWomen = population.filter(d => d.age >= 15 && d.age <= 49);
      let totalReproWomen = 0;
      reproductiveWomen.forEach(d => { totalReproWomen += d.female; });

      // Semi-transparent band spanning ages 15-49 on both sides
      const bandTop = yScale(49) ?? 0;
      const bandBottom = (yScale(15) ?? 0) + yScale.bandwidth();
      momentumGroup.append('rect')
        .attr('x', 0)
        .attr('y', bandTop)
        .attr('width', innerWidth)
        .attr('height', bandBottom - bandTop)
        .attr('fill', '#a855f7')
        .attr('opacity', 0.07);

      // Bracket + rotated label on the right edge of female side
      const topY = yScale(49) ?? 0;
      const bottomY = (yScale(15) ?? 0) + yScale.bandwidth();
      const bracketX = innerWidth - 3;
      momentumGroup.append('line')
        .attr('x1', bracketX).attr('x2', bracketX)
        .attr('y1', topY).attr('y2', bottomY)
        .attr('stroke', '#a855f7').attr('stroke-width', 1.5);
      momentumGroup.append('line')
        .attr('x1', bracketX - 4).attr('x2', bracketX)
        .attr('y1', topY).attr('y2', topY)
        .attr('stroke', '#a855f7').attr('stroke-width', 1.5);
      momentumGroup.append('line')
        .attr('x1', bracketX - 4).attr('x2', bracketX)
        .attr('y1', bottomY).attr('y2', bottomY)
        .attr('stroke', '#a855f7').attr('stroke-width', 1.5);

      const formatCount = (n: number) => {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
        return Math.round(n).toString();
      };
      const midY = (topY + bottomY) / 2;
      momentumGroup.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('transform', `translate(${bracketX + 10}, ${midY}) rotate(-90)`)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'auto')
        .attr('fill', '#a855f7')
        .attr('font-size', '8px')
        .attr('font-weight', '600')
        .text(`${formatCount(totalReproWomen)} women 15\u201349`);
    }

    // Future separator line
    let futureLine = g.select<SVGLineElement>('line.future-sep');
    let futureLabel = g.select<SVGTextElement>('text.future-label');
    if (futureLine.empty()) {
      futureLine = g.append('line').attr('class', 'future-sep');
      futureLabel = g.append('text').attr('class', 'future-label');
    }
    if (yearsSimulated > 0 && yearsSimulated <= 100) {
      const sepAge = yearsSimulated - 1;
      const sepY = (yScale(sepAge) ?? 0) + yScale.bandwidth() + 0.5;
      futureLine
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', sepY)
        .attr('y2', sepY)
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,4')
        .attr('opacity', 0.6);
      futureLabel
        .attr('x', innerWidth)
        .attr('y', sepY - 3)
        .attr('text-anchor', 'end')
        .attr('fill', '#ef4444')
        .attr('font-size', '9px')
        .attr('font-weight', '600')
        .attr('opacity', 0.7)
        .text('Born after ' + (currentYear - yearsSimulated));
    } else {
      futureLine.attr('opacity', 0);
      futureLabel.attr('opacity', 0);
    }

    // Age + birth year axis (center column)
    const ageAxisGroup = g.select<SVGGElement>('g.axis-age');
    ageAxisGroup.attr('transform', `translate(${sideWidth + LABEL_WIDTH / 2}, 0)`);
    const ageTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const ageLabels = ageAxisGroup.selectAll<SVGTextElement, number>('text').data(ageTicks);
    ageLabels.enter()
      .append('text')
      .merge(ageLabels)
      .attr('x', 0)
      .attr('y', d => (yScale(d) ?? 0) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#94a3b8')
      .attr('font-size', '8px')
      .text(d => {
        const birthYear = currentYear - d;
        return `${d} / ${birthYear}`;
      });

    const formatAxis = (n: number) => {
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
      if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
      return String(n);
    };

    const maleAxisFn = d3.axisBottom(xScaleMale).ticks(4).tickFormat(d => formatAxis(d as number));
    g.select<SVGGElement>('g.axis-male')
      .attr('transform', `translate(0, ${innerHeight})`)
      .transition().duration(400)
      .call(maleAxisFn)
      .selectAll('text').attr('fill', '#94a3b8').attr('font-size', '9px');
    g.select('g.axis-male').selectAll('.domain, line').attr('stroke', '#e2e8f0');

    const femaleAxisFn = d3.axisBottom(xScaleFemale).ticks(4).tickFormat(d => formatAxis(d as number));
    g.select<SVGGElement>('g.axis-female')
      .attr('transform', `translate(${femaleBarsOffset}, ${innerHeight})`)
      .transition().duration(400)
      .call(femaleAxisFn)
      .selectAll('text').attr('fill', '#94a3b8').attr('font-size', '9px');
    g.select('g.axis-female').selectAll('.domain, line').attr('stroke', '#e2e8f0');

    g.select('text.label-male')
      .attr('x', sideWidth / 2)
      .attr('y', -8)
      .text('Male');
    g.select('text.label-female')
      .attr('x', femaleBarsOffset + sideWidth / 2)
      .attr('y', -8)
      .text('Female');

    // Hover tooltip zones
    const totalPop = population.reduce((s, d) => s + d.male + d.female, 0);
    const hoverGroup = g.select<SVGGElement>('g.hover-zones');
    const tooltipGroup = g.select<SVGGElement>('g.tooltip-group');
    hoverGroup.selectAll('rect').remove();

    population.forEach(d => {
      hoverGroup.append('rect')
        .attr('x', 0)
        .attr('y', yScale(d.age) ?? 0)
        .attr('width', innerWidth)
        .attr('height', yScale.bandwidth())
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer')
        .on('mouseenter', function(_event) {
          const total = d.male + d.female;
          const pct = totalPop > 0 ? ((total / totalPop) * 100).toFixed(2) : '0.00';
          const diff = d.male - d.female;
          const diffStr = diff > 0 ? `+${formatAxis(Math.abs(diff))} M` : diff < 0 ? `+${formatAxis(Math.abs(diff))} F` : 'Equal';

          // Highlight bar
          d3.select(this).attr('fill', 'rgba(148,163,184,0.1)');

          // Build tooltip
          tooltipGroup.selectAll('*').remove();
          tooltipGroup.attr('opacity', 1);

          const tooltipX = innerWidth / 2;
          const tooltipY = Math.max(60, (yScale(d.age) ?? 0) - 10);

          const bg = tooltipGroup.append('rect')
            .attr('rx', 6)
            .attr('fill', 'white')
            .attr('stroke', '#e2e8f0')
            .attr('stroke-width', 1)
            .attr('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))');

          const lines = [
            `Age ${d.age}`,
            `Male: ${formatAxis(d.male)}`,
            `Female: ${formatAxis(d.female)}`,
            `Total: ${formatAxis(total)} (${pct}%)`,
            `Excess: ${diffStr}`,
          ];

          lines.forEach((line, i) => {
            tooltipGroup.append('text')
              .attr('x', tooltipX)
              .attr('y', tooltipY + i * 14)
              .attr('text-anchor', 'middle')
              .attr('fill', i === 0 ? '#1e293b' : '#64748b')
              .attr('font-size', i === 0 ? '11px' : '10px')
              .attr('font-weight', i === 0 ? '700' : '500')
              .text(line);
          });

          bg.attr('x', tooltipX - 75)
            .attr('y', tooltipY - 14)
            .attr('width', 150)
            .attr('height', lines.length * 14 + 8);
        })
        .on('mouseleave', function() {
          d3.select(this).attr('fill', 'transparent');
          tooltipGroup.attr('opacity', 0);
        });
    });

  }, [population, countryName, yearsSimulated, currentYear, comparisonPopulation, showMomentum, containerSize]);

  return (
    <div ref={containerRef} className="h-full w-full min-h-[400px] md:min-h-[500px]">
      <svg ref={svgRef} className="h-full w-full" />
    </div>
  );
});
