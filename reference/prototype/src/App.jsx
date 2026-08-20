// React stays thin: mount the canvas, own hover state, render labels and the
// readout. Particle state never touches React — a re-render can never disturb
// the loop.

import { useEffect, useRef, useState } from 'react'
import { createEngine } from './engine/loop.js'
import { Readout } from './hover/Readout.jsx'

export default function App() {
  const canvasRef = useRef(null)
  const [labels, setLabels] = useState([])
  const [hover, setHover] = useState(-1)

  useEffect(() => {
    const engine = createEngine(canvasRef.current, {
      onLabels: setLabels,
      onHover: setHover,
    })
    return engine.destroy
  }, [])

  const hovered = hover >= 0 ? labels[hover] : null

  return (
    <>
      <canvas ref={canvasRef} className="stage" />
      <div className="labels" aria-hidden="true">
        {labels.map((l) => (
          <span
            key={l.idx}
            className={
              'river-label' +
              (hover === -1 ? '' : hover === l.idx ? ' is-hot' : ' is-dim')
            }
            style={{ transform: `translate(${l.x}px, ${l.y}px)` }}
          >
            {l.name}
          </span>
        ))}
      </div>
      {hovered && <Readout key={hovered.idx} data={hovered} />}
    </>
  )
}
