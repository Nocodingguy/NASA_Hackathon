import type { CSSProperties } from 'react'
import { Pause, Play } from 'lucide-react'

interface Props { t: number; min: number; max: number; playing: boolean; areaKm2: number
  onChange: (v: number) => void; onToggle: () => void }

export default function Scrubber({ t, min, max, playing, areaKm2, onChange, onToggle }: Props) {
  const p = max > min ? ((t - min) / (max - min)) * 100 : 100
  return (
    <div className="panel px-5 py-4">
      <div className="mb-1 flex items-center justify-between gap-4 pr-8">
        <button onClick={onToggle} className="btn">
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? 'Pause' : 'Play the lake growing'}
        </button>
        <div className="flex items-baseline gap-4 text-right">
          <span className="text-xs text-ink-2">Lake area <b className="num text-ink">{areaKm2.toFixed(2)}</b> km²</span>
          <span className="display num text-5xl leading-none">{Math.floor(t)}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={0.02} value={t} className="track" style={{ '--p': `${p}%` } as CSSProperties}
        aria-label="Year" onChange={e => onChange(parseFloat(e.target.value))} />
      <div className="num flex justify-between text-xs text-ink-2"><span>{min}</span><span>{max}</span></div>
    </div>
  )
}
