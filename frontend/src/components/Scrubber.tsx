interface Props { t: number; min: number; max: number; playing: boolean; areaKm2: number
  onChange: (v: number) => void; onToggle: () => void }

export default function Scrubber({ t, min, max, playing, areaKm2, onChange, onToggle }: Props) {
  return (
    <div className="panel absolute bottom-4 left-1/2 w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 p-4">
      <div className="mb-2 flex items-end justify-between">
        <button onClick={onToggle} className="btn">
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <div className="text-right">
          <div className="num text-3xl font-medium">{Math.floor(t)}</div>
          <div className="text-xs text-ink-2">Lake area about <b className="num text-ink">{areaKm2.toFixed(2)}</b> km²</div>
        </div>
      </div>
      <input type="range" min={min} max={max} step={0.02} value={t} className="track"
        onChange={e => onChange(parseFloat(e.target.value))} />
      <div className="num flex justify-between text-xs text-ink-2"><span>{min}</span><span>{max}</span></div>
    </div>
  )
}
