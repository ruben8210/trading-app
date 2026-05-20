import { useMemo } from 'react'
import { calculateSMA, calculateEMA, calculateRSI, calculateMACD, calculateBollingerBands, calculateSupportResistance } from '../utils/indicators'

export function useIndicators(data) {
  const sma20     = useMemo(() => data.length ? calculateSMA(data, 20)  : [], [data])
  const sma50     = useMemo(() => data.length ? calculateSMA(data, 50)  : [], [data])
  const ema20     = useMemo(() => data.length ? calculateEMA(data, 20)  : [], [data])
  const rsiData   = useMemo(() => data.length ? calculateRSI(data, 14)  : [], [data])
  const macdData  = useMemo(() => data.length ? calculateMACD(data)     : {}, [data])
  const bbData    = useMemo(() => data.length ? calculateBollingerBands(data) : { middle: [], upper: [], lower: [] }, [data])
  const srData    = useMemo(() => data.length ? calculateSupportResistance(data) : { support: [], resistance: [] }, [data])
  return { sma20, sma50, ema20, rsiData, macdData, bbData, srData }
}
