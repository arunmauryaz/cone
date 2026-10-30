/* CandlestickChart.jsx */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  CrosshairMode,
} from 'lightweight-charts';
import { toast } from 'react-hot-toast';
import { useLivePrice } from '../../hooks/useLivePrice.js';
import { apiGet } from '../../api/client.js';
import { useMarket } from '../../context/MarketContext.jsx';
import { chartTheme, observeChartTheme } from './chartTheme.js';
import { fmtPrice, formatNumber, formatPercent } from '../../utils/formatting.js';

// Each interval represents the duration of one candle.
const TIMEFRAME_PRESETS = [
  { id: '1m', label: '1m', interval: '1minute', count: 30,  sec: 60,     barSpacing: 8, labelLong: 'Each candle: 1 minute' },
  { id: '5m', label: '5m', interval: '5minute', count: 40,  sec: 300,    barSpacing: 8, labelLong: 'Each candle: 5 minutes' },
  { id: '15m',label: '15m',interval: '15minute',count: 60,  sec: 900,    barSpacing: 8, labelLong: 'Each candle: 15 minutes' },
  { id: '1h', label: '1h', interval: '1hour',   count: 75,  sec: 3600,   barSpacing: 8, labelLong: 'Each candle: 1 hour' },
  { id: '1D', label: '1D', interval: 'day',     count: 90,  sec: 86400,  barSpacing: 8,  labelLong: 'Each candle: 1 day' },
  { id: '1W', label: '1W', interval: 'week',    count: 52,  sec: 604800, barSpacing: 8, labelLong: 'Each candle: 1 week' },
  { id: '1M', label: '1M', interval: 'month', count: 48, sec: 2592000, barSpacing: 8, labelLong: 'Each candle: 1 calendar month' },
  { id: '1Y', label: '1Y', interval: 'year', count: 20, sec: 31536000, barSpacing: 8, labelLong: 'Each candle: 1 calendar year' },
];

export default function CandlestickChart({ instrumentKey, height = 400 }) {
  const { source,sessionId } = useMarket();
  const containerRef   = useRef(null);
  const chartRef       = useRef(null);
  const seriesRef      = useRef(null);
  const volumeRef      = useRef(null);
  const lastCandleRef  = useRef(null);
  const liveVolumeRef=useRef({key:null,day:null,total:0});
  const intervalSecRef = useRef(60);
  const viewStateRef=useRef({key:null,range:false});

  const [activeTf, setActiveTf]   = useState('1m');
  const [chartType, setChartType] = useState('candle');
  const requestVersion=useRef(0);
  const invalidateHistory=useCallback(()=>{requestVersion.current++;},[]);
  const [refreshVersion,setRefreshVersion]=useState(0);
  useEffect(()=>{const refresh=()=>setRefreshVersion(v=>v+1);window.addEventListener('cone-market-refresh',refresh);return()=>window.removeEventListener('cone-market-refresh',refresh);},[]);
  const [loadedBars,setLoadedBars]=useState(0);
  const [historyError,setHistoryError]=useState('');
  const [loading, setLoading]     = useState(true);
  const [hoverOhlc, setHoverOhlc] = useState(null);

  const livePrice = useLivePrice(instrumentKey);
  const livePriceRef = useRef(livePrice);
  const lastLiveSample = useRef({key:null,time:0});
  livePriceRef.current = livePrice;

  // Initialize Chart Container & Lightweight Charts instance
  useEffect(() => {
    if (!containerRef.current) return;

    const theme = chartTheme(containerRef.current);

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 600,
      height,
      layout: {
        ...theme.layout,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        ...theme.grid,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { ...theme.crosshair.vertLine, width: 1, style: 2 },
        horzLine: { ...theme.crosshair.horzLine, width: 1, style: 2 },
      },
      rightPriceScale: {
        ...theme.rightPriceScale,
        scaleMargins: { top: 0.08, bottom: 0.20 },
        autoScale: true,
      },
      localization: {timeFormatter:time=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Number(time)*1000))},
      timeScale: {
        ...theme.timeScale,
        tickMarkFormatter: (time,type)=>{
          const date=new Date(Number(time)*1000);
          const options=type===0?{year:'numeric'}:type===1?{month:'short',year:'2-digit'}:type===2?{day:'numeric',month:'short'}:{hour:'2-digit',minute:'2-digit',hour12:false};
          return new Intl.DateTimeFormat('en-IN',{...options,timeZone:'Asia/Kolkata'}).format(date);
        },
        timeVisible: true,
        secondsVisible: false,
        shiftVisibleRangeOnNewBar: true,
        rightOffset: 6,
      },
    });

    chartRef.current = chart;
    const stopThemeObserver = observeChartTheme(chart, containerRef.current);

    // Crosshair move handler for live OHLC legend
    chart.subscribeCrosshairMove(param => {
      if (!param || !param.time || !seriesRef.current) {
        setHoverOhlc(null);
        return;
      }
      const data = param.seriesData.get(seriesRef.current);
      if (data) {
        setHoverOhlc(data);
      } else {
        setHoverOhlc(null);
      }
    });

    // Resize observer
    const ro = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect?.width;
      if (width && chartRef.current) {
        chartRef.current.applyOptions({ width });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      stopThemeObserver();
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
      lastCandleRef.current = null;
    };
  }, [height]);

  // Load Data for active timeframe preset
  const loadData = useCallback(async () => {
    if (!chartRef.current || !instrumentKey) return;
    const version=++requestVersion.current;
    setLoading(true);setHistoryError('');setHoverOhlc(null);lastCandleRef.current=null;lastLiveSample.current={key:null,time:0};

    const chart = chartRef.current;
    const preset = TIMEFRAME_PRESETS.find(t => t.id === activeTf) || TIMEFRAME_PRESETS[2];

    intervalSecRef.current = preset.sec || 900;
    const sameStock=viewStateRef.current.key===instrumentKey;
    const oldScale=chart.timeScale();
    const spacing=sameStock&&!viewStateRef.current.range?oldScale.options().barSpacing:8;
    const anchor=sameStock&&oldScale.scrollPosition() < -2 ? oldScale.getVisibleRange()?.to : null;


    let rawCandles = [];
    try {
      rawCandles = await apiGet('/api/market/candles', {
        instrumentKey,
        interval: preset.interval,
        count: Math.max(400,preset.count),
      }, {timeout:30000});
    } catch (error) {
      if(version===requestVersion.current)setHistoryError(error.response?.data?.detail || 'Historical data unavailable');
      rawCandles = [];
    }

    if(version!==requestVersion.current || chartRef.current!==chart)return;
    // Clean, sort, and deduplicate timestamps
    const cleanCandles = [];
    const seenTimes = new Set();
    const sorted = [...rawCandles].filter(c=>c.time<=Date.now()/1000 && (!preset.rangeDays || c.time>=Math.floor((Date.now()/1000+19800)/86400)*86400-19800-preset.rangeDays*86400)).sort((a, b) => a.time - b.time);

    for (const c of sorted) {
      if (!seenTimes.has(c.time)) {
        seenTimes.add(c.time);
        cleanCandles.push(c);
      }
    }

    if(source==='replay'&&cleanCandles.length){lastLiveSample.current={key:instrumentKey,time:cleanCandles.at(-1).observedThrough||0};}
    setLoadedBars(cleanCandles.length);
    if (cleanCandles.length > 0) {
      lastCandleRef.current = { ...cleanCandles[cleanCandles.length - 1] };
    }

    // Remove existing series safely
    if (seriesRef.current) {
      try { chart.removeSeries(seriesRef.current); } catch {}
      seriesRef.current = null;
    }
    if (volumeRef.current) {
      try { chart.removeSeries(volumeRef.current); } catch {}
      volumeRef.current = null;
    }

    // Keep candle width consistent instead of fitting the entire history.
    chart.timeScale().applyOptions({
      barSpacing: spacing,
      rightOffset: 6,
    });

    chart.applyOptions({localization:{timeFormatter:time=>new Intl.DateTimeFormat('en-IN',{
      timeZone:'Asia/Kolkata',year:'numeric',
      ...(preset.interval==='year'?{}:preset.interval==='month'?{month:'long'}:preset.sec>=86400?{month:'short',day:'2-digit'}:{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})
    }).format(new Date(Number(time)*1000))}});
    // Create Main Price Series
    if (chartType === 'candle') {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: '#26A69A',
        downColor: '#EF5350',
        wickUpColor: '#26A69A',
        wickDownColor: '#EF5350',
        borderVisible: false,
        priceScaleId: 'right',
      });
      s.setData(cleanCandles);
      seriesRef.current = s;
    } else if (chartType === 'line') {
      const s = chart.addSeries(LineSeries, {
        color: '#26A69A',
        lineWidth: 2,
        priceLineVisible: true,
        priceScaleId: 'right',
      });
      s.setData(cleanCandles.map(c => ({ time: c.time, value: c.close })));
      seriesRef.current = s;
    } else {
      const s = chart.addSeries(AreaSeries, {
        topColor: 'rgba(38, 166, 154, 0.25)',
        bottomColor: 'rgba(38, 166, 154, 0.0)',
        lineColor: '#26A69A',
        lineWidth: 2,
        priceLineVisible: true,
        priceScaleId: 'right',
      });
      s.setData(cleanCandles.map(c => ({ time: c.time, value: c.close })));
      seriesRef.current = s;
    }

    // Create Volume Histogram Series
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    vol.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    vol.setData(cleanCandles.map(c => ({
      time: c.time,
      value: c.volume ?? 0,
      color: c.close >= c.open ? 'rgba(38, 166, 154, 0.35)' : 'rgba(239, 83, 80, 0.35)',
    })));
    volumeRef.current = vol;

    const scale=chart.timeScale();
    if(preset.rangeDays || preset.interval==='year'){
      scale.fitContent();
    }else if(cleanCandles.length){
      const rightIndex=anchor==null?cleanCandles.length-1:Math.max(0,cleanCandles.findLastIndex(c=>c.time<=anchor));
      const visibleBars=Math.max(12,Math.floor(scale.width()/spacing));
      const rightEdge=anchor==null?rightIndex+7:rightIndex;
      scale.setVisibleLogicalRange({from:rightEdge-visibleBars,to:rightEdge});
    }
    viewStateRef.current={key:instrumentKey,range:!!preset.rangeDays};
    if(source==='upstox'){const quote=livePriceRef.current;liveVolumeRef.current={key:instrumentKey,day:Math.floor((Number(quote?.lastUpdate)+19800)/86400),total:Number(quote?.volume)||0};}
    setLoading(false);
  }, [instrumentKey, activeTf, chartType, source]);

  // Trigger load on parameters change
  useEffect(() => {
    loadData();
    return invalidateHistory;
  }, [loadData, refreshVersion, invalidateHistory, sessionId]);

  // Handle timeframe button click with data limit validation & zoom adjustment
  const handleTimeframeSelect = (preset) => {
    if (['1Y','1M'].includes(preset.id) && !['upstox','replay'].includes(source)) {
      toast.error('Connect Upstox or select a replay workspace to view collected candles.', {
        id: 'tf-unsupported-error',
        duration: 4500,
        style: {
          background: 'var(--bg-surface)',
          color: '#F87171',
          border: '1px solid #EF4444',
          fontSize: '12px',
        }
      });
      return;
    }

    setActiveTf(preset.id);
  };

  // Real-Time Live Price & Dynamic Candle Formation
  useEffect(() => {
    if (!seriesRef.current || !volumeRef.current || !livePrice || !livePrice.ltp) return;

    const ltp = livePrice.ltp;
    const ivSec = intervalSecRef.current || 60;
    const sampleTime=Number(livePrice.lastUpdate)*1000;
    {
      if(!Number.isFinite(sampleTime)||(source==='upstox'&&(Date.now()-sampleTime>5000||sampleTime>Date.now()+1000)))return;
      if(lastLiveSample.current.key===instrumentKey&&lastLiveSample.current.time>=sampleTime)return;
      lastLiveSample.current={key:instrumentKey,time:sampleTime};
    }
    const nowSec = Math.floor(sampleTime / 1000);
    const istDay=Math.floor((nowSec+19800)/86400)*86400-19800;
    const sessionStart=istDay+9*3600+15*60;
    const monthStart=Date.UTC(new Date((nowSec+19800)*1000).getUTCFullYear(),new Date((nowSec+19800)*1000).getUTCMonth(),1)/1000-19800;
    const yearStart=Date.UTC(new Date((nowSec+19800)*1000).getUTCFullYear(),0,1)/1000-19800;
    const currentBucket=activeTf==='1Y'?yearStart:activeTf==='1M'?monthStart:(ivSec<86400 ? sessionStart+Math.floor((nowSec-sessionStart)/ivSec)*ivSec : ivSec===86400 ? istDay : istDay-((new Date((istDay+19800)*1000).getUTCDay()+6)%7)*86400);

    if(lastCandleRef.current && currentBucket<lastCandleRef.current.time)return;
    let observedVolume=0;
    if(source==='upstox'){
      const day=Math.floor((nowSec+19800)/86400),total=Number(livePrice.volume)||0,previous=liveVolumeRef.current;
      observedVolume=previous.key===instrumentKey&&previous.day===day&&total>=previous.total?total-previous.total:!lastCandleRef.current?total:0;
      liveVolumeRef.current={key:instrumentKey,day,total};
    }
    let targetCandle;

    if(source==='replay'&&livePrice.replayCandle){
      const sample=livePrice.replayCandle;
      targetCandle=lastCandleRef.current?.time===currentBucket?{...lastCandleRef.current,high:Math.max(lastCandleRef.current.high,sample.high),low:Math.min(lastCandleRef.current.low,sample.low),close:sample.close,volume:(lastCandleRef.current.volume||0)+(sample.volume||0)}:{...sample,time:currentBucket};
    }
    else if (lastCandleRef.current && currentBucket > lastCandleRef.current.time) {
      // Advance to next candle
      targetCandle = {
        time: currentBucket,
        open: ltp,
        high: ltp,
        low: ltp,
        close: ltp,
        volume: observedVolume,
      };
    } else if (lastCandleRef.current) {
      // Update existing current candle
      targetCandle = {
        time: lastCandleRef.current.time,
        open: lastCandleRef.current.open,
        high: Math.max(lastCandleRef.current.high, ltp),
        low: Math.min(lastCandleRef.current.low, ltp),
        close: ltp,
        volume: (lastCandleRef.current.volume || 0)+observedVolume,
      };
    } else {
      targetCandle = {
        time: currentBucket,
        open: ltp,
        high: ltp,
        low: ltp,
        close: ltp,
        volume: observedVolume,
      };
    }

    lastCandleRef.current = targetCandle;

    try {
      if (chartType === 'candle') {
        seriesRef.current.update(targetCandle);
      } else {
        seriesRef.current.update({ time: targetCandle.time, value: targetCandle.close });
      }

      volumeRef.current.update({
        time: targetCandle.time,
        value: targetCandle.volume,
        color: targetCandle.close >= targetCandle.open ? 'rgba(38, 166, 154, 0.35)' : 'rgba(239, 83, 80, 0.35)',
      });
    } catch {}
  }, [livePrice, chartType, source, instrumentKey, activeTf]);

  // Current display OHLC metrics
  const activeOhlc = hoverOhlc || lastCandleRef.current || {
    open: livePrice?.open,
    high: livePrice?.high,
    low:  livePrice?.low,
    close: livePrice?.ltp,
    volume: livePrice?.volume,
  };

  const displayPrice=value=>value==null?'—':fmtPrice(value);
  const candleChange = (activeOhlc.close && activeOhlc.open) ? (activeOhlc.close - activeOhlc.open) : 0;
  const candlePct = activeOhlc.open ? ((candleChange / activeOhlc.open) * 100) : 0;
  const isUp = candleChange >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!loading&&!loadedBars&&!livePrice&&<p className="muted">{source==='replay'?'Load a past session and press Play.':'No Live candles collected yet. New market trades will appear here.'}</p>}
      {historyError && <p role="status" className="muted">{historyError}</p>}
      {/* Top Toolbar: Timeframe Zoom Presets & Chart Types */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        {/* Timeframe Presets */}
        <div style={{ display: 'flex', gap: 3, background: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-subtle)' }}>
          {TIMEFRAME_PRESETS.map(tf => {
            const isActive = activeTf === tf.id;
            return (
              <button
                key={tf.id}
                onClick={() => handleTimeframeSelect(tf)}
                className="pill"
                title={tf.labelLong}
                style={{
                  background: isActive ? 'var(--accent-primary)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 11,
                  padding: '4px 9px',
                  borderRadius: 'var(--radius-sm)',
                  border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                {tf.label}
              </button>
            );
          })}
        </div>

        {/* Chart Type Toggle */}
        <div style={{ display: 'flex', gap: 3, background: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-subtle)' }}>
          {[
            { label: 'Candles', value: 'candle' },
            { label: 'Line',    value: 'line' },
            { label: 'Area',    value: 'area' },
          ].map(t => {
            const isActive = chartType === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setChartType(t.value)}
                className="pill"
                style={{
                  background: isActive ? 'var(--accent-primary)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 11,
                  padding: '4px 9px',
                  borderRadius: 'var(--radius-sm)',
                  border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Real-Time Candle Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '6px 10px',
        background: 'var(--bg-surface-raised)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        fontVariantNumeric: 'tabular-nums',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>O:</span>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{displayPrice(activeOhlc.open ?? activeOhlc.value)}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>H:</span>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{displayPrice(activeOhlc.high ?? activeOhlc.value)}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>L:</span>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{displayPrice(activeOhlc.low ?? activeOhlc.value)}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>C:</span>
          <span style={{ fontWeight: 500, color: isUp ? 'var(--price-up)' : 'var(--price-down)' }}>{displayPrice(activeOhlc.close ?? activeOhlc.value)}</span>
        </div>
        {activeOhlc.volume !== undefined && (
          <div style={{ display: 'flex', gap: 4 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Vol:</span>
            <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{formatNumber(activeOhlc.volume)}</span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', color: isUp ? 'var(--price-up)' : 'var(--price-down)', fontWeight: 600 }}>
          {isUp ? '+' : ''}{candleChange.toFixed(2)} ({formatPercent(candlePct)})
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div style={{ position: 'relative', width: '100%', height, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(18, 22, 28, 0.85)',
            zIndex: 10,
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Loading live chart feed...</span>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
