export function calculateSMA(data, period) {
  return data.map((_, i) => {
    if (i < period - 1) return null
    const slice = data.slice(i - period + 1, i + 1)
    const avg = slice.reduce((sum, d) => sum + d.close, 0) / period
    return { time: data[i].time, value: avg }
  }).filter(Boolean)
}

export function calculateEMA(data, period) {
  const k = 2 / (period + 1)
  let ema = data[period - 1]?.close
  if (!ema) return []
  return data.map((d, i) => {
    if (i < period - 1) return null
    if (i === period - 1) {
      const sma = data.slice(0, period).reduce((s, x) => s + x.close, 0) / period
      ema = sma
      return { time: d.time, value: ema }
    }
    ema = d.close * k + ema * (1 - k)
    return { time: d.time, value: ema }
  }).filter(Boolean)
}

export function calculateRSI(data, period = 14) {
  if (data.length < period + 1) return []
  const gains = [], losses = []
  for (let i = 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close
    gains.push(diff > 0 ? diff : 0)
    losses.push(diff < 0 ? Math.abs(diff) : 0)
  }
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

  // Rellenar puntos iniciales con el primer valor válido para alinear con las velas
  const firstRs = avgLoss === 0 ? 100 : avgGain / avgLoss
  const firstVal = 100 - (100 / (1 + firstRs))
  const rsiValues = data.slice(0, period).map(d => ({ time: d.time, value: firstVal }))

  for (let i = period; i < data.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i - 1]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    rsiValues.push({ time: data[i].time, value: 100 - (100 / (1 + rs)) })
  }
  return rsiValues
}

export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calculateEMA(data, fastPeriod)
  const slowEMA = calculateEMA(data, slowPeriod)
  const slowTimes = new Set(slowEMA.map(d => d.time))
  const alignedFast = fastEMA.filter(d => slowTimes.has(d.time))
  const macdLine = alignedFast.map((d, i) => ({
    time: d.time,
    value: d.value - slowEMA[slowEMA.length - alignedFast.length + i].value
  }))
  const signalLine = calculateEMA(macdLine.map(d => ({ ...d, close: d.value })), signalPeriod)
  const signalTimes = new Set(signalLine.map(d => d.time))
  const alignedMacd = macdLine.filter(d => signalTimes.has(d.time))
  const histogram = alignedMacd.map((d, i) => ({
    time: d.time,
    value: d.value - signalLine[signalLine.length - alignedMacd.length + i].value
  }))

  // Rellenar inicio del histograma para alinear con las velas
  const firstVal = histogram[0]?.value ?? 0
  const fillerTimes = data
    .filter(d => !signalTimes.has(d.time))
    .map(d => ({ time: d.time, value: firstVal }))
  const fullHistogram = [...fillerTimes, ...histogram]

  return { macdLine, signalLine, histogram: fullHistogram }
}

export function calculateBollingerBands(data, period = 20, stdDev = 2) {
  if (data.length < period) return { middle: [], upper: [], lower: [] }
  const middle = [], upper = [], lower = []
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    const avg = slice.reduce((s, d) => s + d.close, 0) / period
    const variance = slice.reduce((s, d) => s + (d.close - avg) ** 2, 0) / period
    const std = Math.sqrt(variance)
    const t = data[i].time
    middle.push({ time: t, value: avg })
    upper.push({ time: t, value: avg + stdDev * std })
    lower.push({ time: t, value: avg - stdDev * std })
  }
  return { middle, upper, lower }
}

export function calculateSupportResistance(data, lookback = 100) {
  if (data.length < 30) return { support: [], resistance: [] }
  const recent = data.slice(-lookback)
  const levels = []
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i].low < recent[i-1].low && recent[i].low < recent[i-2].low &&
        recent[i].low < recent[i+1].low && recent[i].low < recent[i+2].low) {
      levels.push({ price: recent[i].low, type: 'support' })
    }
    if (recent[i].high > recent[i-1].high && recent[i].high > recent[i-2].high &&
        recent[i].high > recent[i+1].high && recent[i].high > recent[i+2].high) {
      levels.push({ price: recent[i].high, type: 'resistance' })
    }
  }
  const avgRange = data.reduce((s, d) => s + (d.high - d.low), 0) / data.length
  const threshold = avgRange * 0.8
  const merged = []
  levels.forEach(l => {
    const exist = merged.find(m => Math.abs(m.price - l.price) < threshold && m.type === l.type)
    if (exist) {
      exist.count++
      exist.price = (exist.price + l.price) / 2
    } else {
      merged.push({ ...l, count: 1 })
    }
  })
  const significant = merged.filter(l => l.count >= 2)
  return {
    support: significant.filter(l => l.type === 'support').map(l => l.price),
    resistance: significant.filter(l => l.type === 'resistance').map(l => l.price),
  }
}
