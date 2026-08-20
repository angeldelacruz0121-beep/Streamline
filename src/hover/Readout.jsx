// The veteran layer: hover a river, see the actual figures. Numbers count up
// on a real ease-out cubic; tabular where the font provides it. No card, no
// chrome — quiet text with a ground-colored glow for legibility over water.

import { useEffect, useRef, useState } from 'react'

const DUR = 480 // ms

function fmt(n) {
  const b = n / 1e9
  return b >= 10 ? `$${b.toFixed(1)}B` : `$${b.toFixed(2)}B`
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3)
}

export function Readout({ data }) {
  const [k, setK] = useState(0)
  const raf = useRef(0)

  useEffect(() => {
    const start = performance.now()
    const tick = (ts) => {
      const p = Math.min((ts - start) / DUR, 1)
      setK(easeOutCubic(p))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [data])

  return (
    <div
      className="readout"
      style={{ transform: `translate(${data.x}px, ${data.y + 22}px)` }}
    >
      <div className="readout-row readout-gross">
        <span>Gross revenue</span>
        <span className="num">{fmt(data.gross * k)}</span>
      </div>
      {data.costs.map((c) => (
        <div key={c.label} className="readout-row readout-cost">
          <span>{c.label}</span>
          <span className="num">−{fmt(c.amount * k)}</span>
        </div>
      ))}
      <div className="readout-row readout-net">
        <span>Net to lake</span>
        <span className="num">{fmt(data.net * k)}</span>
      </div>
    </div>
  )
}
