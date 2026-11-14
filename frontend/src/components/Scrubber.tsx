interface Props { t: number; min: number; max: number; playing: boolean; areaKm2: number
  onChange: (v: number) => void; onToggle: () => void }

export default function Scrubber({ t, min, max, playing, areaKm2, onChange, onToggle }: Props) {
  return (
    <div className="absolute bottom-4 left-1/2 w-[min(720px,92vw)] -translate-x-1/2 rounded-xl bg-slate-900/85 p-4 text-slate-100 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-end justify-between">
        <button onClick={onToggle} className="rounded-lg bg-cyan-500 px-3 py-1 text-sm font-semibold text-slate-900 hover:bg-cyan-400">
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">{Math.floor(t)}</div>
          <div className="text-xs text-slate-300">Lake area ≈ <b className="tabular-nums">{areaKm2.toFixed(2)}</b> km²</div>
        </div>
      </div>
      <input type="range" min={min} max={max} step={0.02} value={t} className="w-full accent-cyan-400"
        onChange={e => onChange(parseFloat(e.target.value))} />
      <div className="flex justify-between text-xs text-slate-400"><span>{min}</span><span>{max}</span></div>
    </div>
  )
}
