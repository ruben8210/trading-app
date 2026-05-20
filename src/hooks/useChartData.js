import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchOHLCV, fetchMoreOHLCV } from '../services/api'

export function useChartData(symbol, interval, chartRange) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const oldestRef = useRef(null)
  const symbolRef = useRef(symbol)
  const intervalRef = useRef(interval)
  const rangeRef = useRef(chartRange)
  const abortRef = useRef(null)

  symbolRef.current = symbol
  intervalRef.current = interval
  rangeRef.current = chartRange

  useEffect(() => {
    if (!symbol) return

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setData([])
    oldestRef.current = null

    fetchOHLCV(symbol, interval, chartRange, controller.signal)
      .then(d => {
        if (controller.signal.aborted) return
        setData(d)
        if (d.length > 0) oldestRef.current = d[0].time
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [symbol, interval, chartRange])

  const loadMore = useCallback(async () => {
    const sym = symbolRef.current
    const iv = intervalRef.current
    const rng = rangeRef.current
    if (!sym || !iv || rng) return
    if (!oldestRef.current) return
    try {
      const older = await fetchMoreOHLCV(sym, iv, oldestRef.current)
      if (older.length === 0) return
      oldestRef.current = older[0].time
      setData(prev => [...older, ...prev])
    } catch (e) {
      setError(e.message)
    }
  }, [])

  return { data, loading, error, loadMore }
}
