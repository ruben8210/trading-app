export function calculateSMA(data, period) {
  if (!Array.isArray(data) || data.length === 0) return []
  if (period < 1 || period > data.length) return []

  return data.map((_, i) => {
    if (i < period - 1) return null
    const slice = data.slice(i - period + 1, i + 1)
    const avg = slice.reduce((sum, d) => sum + (d.close ?? 0), 0) / period
    return { time: data[i].time, value: avg }
  }).filter(Boolean)
}

export function calculateEMA(data, period) {
  if (!Array.isArray(data) || data.length === 0) return []
  if (period < 1 || period > data.length) return []

  const k = 2 / (period + 1)
  const closes = data.map(d => d.close ?? 0)
  const sma = closes.slice(0, period).reduce((a, b) => a + b, 0) / period

  let ema = sma
  const result = []

  data.forEach((d, i) => {
    if (i < period - 1) return
    if (i === period - 1) {
      result.push({ time: d.time, value: ema })
    } else {
      ema = (closes[i] * k) + (ema * (1 - k))
      result.push({ time: d.time, value: ema })
    }
  })

  return result
}

export function calculateRSI(data, period = 14) {
  if (!Array.isArray(data) || data.length < period + 1) return []

  const gains = [], losses = []
  for (let i = 1; i < data.length; i++) {
    const diff = (data[i].close ?? 0) - (data[i - 1].close ?? 0)
    gains.push(diff > 0 ? diff : 0)
    losses.push(diff < 0 ? Math.abs(diff) : 0)
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

  const calculateValue = (ag, al) => {
    if (al === 0) return ag === 0 ? 50 : 100
    const rs = ag / al
    return 100 - (100 / (1 + rs))
  }

  const firstVal = calculateValue(avgGain, avgLoss)
  const rsiValues = data.slice(0, period).map(d => ({ time: d.time, value: firstVal }))

  for (let i = period; i < data.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i - 1]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period
    rsiValues.push({ time: data[i].time, value: calculateValue(avgGain, avgLoss) })
  }

  return rsiValues
}

export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!Array.isArray(data) || data.length < slowPeriod) {
    return { macdLine: [], signalLine: [], histogram: [] }
  }

  const fastEMA = calculateEMA(data, fastPeriod)
  const slowEMA = calculateEMA(data, slowPeriod)

  if (fastEMA.length === 0 || slowEMA.length === 0) {
    return { macdLine: [], signalLine: [], histogram: [] }
  }

  const slowTimes = new Set(slowEMA.map(d => d.time))
  const alignedFast = fastEMA.filter(d => slowTimes.has(d.time))

  const macdLine = alignedFast.map((d, i) => ({
    time: d.time,
    value: d.value - (slowEMA[slowEMA.length - alignedFast.length + i]?.value ?? 0)
  }))

  if (macdLine.length === 0) {
    return { macdLine: [], signalLine: [], histogram: [] }
  }

  const signalLine = calculateEMA(macdLine.map(d => ({ ...d, close: d.value })), signalPeriod)

  if (signalLine.length === 0) {
    return { macdLine, signalLine: [], histogram: [] }
  }

  const signalTimes = new Set(signalLine.map(d => d.time))
  const alignedMacd = macdLine.filter(d => signalTimes.has(d.time))

  const histogram = alignedMacd.map((d, i) => ({
    time: d.time,
    value: d.value - (signalLine[signalLine.length - alignedMacd.length + i]?.value ?? 0)
  }))

  const firstVal = histogram[0]?.value ?? 0
  const fillerTimes = data
    .filter(d => !signalTimes.has(d.time))
    .map(d => ({ time: d.time, value: firstVal }))
  const fullHistogram = [...fillerTimes, ...histogram]

  return { macdLine, signalLine, histogram: fullHistogram }
}

export function calculateBollingerBands(data, period = 20, stdDev = 2) {
  if (!Array.isArray(data) || data.length < period) {
    return { middle: [], upper: [], lower: [] }
  }

  const middle = [], upper = [], lower = []

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    const closes = slice.map(d => d.close ?? 0)
    const avg = closes.reduce((s, c) => s + c, 0) / period
    const variance = closes.reduce((s, c) => s + (c - avg) ** 2, 0) / period
    const std = Math.sqrt(variance)
    const t = data[i].time

    middle.push({ time: t, value: avg })
    upper.push({ time: t, value: avg + stdDev * std })
    lower.push({ time: t, value: avg - stdDev * std })
  }

  return { middle, upper, lower }
}

export function calculateSupportResistance(data, lookback = 100) {
  if (!Array.isArray(data) || data.length < 30) {
    return { support: [], resistance: [] }
  }

  const recent = data.slice(-lookback)
  const levels = []

  for (let i = 2; i < recent.length - 2; i++) {
    const curr = recent[i]
    const prev1 = recent[i - 1]
    const prev2 = recent[i - 2]
    const next1 = recent[i + 1]
    const next2 = recent[i + 2]

    const currLow = curr.low ?? 0
    const currHigh = curr.high ?? 0

    if (currLow < (prev1.low ?? 0) && currLow < (prev2.low ?? 0) &&
        currLow < (next1.low ?? 0) && currLow < (next2.low ?? 0)) {
      levels.push({ price: currLow, type: 'support' })
    }

    if (currHigh > (prev1.high ?? 0) && currHigh > (prev2.high ?? 0) &&
        currHigh > (next1.high ?? 0) && currHigh > (next2.high ?? 0)) {
      levels.push({ price: currHigh, type: 'resistance' })
    }
  }

  if (levels.length === 0) {
    return { support: [], resistance: [] }
  }

  const ranges = data.map(d => (d.high ?? 0) - (d.low ?? 0))
  const avgRange = ranges.reduce((s, r) => s + r, 0) / ranges.length
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
