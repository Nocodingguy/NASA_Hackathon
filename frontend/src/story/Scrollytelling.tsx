import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Map as MapIcon } from 'lucide-react'
import type { ExposureFeature, LakeFeature } from '../types'
import { lakeInfos } from '../detective/lakeInfo'
import { gsap, reducedMotion } from '../lib/motion'

interface Props {
  lakes: LakeFeature[]
  exposure: ExposureFeature[]
  onDetective: () => void
  onMap: () => void
}

interface Site { name: string; eta: number | null; f: number }
interface Pt { x: number; y: number }

const BEATS = 5
const TOTAL = 10
const FLOW = 'M 958 452 C 1040 492, 1090 530, 1160 548 S 1290 590, 1380 640'
const WATER_LOW = 548
const WATER_HIGH = 452
const WATER_MAX = 446
const FLOOD = '#ff5a3c'

const shortName = (n: string) => n.replace(/\s*\(.*\)/, '').split(' ').slice(0, 2).join(' ')
const fmtEta = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`)

const beatAt = (t: number) => (t < 1.2 ? 0 : t < 4.2 ? 1 : t < 6.5 ? 2 : t < 9.2 ? 3 : 4)

const HERO = ['Lakes', 'are', 'filling', 'above', 'the', 'villages.']

export default function Scrollytelling({ lakes, exposure, onDetective, onMap }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const flow = useRef<SVGPathElement>(null)
  const [active, setActive] = useState(0)
  const [pts, setPts] = useState<Pt[] | null>(null)

  const infos = useMemo(() => lakeInfos(lakes), [lakes])

  const stats = useMemo(() => infos
    .filter(l => l.epochs.length >= 2)
    .map(l => {
      const a = l.epochs[0], b = l.epochs[l.epochs.length - 1]
      return { id: l.id, name: shortName(l.name), from: a.area, to: b.area, y0: a.year, y1: b.year, pct: Math.round((b.area / a.area - 1) * 100) }
    })
    .sort((x, y) => y.pct - x.pct)
    .slice(0, 3), [infos])

  const focus = useMemo(() => infos.find(l => l.id === 'tsho_rolpa') ?? infos[0] ?? null, [infos])

  const sites = useMemo<Site[]>(() => {
    if (!focus) return []
    const rows = exposure
      .filter(e => e.properties.lake_id === focus.id)
      .sort((a, b) => (a.properties.eta_minutes ?? 1e9) - (b.properties.eta_minutes ?? 1e9))
      .slice(0, 4)
    const dmax = Math.max(1, ...rows.map(r => r.properties.distance_km ?? 0))
    return rows.map((r, i) => ({
      name: shortName(r.properties.name),
      eta: r.properties.eta_minutes ?? null,
      f: r.properties.distance_km != null ? 0.12 + 0.8 * (r.properties.distance_km / dmax) : 0.2 + 0.2 * i,
    }))
  }, [exposure, focus])

  useLayoutEffect(() => {
    const p = flow.current
    if (!p) return
    const len = p.getTotalLength()
    setPts(sites.map(s => {
      const q = p.getPointAtLength(len * s.f)
      return { x: q.x, y: q.y }
    }))
  }, [sites])

  useLayoutEffect(() => {
    if (reducedMotion() || !root.current) return
    const ctx = gsap.context(() => {
      gsap.from('.hero-word', { yPercent: 110, duration: 1.1, ease: 'power4.out', stagger: 0.09, delay: 0.25 })
      gsap.from('[data-hero-sub]', { autoAlpha: 0, y: 14, duration: 0.9, ease: 'power2.out', delay: 1.05 })
    }, root)
    return () => ctx.revert()
  }, [])

  useLayoutEffect(() => {
    if (!pts || !root.current || !scroller.current || !track.current) return
    const still = reducedMotion()
    const ctx = gsap.context(() => {
      const beat = (i: number) => `[data-beat="${i}"]`

      gsap.set([beat(1), beat(2), beat(3), beat(4)], { autoAlpha: 0 })
      gsap.set('#water', { attr: { y: WATER_LOW } })
      gsap.set('#glacier', { transformOrigin: '0% 60%' })
      gsap.set('#breach', { transformOrigin: '50% 0%', scaleY: 0 })
      gsap.set('.site', { autoAlpha: 0 })
      gsap.set('.site-label', { autoAlpha: 0 })

      const counters = gsap.utils.toArray<HTMLElement>('[data-count]').map(el => ({
        el, to: Number(el.dataset.to), from: Number(el.dataset.from), pct: el.dataset.kind === 'pct',
      }))
      counters.forEach(c => { c.el.textContent = c.pct ? '0' : c.from.toFixed(2) })

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: track.current,
          scroller: scroller.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: still ? true : 0.7,
          onUpdate: self => setActive(beatAt(self.progress * TOTAL)),
        },
      })

      tl.to('#far', { y: -28, duration: TOTAL }, 0)
      tl.to('#mid', { y: -52, duration: TOTAL }, 0)
      tl.to('[data-cue]', { autoAlpha: 0, duration: 0.3 }, 0.1)

      tl.to(beat(0), { autoAlpha: 0, y: -28, duration: 0.45 }, 0.9)
      tl.fromTo(beat(1), { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 1.4)
      tl.to('#glacier', { scaleX: 0.6, scaleY: 0.92, duration: 2.6 }, 1.4)
      tl.to('#streams path', { strokeDashoffset: 0, duration: 1.4, stagger: 0.25 }, 1.5)
      tl.to('#water', { attr: { y: WATER_HIGH }, duration: 2.6 }, 1.4)
      counters.forEach(c => {
        const o = { v: 0 }
        tl.to(o, {
          v: 1, duration: 2.2,
          onUpdate: () => {
            c.el.textContent = c.pct ? String(Math.round(c.to * o.v)) : (c.from + (c.to - c.from) * o.v).toFixed(2)
          },
        }, 1.6)
      })

      tl.to(beat(1), { autoAlpha: 0, y: -28, duration: 0.4 }, 3.9)
      tl.fromTo(beat(2), { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 4.4)
      tl.to('#dam-glow', { opacity: 1, duration: 0.6 }, 4.4)
      tl.to('#water', { attr: { y: WATER_MAX }, duration: 1.6 }, 4.4)
      tl.to('#cracks path', { strokeDashoffset: 0, duration: 0.7, stagger: 0.25 }, 5.1)

      tl.to('#breach', { scaleY: 1, duration: 0.8 }, 6.0)
      tl.to(beat(2), { autoAlpha: 0, y: -28, duration: 0.4 }, 6.1)
      tl.to('#dam-glow', { opacity: 0, duration: 0.5 }, 6.2)
      tl.fromTo(beat(3), { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 6.7)
      tl.to('#water', { attr: { y: WATER_LOW + 60 }, duration: 3, ease: 'power1.in' }, 6.3)
      tl.to('.site', { autoAlpha: 0.4, duration: 0.4 }, 6.3)
      tl.to('#flood', { strokeDashoffset: 0, duration: 2.4 }, 6.6)
      tl.to('#flood-glow', { strokeDashoffset: 0, duration: 2.4 }, 6.6)

      sites.forEach((s, i) => {
        const at = 6.6 + s.f * 2.4
        tl.to(`[data-site="${i}"]`, { autoAlpha: 1, duration: 0.2 }, at)
        tl.to(`[data-dot="${i}"]`, { attr: { fill: FLOOD }, scale: 1.35, transformOrigin: '50% 50%', duration: 0.2 }, at)
        tl.to(`[data-label="${i}"]`, { autoAlpha: 1, duration: 0.25 }, at)
      })

      tl.to(beat(3), { autoAlpha: 0, y: -28, duration: 0.4 }, 9.1)
      tl.fromTo(beat(4), { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 9.4)
      tl.to({}, { duration: 0.1 }, TOTAL - 0.1)
    }, root)
    return () => ctx.revert()
  }, [pts, stats, sites])

  const first = sites[0]

  return (
    <div ref={scroller} className="fixed inset-0 z-40 overflow-y-auto bg-abyss">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-4 sm:px-14">
        <span className="font-serif text-2xl">GlacierWatch</span>
        <button className="btn btn-quiet pointer-events-auto bg-abyss/50 backdrop-blur" onClick={onMap}>Skip to the map</button>
      </header>

      <div ref={track} style={{ height: '620vh' }}>
        <div ref={root} className="sticky top-0 h-screen overflow-hidden">
          <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#06141d" />
                <stop offset="0.55" stopColor="#0f3547" />
                <stop offset="1" stopColor="#2c6f86" />
              </linearGradient>
              <linearGradient id="ice" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f2fbfd" />
                <stop offset="1" stopColor="#a8dcea" />
              </linearGradient>
              <linearGradient id="lakeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4fc3de" />
                <stop offset="1" stopColor="#1b6f8a" />
              </linearGradient>
              <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="9" />
              </filter>
            </defs>

            <rect width="1440" height="800" fill="url(#sky)" />

            <g id="far">
              <path d="M0 470 L90 330 L150 390 L260 250 L340 350 L430 300 L520 390 L640 270 L730 360 L840 300 L960 400 L1060 280 L1160 370 L1280 260 L1360 340 L1440 300 L1440 800 L0 800 Z" fill="#14455a" opacity="0.75" />
              <path d="M260 250 L226 292 L262 280 L292 304 Z M640 270 L610 308 L640 298 L670 316 Z M1060 280 L1030 322 L1062 308 L1092 330 Z M1280 260 L1250 300 L1282 288 L1310 312 Z" fill="#d7eef5" opacity="0.8" />
            </g>
            <g id="mid">
              <path d="M0 560 L120 470 L220 520 L330 430 L420 500 L560 470 L700 530 L820 480 L930 520 L1060 450 L1180 520 L1300 470 L1440 540 L1440 800 L0 800 Z" fill="#0d2f40" />
            </g>

            <rect id="water" x="300" y={WATER_LOW} width="680" height="300" fill="url(#lakeFill)" />

            <path
              d="M0 800 L0 560 L200 500 L340 430 L380 520 L470 585 L640 610 L800 590 L860 520 L905 450 L960 430 L1010 455 L1100 520 L1220 580 L1340 620 L1440 640 L1440 800 Z"
              fill="#0a2230"
            />
            <path d="M860 520 L905 450 L960 430 L1010 455 L1060 500 L1010 530 Z" fill="#274554" />
            <path id="dam-glow" d="M860 520 L905 450 L960 430 L1010 455 L1060 500" fill="none" stroke="#ffb27a" strokeWidth="5" strokeLinejoin="round" opacity="0" />
            <g id="cracks" fill="none" stroke="#ff7a4d" strokeWidth="3" strokeLinecap="round">
              <path d="M935 438 L928 468 L940 490 L930 515" pathLength="1" strokeDasharray="1" strokeDashoffset="1" />
              <path d="M968 436 L976 462 L964 484" pathLength="1" strokeDasharray="1" strokeDashoffset="1" />
              <path d="M898 470 L912 492 L904 512" pathLength="1" strokeDasharray="1" strokeDashoffset="1" />
            </g>
            <path id="breach" d="M932 440 L990 446 L1004 502 L918 504 Z" fill="#59c8e2" />

            <path id="glacier" d="M0 360 L120 330 L260 350 L340 420 L330 440 L200 500 L0 560 Z" fill="url(#ice)" />
            <g id="streams" fill="none" stroke="#8fe0f0" strokeWidth="3" strokeLinecap="round">
              <path d="M338 438 Q350 500 392 566" pathLength="1" strokeDasharray="1" strokeDashoffset="1" />
              <path d="M300 462 Q318 520 360 560" pathLength="1" strokeDasharray="1" strokeDashoffset="1" />
            </g>

            <path ref={flow} d={FLOW} fill="none" stroke="none" />
            <path id="flood-glow" d={FLOW} fill="none" stroke={FLOOD} strokeWidth="34" strokeLinecap="round" opacity="0.55" filter="url(#blur)" pathLength="1" strokeDasharray="1" strokeDashoffset="1" />
            <path id="flood" d={FLOW} fill="none" stroke={FLOOD} strokeWidth="13" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset="1" />

            {sites.map((s, i) => {
              const p = pts?.[i]
              if (!p) return null
              const above = i % 2 === 0
              const end = p.x > 1250
              return (
                <g key={`${s.name}-${i}`} className="site" data-site={i}>
                  <circle cx={p.x} cy={p.y} r="14" fill="none" stroke={FLOOD} strokeWidth="2" opacity="0.6" />
                  <circle data-dot={i} cx={p.x} cy={p.y} r="8" fill="#e9f2f3" stroke="#07161f" strokeWidth="2.5" />
                  <g className="site-label" data-label={i}>
                    <text
                      x={end ? p.x - 4 : p.x} y={above ? p.y - 44 : p.y + 52}
                      textAnchor={end ? 'end' : 'middle'}
                      className="fill-ink font-sans"
                      style={{ fontSize: 20, fontWeight: 600, paintOrder: 'stroke', stroke: '#07161f', strokeWidth: 5, strokeLinejoin: 'round' }}
                    >
                      {s.name}
                    </text>
                    {s.eta != null && (
                      <text
                        x={end ? p.x - 4 : p.x} y={above ? p.y - 20 : p.y + 76}
                        textAnchor={end ? 'end' : 'middle'}
                        style={{ fontSize: 24, fontWeight: 700, fill: '#ff9a7e', paintOrder: 'stroke', stroke: '#07161f', strokeWidth: 5, strokeLinejoin: 'round', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {fmtEta(s.eta)}
                      </text>
                    )}
                  </g>
                </g>
              )
            })}
          </svg>

          <div className="pointer-events-none absolute inset-x-0 top-0 h-[62%] bg-gradient-to-b from-abyss/85 via-abyss/45 to-transparent" />

          <div className="pointer-events-none absolute inset-0">
            <div data-beat="0" className="absolute left-6 right-6 top-[14vh] max-w-[56rem] sm:left-14 sm:right-14">
              <h1 className="display text-[clamp(2.8rem,7.2vw,6.6rem)]">
                {HERO.map((w, i) => (
                  <span key={i} className="mr-[0.22em] inline-block overflow-hidden align-bottom">
                    <span className="hero-word inline-block">{w}</span>
                  </span>
                ))}
              </h1>
              <p data-hero-sub className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink/85">
                High in Nepal's Himalaya, melting glaciers feed lakes that are held back by nothing more than a wall of loose rock and ice.
              </p>
            </div>

            <div data-beat="1" className="absolute left-6 right-6 top-[14vh] max-w-[60rem] sm:left-14 sm:right-14">
              <h2 className="display text-[clamp(2.2rem,5vw,4.4rem)]">Warmer air means more water.</h2>
              <ul className="mt-6 grid max-w-[46rem] grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
                {stats.map(s => (
                  <li key={s.id} className="border-l-2 border-glacier pl-3">
                    <p className="text-sm text-ink/80">{s.name}, {s.y0} to {s.y1}</p>
                    <p className="num text-2xl font-semibold">
                      <span data-count data-from={s.from} data-to={s.to} />
                      <span className="mx-1 text-ink-2">to</span>
                      {s.to.toFixed(2)} <span className="text-base font-medium text-ink-2">km²</span>
                    </p>
                    <p className="num text-sm font-semibold text-glacier">
                      +<span data-count data-kind="pct" data-to={s.pct} />% larger
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div data-beat="2" className="absolute left-6 right-6 top-[14vh] max-w-[44rem] sm:left-14 sm:right-14">
              <h2 className="display text-[clamp(2.2rem,5vw,4.4rem)]">The wall holds, until it doesn't.</h2>
              <ul className="bullets mt-5 text-lg text-ink/90">
                <li>The dam is moraine, rubble the glacier left behind as it retreated.</li>
                <li>Ice or rock falling into the lake can send a wave over the top.</li>
                <li>Rising water cuts into the loose material from the inside.</li>
              </ul>
            </div>

            <div data-beat="3" className="absolute left-6 right-6 top-[14vh] max-w-[44rem] sm:left-14 sm:right-14">
              <h2 className="display text-[clamp(2.2rem,5vw,4.4rem)]">Then the clock starts.</h2>
              <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink/90">
                {first && first.eta != null && focus
                  ? `If the dam at ${focus.name} failed completely, ${first.name} would have about ${first.eta} minutes. Every site downstream gets less warning the closer it sits to the lake.`
                  : 'Every site downstream gets less warning the closer it sits to the lake.'}
              </p>
            </div>

            <div data-beat="4" className="pointer-events-auto absolute left-6 right-6 top-[14vh] max-w-[44rem] sm:left-14 sm:right-14">
              <h2 className="display text-[clamp(2.2rem,5vw,4.4rem)]">Those minutes can be used well.</h2>
              <ul className="bullets mt-5 text-lg text-ink/90">
                <li>See which lakes are really warming, and which are not.</li>
                <li>Run a warming scenario and watch the flood reach further.</li>
                <li>Read what officials should do at each risk level.</li>
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <button className="btn btn-flood" onClick={onDetective}>Check the climate record<ArrowRight size={16} /></button>
                <button className="btn btn-quiet bg-abyss/50 backdrop-blur" onClick={onMap}><MapIcon size={16} />Open the flood map</button>
              </div>
            </div>
          </div>

          <p data-cue className="pointer-events-none absolute bottom-8 left-6 text-sm text-ink/80 sm:left-14">Scroll to follow the water</p>

          <ol className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 gap-3 sm:grid" aria-hidden="true">
            {Array.from({ length: BEATS }, (_, i) => (
              <li key={i} className={`h-8 w-0.5 rounded transition-colors duration-300 ${i === active ? 'bg-moraine' : 'bg-ink/25'}`} />
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
