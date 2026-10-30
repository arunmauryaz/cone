/* LineChart.jsx */
import { useEffect, useRef } from 'react';
import { createChart, AreaSeries, HistogramSeries } from 'lightweight-charts';
import { chartTheme, observeChartTheme } from './chartTheme.js';

export default function LineChart({
  data = [],
  color = '#26A69A',
  height = 200,
  showVolume = false,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const theme = chartTheme(containerRef.current);

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        ...theme.layout,
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        ...theme.grid,
      },
      crosshair: {
        vertLine: { ...theme.crosshair.vertLine, width: 1 },
        horzLine: { ...theme.crosshair.horzLine, width: 1 },
      },
      rightPriceScale: {
        ...theme.rightPriceScale,
      },
      timeScale: {
        ...theme.timeScale,
        timeVisible: true,
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;
    const stopThemeObserver = observeChartTheme(chart, containerRef.current);

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: color === '#26A69A' ? 'rgba(38, 166, 154, 0.20)' : 'rgba(245, 166, 35, 0.20)',
      bottomColor: 'rgba(38, 166, 154, 0.0)',
      lineWidth: 2,
      priceLineVisible: false,
    });

    seriesRef.current = areaSeries;

    if (showVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        color: 'rgba(138, 143, 152, 0.20)',
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      volSeriesRef.current = volSeries;
    }

    const ro = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect?.width;
      if (width) chart.applyOptions({ width });
    });
    ro.observe(containerRef.current);

    return () => {
      stopThemeObserver();
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
    };
  }, [height, color, showVolume]);

  useEffect(() => {
    if (!seriesRef.current || !data.length) return;
    const sorted = [...new Map(data.map(point => [point.time, point])).values()].sort((a, b) => a.time - b.time);
    seriesRef.current.setData(sorted.map(d => ({ time: d.time, value: d.value })));
    if (volSeriesRef.current && data[0]?.volume !== undefined) {
      volSeriesRef.current.setData(sorted.map(d => ({ time: d.time, value: d.volume || 0 })));
    }
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-md)' }}
    />
  );
}
