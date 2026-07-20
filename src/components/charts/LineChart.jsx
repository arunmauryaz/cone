/* LineChart.jsx */
import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function LineChart({
  data = [],
  color = '#8b5cf6',
  height = 200,
  showVolume = false,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const volSeriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: '#8888aa',
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(139,92,246,0.4)', width: 1 },
        horzLine: { color: 'rgba(139,92,246,0.4)', width: 1 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        textColor: '#8888aa',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        textColor: '#8888aa',
        timeVisible: true,
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    const areaSeries = chart.addAreaSeries({
      lineColor: color,
      topColor: color.replace(')', ', 0.3)').replace('rgb', 'rgba'),
      bottomColor: color.replace(')', ', 0.0)').replace('rgb', 'rgba'),
      lineWidth: 2,
      priceLineVisible: false,
    });

    seriesRef.current = areaSeries;

    if (showVolume) {
      const volSeries = chart.addHistogramSeries({
        color: 'rgba(139,92,246,0.3)',
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
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volSeriesRef.current = null;
    };
  }, [height, color, showVolume]);

  useEffect(() => {
    if (!seriesRef.current || !data.length) return;
    const sorted = [...data].sort((a, b) => a.time - b.time);
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
