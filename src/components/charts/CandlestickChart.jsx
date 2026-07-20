/* CandlestickChart.jsx */
import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import { useLivePrice } from '../../hooks/useLivePrice.js';
import { getMockHistoricalCandles } from '../../api/mock.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { fetchHistoricalCandles } from '../../api/upstox.js';

const PERIODS = ['1D','1W','1M','3M','1Y'];
const INTERVALS = ['1minute','5minute','15minute','30minute','1hour','day','week'];
const INTERVAL_LABELS = { '1minute':'1m','5minute':'5m','15minute':'15m','30minute':'30m','1hour':'1h','day':'1D','week':'1W' };

const PERIOD_TO_COUNT = {
  '1D': { interval:'1minute',  count:390 },
  '1W': { interval:'5minute',  count:400 },
  '1M': { interval:'30minute', count:300 },
  '3M': { interval:'day',      count:90  },
  '1Y': { interval:'day',      count:365 },
};

export default function CandlestickChart({ instrumentKey, height = 400 }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);
  const volumeRef    = useRef(null);
  const priceLineRef = useRef(null);

  const [period,   setPeriod]   = useState('1M');
  const [interval, setInterval] = useState('day');
  const [chartType, setChartType] = useState('candle');
  const [loading,  setLoading]  = useState(true);

  const livePrice = useLivePrice(instrumentKey);
  const { settings } = useSettings();

  // Build / rebuild chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height,
      layout: { background: { color: '#0a0a0f' }, textColor: '#8888aa' },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
    };
  }, [height]);

  // Load data when period/interval/chartType/instrumentKey changes
  const loadData = useCallback(async () => {
    if (!chartRef.current || !instrumentKey) return;
    setLoading(true);

    const cfg = PERIOD_TO_COUNT[period];
    const iv  = cfg.interval;
    const candles = getMockHistoricalCandles(instrumentKey, iv, cfg.count);

    const chart = chartRef.current;

    // Remove old series
    if (seriesRef.current) { try { chart.removeSeries(seriesRef.current); } catch {} seriesRef.current = null; }
    if (volumeRef.current)  { try { chart.removeSeries(volumeRef.current);  } catch {} volumeRef.current  = null; }

    if (chartType === 'candle') {
      const s = chart.addCandlestickSeries({
        upColor:'#10b981', downColor:'#ef4444',
        wickUpColor:'#10b981', wickDownColor:'#ef4444',
        borderVisible: false,
      });
      s.setData(candles);
      seriesRef.current = s;
    } else if (chartType === 'line') {
      const s = chart.addLineSeries({ color:'#8b5cf6', lineWidth:2 });
      s.setData(candles.map(c => ({ time: c.time, value: c.close })));
      seriesRef.current = s;
    } else {
      const s = chart.addAreaSeries({
        topColor:'rgba(139,92,246,0.3)', bottomColor:'rgba(139,92,246,0)',
        lineColor:'#8b5cf6', lineWidth:2,
      });
      s.setData(candles.map(c => ({ time: c.time, value: c.close })));
      seriesRef.current = s;
    }

    // Volume pane
    const vol = chart.addHistogramSeries({
      color:'rgba(139,92,246,0.3)',
      priceFormat:{ type:'volume' },
      priceScaleId:'volume',
      scaleMargins:{ top: 0.85, bottom: 0 },
    });
    vol.setData(candles.map(c => ({
      time: c.time, value: c.volume,
      color: c.close >= c.open ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)',
    })));
    volumeRef.current = vol;

    chart.timeScale().fitContent();
    setLoading(false);
  }, [instrumentKey, period, chartType]);

  useEffect(() => { loadData(); }, [loadData]);

  // Live price update on last candle
  useEffect(() => {
    if (!seriesRef.current || !livePrice?.ltp) return;
    const { ltp, open, high, low } = livePrice;
    const time = Math.floor(Date.now() / 1000);
    try {
      if (chartType === 'candle') {
        seriesRef.current.update({ time, open: open || ltp, high: high || ltp, low: low || ltp, close: ltp });
      } else {
        seriesRef.current.update({ time, value: ltp });
      }
      // Update price line
      if (priceLineRef.current) { try { seriesRef.current.removePriceLine(priceLineRef.current); } catch {} }
      priceLineRef.current = seriesRef.current.createPriceLine({
        price: ltp, color: '#8b5cf6', lineStyle: LineStyle.Dashed,
        lineWidth: 1, title: `LTP ${ltp}`, axisLabelVisible: true,
      });
    } catch {}
  }, [livePrice, chartType]);

  const btnStyle = (active) => ({
    padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 500,
    border: 'none', cursor: 'pointer', transition: 'all 150ms',
    background: active ? 'var(--gradient-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap: 8, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:2, background:'rgba(255,255,255,0.04)', borderRadius:'var(--radius-full)', padding:3 }}>
          {PERIODS.map(p => (
            <button key={p} style={btnStyle(period===p)} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
        <div style={{ width:1, height:20, background:'var(--border-glass)' }}/>
        <div style={{ display:'flex', gap:2, background:'rgba(255,255,255,0.04)', borderRadius:'var(--radius-full)', padding:3 }}>
          {['candle','line','area'].map(t => (
            <button key={t} style={btnStyle(chartType===t)} onClick={() => setChartType(t)}>
              {t==='candle'?'📊':t==='line'?'📈':'🏔️'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div style={{ position:'relative' }}>
        {loading && (
          <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(10,10,15,0.7)',zIndex:10,borderRadius:'var(--radius-md)' }}>
            <div className="skeleton" style={{ width:120,height:16 }}/>
          </div>
        )}
        <div ref={containerRef} style={{ width:'100%', height, borderRadius:'var(--radius-md)', overflow:'hidden' }}/>
      </div>
    </div>
  );
}
