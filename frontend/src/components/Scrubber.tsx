import type { CSSProperties } from 'react'

interface Props { t: number; min: number; max: number; playing: boolean; areaKm2: number
  onChange: (v: number) => void; onToggle: () => void }

export default function Scrubber({ t, min, max, playing, areaKm2, onChange, onToggle }: Props) {
  const p = max > min ? ((t - min) / (max - min)) * 100 : 100
  return (
    <div data-dock="bottom" className="panel absolute inset-x-0 bottom-4 mx-auto w-[min(720px,calc(100vw-2rem))] p-4 max-sm:hidden">
      <div className="mb-2 flex items-end justify-between">
        <button onClick={onToggle} className="btn">
          {playing ? '❚❚ Pause' : '▶ Play the lake growing'}
        </button>
        <div className="text-right">
          <div className="display num text-5xl">{Math.floor(t)}</div>
          <div className="text-xs text-ink-2">Lake area about <b className="num text-ink">{areaKm2.toFixed(2)}</b> km²</div>
        </div>
      </div>
      <input type="range" min={min} max={max} step={0.02} value={t} className="track" style={{ '--p': `${p}%` } as CSSProperties}
        onChange={e => onChange(parseFloat(e.target.value))} />
      <div className="num flex justify-between text-xs text-ink-2"><span>{min}</span><span>{max}</span></div>
    </div>
  )
}
