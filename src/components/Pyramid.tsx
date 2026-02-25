import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { AgeGroup } from '../types';

interface PyramidProps {
  population: AgeGroup[];
  countryName: string;
}

const MARGIN = { top: 24, right: 40, bottom: 34, left: 40 };
const BAR_GAP = 0.5;
const LABEL_WIDTH = 32;

export function Pyramid({ population, countryName }: PyramidProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || population.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = Math.max(500, container.clientHeight);
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

    // Warm color scales
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

    // Age axis
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
      .attr('font-size', '9px')
      .text(d => d);

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

  }, [population, countryName]);

  return (
    <div ref={containerRef} className="h-full w-full min-h-[500px]">
      <svg ref={svgRef} className="h-full w-full" />
    </div>
  );
}
