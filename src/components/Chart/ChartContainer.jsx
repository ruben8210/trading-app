import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, LineSeries, HistogramSeries, AreaSeries, LineStyle } from 'lightweight-charts'
import { useChartData } from '../../hooks/useChartData'
import { fetchLatestCandle } from '../../services/api'
import { useIndicators } from '../../hooks/useIndicators'
import ChartLegend from './ChartLegend'
import MeasureTool from './MeasureTool'

const RANGES = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1A', '5A', 'Todos']
const DEFAULT_RANGE = '3M'

function getPriceFormat(price) {
  if (!price || price === 0) return { precision: 2, minMove: 0.01 }
  if (price >= 1000)  return { precision: 2, minMove: 0.01 }
  if (price >= 100)   return { precision: 2, minMove: 0.01 }
  if (price >= 1)     return { precision: 4, minMove: 0.0001 }
  if (price >= 0.01)  return { precision: 5, minMove: 0.00001 }
  if (price >= 0.001) return { precision: 6, minMove: 0.000001 }
  return               { precision: 8, minMove: 0.00000001 }
}

function baseOptions(el) {
  return {
    width: el.clientWidth,
    height: el.clientHeight,
    layout: { background: { color: '#131722' }, textColor: '#d1d4dc' },
    grid: { vertLines: { color: '#2a2e39' }, horzLines: { color: '#2a2e39' } },
    localization: { locale: 'es-ES' },
    crosshair: { mode: 0 },
    rightPriceScale: { borderColor: '#2a2e39' },
    timeScale: { borderColor: '#2a2e39', timeVisible: true, secondsVisible: false, lockVisibleTimeRangeOnResize: true },
  }
}

function syncCharts(sourceChart, targetCharts) {
  sourceChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (range === null) return
    targetCharts.forEach(target => {
      target.timeScale().setVisibleLogicalRange(range)
    })
  })
}

function IndicatorChart({ containerRef, data, seriesType, color, onChartReady, priceLines, getLineColor, zones }) {
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const zoneSeriesRef = useRef([])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chart = createChart(el, {
      ...baseOptions(el),
      handleScroll: false,
      handleScale: false,
      timeScale: { ...baseOptions(el).timeScale, visible: false },
    })
    const Series = seriesType === 'line' ? LineSeries : HistogramSeries
    seriesRef.current = chart.addSeries(Series, {
      color,
      lineWidth: 1.5,
      ...(seriesType === 'histogram' ? { priceFormat: { type: 'volume' } } : {}),
    })
    chartRef.current = chart
    onChartReady(chart)

    if (priceLines) {
      priceLines.forEach(pl => seriesRef.current.createPriceLine(pl))
    }

    const ro = new ResizeObserver(() => {
      if (chart && el) chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)

    return () => { ro.disconnect(); chart.remove() }
  }, [])

  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return
    const chart = chartRef.current
    seriesRef.current.setData(data)
    chart?.timeScale().fitContent()

    if (getLineColor && data.length > 0) {
      const lastVal = data.at(-1).value
      seriesRef.current.applyOptions({ color: getLineColor(lastVal) })
    }

    if (zones && chart && data.length > 0) {
      zoneSeriesRef.current.forEach(zs => { if (zs) try { chart.removeSeries(zs) } catch {} })
      zoneSeriesRef.current = []
      zones.forEach(({ linePrice, base, topColor, bottomColor }) => {
        const zs = chart.addSeries(AreaSeries, {
          topColor, bottomColor, lineColor: 'transparent', lineWidth: 0,
          base, priceFormat: { type: 'price' },
        })
        zs.setData(data.map(d => ({ time: d.time, value: linePrice })))
        zoneSeriesRef.current.push(zs)
      })
    }
  }, [data])

  return null
}

export default function ChartContainer({ symbol, timeframe, indicators }) {
  const chartAreaRef = useRef(null)
  const rsiAreaRef = useRef(null)
  const macdAreaRef = useRef(null)
  const chartRef = useRef(null)
  const rsiChartRef = useRef(null)
  const macdChartRef = useRef(null)
  const candleSeriesRef = useRef(null)
  const allDataRef = useRef([])
  const loadingMoreRef = useRef(false)
  const [chartRange, setChartRange] = useState(DEFAULT_RANGE)
  const measureToolRef = useRef(null)
  const [rsiChart, setRsiChart] = useState(null)
  const [macdChart, setMacdChart] = useState(null)
  const isSyncingRef = useRef(false)
  const overlaySeriesRef = useRef({})

  const { data, loading, error, loadMore } = useChartData(symbol, timeframe, chartRange)
  const { sma20, sma50, ema20, rsiData, macdData, bbData, srData } = useIndicators(data)

  const rsiActive = indicators?.rsi && rsiData.length > 0
  const macdActive = indicators?.macd && macdData?.histogram?.length > 0

  const overlayConfig = [
    { key: 'sma20', active: indicators?.sma20, data: sma20, color: '#2962ff' },
    { key: 'sma50', active: indicators?.sma50, data: sma50, color: '#ff6d00' },
    { key: 'ema20', active: indicators?.ema20, data: ema20, color: '#ab47bc' },
  ]

  useEffect(() => {
    const el = chartAreaRef.current
    if (!el) return
    const w = el.clientWidth || 1
    const h = el.clientHeight || 1
    const chart = createChart(el, { ...baseOptions(el), width: w, height: h })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350',
      borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    })
    chartRef.current = chart
    candleSeriesRef.current = series

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range) return
      if (range.from < 5 && allDataRef.current.length > 0) {
        loadingMoreRef.current = true
        loadMore().finally(() => { loadingMoreRef.current = false })
      }
    })

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth; const h = el.clientHeight
      if (w > 0 && h > 0) chart.applyOptions({ width: w, height: h })
    })
    ro.observe(el)
    return () => { ro.disconnect(); chart.remove() }
  }, [loadMore])

  useEffect(() => {
    if (!candleSeriesRef.current) return
    if (data.length === 0) {
      candleSeriesRef.current.setData([])
      allDataRef.current = []
      return
    }
    const series = candleSeriesRef.current
    const chart = chartRef.current
    const prevLen = allDataRef.current.length
    allDataRef.current = data

    const fmt = getPriceFormat(data.at(-1)?.close)
    series.applyOptions({ priceFormat: { type: 'price', ...fmt } })

    if (prevLen === 0 || data.length <= prevLen) {
      series.setData(data)
      chart?.timeScale().fitContent()
    } else {
      const added = data.length - prevLen
      const vr = chart?.timeScale().getVisibleLogicalRange()
      series.setData(data)
      if (vr && chart) {
        chart.timeScale().setVisibleLogicalRange({ from: vr.from + added, to: vr.to + added })
      }
    }
  }, [data])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const s = overlaySeriesRef.current

    overlayConfig.forEach(({ key, active, data, color }) => {
      if (active && data.length > 0) {
        if (!s[key]) s[key] = chart.addSeries(LineSeries, { color, lineWidth: 1.5 })
        s[key].setData(data)
      } else if (s[key]) {
        try { chart.removeSeries(s[key]) } catch {}
        s[key] = null
      }
    })

    // Bollinger Bands — 3 lines
    if (indicators?.bollinger && bbData?.middle?.length > 0) {
      if (!s['bb_mid']) s['bb_mid'] = chart.addSeries(LineSeries, { color: '#fdd835', lineWidth: 1 })
      if (!s['bb_up'])  s['bb_up']  = chart.addSeries(LineSeries, { color: '#42a5f5', lineWidth: 1 })
      if (!s['bb_lo'])  s['bb_lo']  = chart.addSeries(LineSeries, { color: '#42a5f5', lineWidth: 1 })
      s['bb_mid'].setData(bbData.middle)
      s['bb_up'].setData(bbData.upper)
      s['bb_lo'].setData(bbData.lower)
    } else {
      ['bb_mid','bb_up','bb_lo'].forEach(k => { if (s[k]) { try { chart.removeSeries(s[k]) } catch {}; s[k] = null } })
    }

    // Support / Resistance — horizontal dashed lines
    if (indicators?.sr) {
      const sr = srData
      sr.support.forEach((price, i) => {
        const k = `sr_sup_${i}`
        if (!s[k]) {
          const line = chart.addSeries(LineSeries, { color: '#66bb6a', lineWidth: 1 })
          if (data.length > 0) {
            line.setData(data.map(d => ({ time: d.time, value: price })))
          }
          s[k] = line
        }
      })
      sr.resistance.forEach((price, i) => {
        const k = `sr_res_${i}`
        if (!s[k]) {
          const line = chart.addSeries(LineSeries, { color: '#ef5350', lineWidth: 1 })
          if (data.length > 0) {
            line.setData(data.map(d => ({ time: d.time, value: price })))
          }
          s[k] = line
        }
      })
    } else {
      Object.keys(s).filter(k => k.startsWith('sr_')).forEach(k => {
        if (s[k]) { try { chart.removeSeries(s[k]) } catch {}; s[k] = null }
      })
    }
  }, [
    indicators?.sma20, indicators?.sma50, indicators?.ema20,
    indicators?.bollinger, indicators?.sr,
    sma20, sma50, ema20, bbData, srData, data,
  ])

  useEffect(() => {
    if (!candleSeriesRef.current || !symbol) return
    const id = setInterval(async () => {
      try {
        const candle = await fetchLatestCandle(symbol, timeframe)
        if (candle) candleSeriesRef.current?.update(candle)
      } catch {}
    }, 10000)
    return () => clearInterval(id)
  }, [symbol, timeframe])

  const unsubsRef = useRef([])

  useEffect(() => {
    unsubsRef.current.forEach(fn => { try { fn() } catch {} })
    unsubsRef.current = []

    const main = chartRef.current
    const charts = [main, rsiChart, macdChart].filter(Boolean)
    if (charts.length < 2) return

    charts.forEach(ch => {
      const sub = ch.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (isSyncingRef.current || range === null) return
        isSyncingRef.current = true
        charts.filter(c => c !== ch).forEach(target => {
          target.timeScale().setVisibleLogicalRange(range)
        })
        isSyncingRef.current = false
      })
      unsubsRef.current.push(sub)
    })

    return () => {
      unsubsRef.current.forEach(fn => { try { fn() } catch {} })
      unsubsRef.current = []
    }
  }, [rsiChart, macdChart])

  return (
    <div className="flex flex-col h-full relative">
      <ChartLegend symbol={symbol} data={data} />
      <div className="flex flex-1 min-h-0">
        <div className="w-8 bg-surface border-r border-border flex flex-col items-center py-2 shrink-0">
          <button
            onClick={() => measureToolRef.current?.toggle()}
            title="Medir"
            className={`w-6 h-6 flex items-center justify-center rounded text-sm transition-colors
              ${measureToolRef.current?.active ? 'bg-accent text-white' : 'text-text hover:bg-border'}`}
          >
            📏
          </button>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="relative" style={{ flex: `${rsiActive || macdActive ? '6 1 0' : '1 1 0'}` }}>
            <div ref={chartAreaRef} className="absolute inset-0" />
            <MeasureTool ref={measureToolRef} chartRef={chartRef} seriesRef={candleSeriesRef} data={data} />
          </div>
          {rsiActive && (
            <div className="flex flex-col border-t border-border" style={{ flex: '2 1 0', minHeight: 80 }}>
              <div className="px-3 py-0.5 text-xs text-text/60 font-semibold shrink-0">RSI (14)</div>
              <div ref={rsiAreaRef} className="flex-1 relative" />
              <IndicatorChart containerRef={rsiAreaRef} data={rsiData} seriesType="line" color="#2196f3" onChartReady={setRsiChart}
                priceLines={[
                  { price: 70, color: 'rgba(255,82,82,0.6)', lineWidth: 1, lineStyle: LineStyle.Dashed },
                  { price: 30, color: 'rgba(38,166,154,0.6)', lineWidth: 1, lineStyle: LineStyle.Dashed },
                  { price: 50, color: 'rgba(150,150,150,0.3)', lineWidth: 1, lineStyle: LineStyle.Dashed },
                ]}
                getLineColor={(v) => v > 70 ? '#ff5252' : v < 30 ? '#26a69a' : '#2196f3'}
                zones={[
                  { linePrice: 70, base: 100, topColor: 'rgba(255,82,82,0.0)', bottomColor: 'rgba(255,82,82,0.08)' },
                  { linePrice: 30, base: 0, topColor: 'rgba(38,166,154,0.08)', bottomColor: 'rgba(38,166,154,0.0)' },
                ]}
              />
            </div>
          )}
          {macdActive && (
            <div className="flex flex-col border-t border-border" style={{ flex: '2 1 0', minHeight: 80 }}>
              <div className="px-3 py-0.5 text-xs text-text/60 font-semibold shrink-0">MACD</div>
              <div ref={macdAreaRef} className="flex-1 relative" />
              <IndicatorChart containerRef={macdAreaRef} data={macdData.histogram} seriesType="histogram" color="#26a69a" onChartReady={setMacdChart} />
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1 px-4 py-1.5 border-t border-border">
        {RANGES.map(r => (
          <button key={r} onClick={() => setChartRange(r)}
            className={`px-2 py-0.5 text-xs rounded transition-colors
              ${chartRange === r ? 'text-accent font-semibold' : 'text-text/60 hover:text-text'}`}>
            {r}
          </button>
        ))}
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/80">
          <span className="text-text">Cargando datos...</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-red-500">Error: {error}</span>
        </div>
      )}
    </div>
  )
}
