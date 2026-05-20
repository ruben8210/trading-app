import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

const MeasureTool = forwardRef(function MeasureTool({ chartRef, seriesRef, data }, ref) {
  const canvasRef = useRef(null)
  const activeRef = useRef(false)
  const p1Ref = useRef(null)
  const p2Ref = useRef(null)
  const doneRef = useRef(false)
  const mouseRef = useRef(null)
  const dataRef = useRef(data)
  dataRef.current = data

  function redraw() {
    const canvas = canvasRef.current
    const chart = chartRef.current
    if (!canvas || !chart) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const p1 = p1Ref.current
    const p2 = p2Ref.current || mouseRef.current
    if (!p1 || !p2) return

    if (p2 === mouseRef.current && doneRef.current) return

    ctx.save()
    ctx.strokeStyle = '#888'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(p1.px, p1.py)
    ctx.lineTo(p2.px, p2.py)
    ctx.stroke()
    ctx.restore()

    if (doneRef.current && p2Ref.current) {
      const isUp = p2Ref.current.price >= p1.price
      const color = isUp ? '26a69a' : 'ef5350'
      const left = Math.min(p1.px, p2.px)
      const right = Math.max(p1.px, p2.px)
      const top = Math.min(p1.py, p2.py)
      const bottom = Math.max(p1.py, p2.py)

      ctx.fillStyle = `#${color}22`
      ctx.fillRect(left, top, right - left, bottom - top)
      ctx.strokeStyle = `#${color}`
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.strokeRect(left, top, right - left, bottom - top)
      ctx.setLineDash([])

      const diff = p2Ref.current.price - p1.price
      const pct = (diff / p1.price) * 100
      const arrow = isUp ? '▲' : '▼'
      const sign = isUp ? '+' : ''
      const bars = dataRef.current.filter(d =>
        d.time >= Math.min(p1.time, p2Ref.current.time) &&
        d.time <= Math.max(p1.time, p2Ref.current.time)
      ).length

      const text = `${arrow} ${sign}${diff.toFixed(2)} USD (${sign}${pct.toFixed(2)}%) — ${bars} velas`
      ctx.font = '11px monospace'
      const tw = ctx.measureText(text).width
      const pad = 6
      const lx = left + 4
      const ly = top + 4
      ctx.fillStyle = '#1e222dee'
      ctx.fillRect(lx - pad, ly - pad, tw + pad * 2, 15 + pad * 2)
      ctx.fillStyle = `#${color}`
      ctx.fillText(text, lx, ly + 11)
    }
  }

  function resizeCanvas() {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return
    const rect = parent.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    redraw()
  }

  const reset = () => {
    activeRef.current = false
    p1Ref.current = null
    p2Ref.current = null
    mouseRef.current = null
    doneRef.current = false
    const c = canvasRef.current
    if (c) { c.style.pointerEvents = 'none'; c.style.cursor = '' }
    const ctx = c?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, c.width, c.height)
  }

  useImperativeHandle(ref, () => ({
    toggle() {
      if (activeRef.current) { reset(); return }
      activeRef.current = true
      p1Ref.current = null
      p2Ref.current = null
      mouseRef.current = null
      doneRef.current = false
      const c = canvasRef.current
      if (c) { c.style.pointerEvents = 'auto'; c.style.cursor = 'crosshair' }
    },
    get active() { return activeRef.current },
  }), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    resizeCanvas()
    const ro = new ResizeObserver(resizeCanvas)
    ro.observe(parent)

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect()
      return { px: e.clientX - rect.left, py: e.clientY - rect.top }
    }

    const getChartPoint = (px, py) => {
      const chart = chartRef.current
      const series = seriesRef?.current
      if (!chart || !series) return null
      const time = chart.timeScale().coordinateToTime(px)
      const price = series.coordinateToPrice(py)
      if (time == null || price == null) return null
      return { px, py, time, price }
    }

    const onClick = (e) => {
      if (!activeRef.current) return
      const pos = getPos(e)
      const cp = getChartPoint(pos.px, pos.py)
      if (!cp) return

      if (!p1Ref.current) {
        p1Ref.current = cp
        p2Ref.current = null
        mouseRef.current = null
        doneRef.current = false
        redraw()
      } else if (!doneRef.current) {
        p2Ref.current = cp
        mouseRef.current = null
        doneRef.current = true
        redraw()
      }
    }

    const onMove = (e) => {
      if (!activeRef.current || !p1Ref.current || doneRef.current) return
      const pos = getPos(e)
      mouseRef.current = pos
      redraw()
    }

    const onContext = (e) => {
      if (activeRef.current) { e.preventDefault(); reset() }
    }

    const onKey = (e) => {
      if (e.key === 'Escape' && activeRef.current) reset()
    }

    parent.addEventListener('click', onClick)
    parent.addEventListener('mousemove', onMove)
    parent.addEventListener('contextmenu', onContext)
    document.addEventListener('keydown', onKey)

    return () => {
      ro.disconnect()
      parent.removeEventListener('click', onClick)
      parent.removeEventListener('mousemove', onMove)
      parent.removeEventListener('contextmenu', onContext)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => { reset() }, [data])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-10"
      style={{ pointerEvents: 'none' }}
    />
  )
})

export default MeasureTool
