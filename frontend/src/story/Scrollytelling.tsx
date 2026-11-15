import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Map as MapIcon } from 'lucide-react'
import type { ExposureFeature, LakeFeature } from '../types'
import { lakeInfos } from '../detective/lakeInfo'
import { gsap, SplitText, reducedMotion } from '../lib/motion'

interface Props {
  lakes: LakeFeature[]
  exposure: ExposureFeature[]
  onDetective: () => void
  onMap: () => void
}

interface Site { name: string; eta: number | null; f: number }
interface Pt { x: number; y: number }

const CHAPTERS = ['Opening', 'Warming', 'The wall', 'The clock', 'The record', 'Act']
const TOTAL = 18
const FLOW = 'M 958 452 C 1040 492, 1090 530, 1160 548 S 1290 590, 1380 640'
const WATER_LOW = 548
const WATER_HIGH = 452
const WATER_MAX = 446
const FLOOD = '#ff5a3c'

const AT_RISK = [
  { name: 'Imja Tsho', people: 96767 },
  { name: 'Tsho Rolpa', people: 141911 },
  { name: 'Thulagi Lake', people: 165068 },
]

const LADDER = [
  { name: 'Imja Tsho', elev: 5010, x: 880 },
  { name: 'Tsho Rolpa', elev: 4580, x: 1070 },
  { name: 'Thulagi Lake', elev: 4044, x: 1260 },
]
const ladderY = (elev: number) => 760 - (elev - 3800) * 0.3

const shortName = (n: string) => n.replace(/\s*\(.*\)/, '').split(' ').slice(0, 2).join(' ')
const fmtEta = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`)
const beatAt = (t: number) => {
  const marks = [1.4, 5.2, 8.4, 12.2, 16]
  let i = 0
  while (i < marks.length && t >= marks[i]) i++
  return i
}

const textOutline = { paintOrder: 'stroke', stroke: '#050f16', strokeWidth: 5, strokeLinejoin: 'round' } as const

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
    if (!root.current) return
    const still = reducedMotion()
    const ctx = gsap.context(() => {
      if (still) return
      const heroSplit = SplitText.create('[data-hero-title]', { type: 'lines', mask: 'lines' })
      const intro = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.2 })
      intro
        .from('[data-header]', { autoAlpha: 0, y: -16, duration: 1 })
        .from(heroSplit.lines, { yPercent: 115, duration: 1.4, stagger: 0.14 }, 0.1)
        .from('[data-hero-sub]', { autoAlpha: 0, y: 18, duration: 1.1 }, 0.8)
        .from('[data-cue]', { autoAlpha: 0, duration: 1 }, 1.3)
      gsap.to('[data-cue-arrow]', { y: 8, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut' })

      const toFar = gsap.quickTo('#far', 'x', { duration: 1.4, ease: 'power3.out' })
      const toMid = gsap.quickTo('#mid', 'x', { duration: 1.1, ease: 'power3.out' })
      const move = (e: PointerEvent) => {
        const k = e.clientX / window.innerWidth - 0.5
        toFar(k * -26)
        toMid(k * -44)
      }
      window.addEventListener('pointermove', move)
      return () => window.removeEventListener('pointermove', move)
    }, root)
    return () => ctx.revert()
  }, [])

  useLayoutEffect(() => {
    if (!pts || !root.current || !scroller.current || !track.current) return
    const still = reducedMotion()
    const ctx = gsap.context(() => {
      const beat = (i: number) => `[data-beat="${i}"]`

      gsap.set([beat(1), beat(2), beat(3), beat(4), beat(5)], { autoAlpha: 0 })
      gsap.set('#water', { attr: { y: WATER_LOW } })
      gsap.set('#glacier', { transformOrigin: '0% 60%' })
      gsap.set('#breach', { transformOrigin: '50% 0%', scaleY: 0 })
      gsap.set('.site, .site-label, #ladder', { autoAlpha: 0 })

      const counters = gsap.utils.toArray<HTMLElement>('[data-count]').map(el => ({
        el,
        to: Number(el.dataset.to),
        from: Number(el.dataset.from ?? 0),
        kind: el.dataset.kind ?? 'area',
      }))
      const fmt = (kind: string, v: number) =>
        kind === 'area' ? v.toFixed(2) : Math.round(v).toLocaleString('en-US')
      counters.forEach(c => { c.el.textContent = fmt(c.kind, c.from) })

      const splits = new Map<number, SplitText>()
      ;[1, 2, 3, 4, 5].forEach(i => {
        const h = document.querySelector<HTMLElement>(`${beat(i)} [data-split]`)
        if (h && !still) splits.set(i, SplitText.create(h, { type: 'lines', mask: 'lines' }))
      })

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: track.current,
          scroller: scroller.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: still ? true : 1,
          onUpdate: self => setActive(beatAt(self.progress * TOTAL)),
        },
      })

      const enter = (i: number, at: number) => {
        tl.fromTo(beat(i), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'power1.out' }, at)
        const s = splits.get(i)
        if (s) tl.fromTo(s.lines, { yPercent: 110 }, { yPercent: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' }, at)
        tl.fromTo(`${beat(i)} [data-rise]`, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.14, ease: 'power3.out' }, at + 0.3)
      }
      const leave = (i: number, at: number) => {
        tl.to(beat(i), { autoAlpha: 0, y: -30, duration: 0.5, ease: 'power2.in' }, at)
        tl.set(beat(i), { y: 0 }, at + 0.55)
      }

      tl.to('#far', { y: -34, duration: TOTAL }, 0)
      tl.to('#mid', { y: -64, duration: TOTAL }, 0)
      tl.to('[data-cue]', { autoAlpha: 0, duration: 0.3 }, 0.1)
      tl.to('#sun', { attr: { cy: 150, r: 130 }, duration: 6 }, 0)

      leave(0, 0.9)

      enter(1, 1.5)
      tl.to('#glacier', { scaleX: 0.6, scaleY: 0.92, duration: 3 }, 1.5)
      tl.to('#streams path', { strokeDashoffset: 0, duration: 1.4, stagger: 0.25 }, 1.6)
      tl.to('#water', { attr: { y: WATER_HIGH }, duration: 3 }, 1.5)
      counters.filter(c => c.el.dataset.group === 'growth').forEach(c => {
        const o = { v: 0 }
        tl.to(o, { v: 1, duration: 2.6, ease: 'power2.out', onUpdate: () => { c.el.textContent = fmt(c.kind, c.from + (c.to - c.from) * o.v) } }, 1.8)
      })
      leave(1, 4.6)

      enter(2, 5.3)
      tl.to('#dam-glow', { opacity: 1, duration: 0.6 }, 5.3)
      tl.to('#water', { attr: { y: WATER_MAX }, duration: 1.6 }, 5.3)
      tl.to('#cracks path', { strokeDashoffset: 0, duration: 0.8, stagger: 0.25 }, 6)
      tl.to('#breach', { scaleY: 1, duration: 0.8 }, 6.9)
      leave(2, 7.6)
      tl.to('#dam-glow', { opacity: 0, duration: 0.5 }, 7.2)

      enter(3, 8.4)
      tl.to('#water', { attr: { y: WATER_LOW + 60 }, duration: 3.6, ease: 'power1.in' }, 7.2)
      tl.to('.site', { autoAlpha: 0.4, duration: 0.4 }, 7.4)
      tl.to('#flood', { strokeDashoffset: 0, duration: 2.6 }, 7.8)
      tl.to('#flood-glow', { strokeDashoffset: 0, duration: 2.6 }, 7.8)
      sites.forEach((s, i) => {
        const at = 7.8 + s.f * 2.6
        tl.to(`[data-site="${i}"]`, { autoAlpha: 1, duration: 0.2 }, at)
        tl.to(`[data-dot="${i}"]`, { attr: { fill: FLOOD }, scale: 1.35, transformOrigin: '50% 50%', duration: 0.2 }, at)
        tl.to(`[data-label="${i}"]`, { autoAlpha: 1, duration: 0.25 }, at)
      })
      counters.filter(c => c.el.dataset.group === 'people').forEach(c => {
        const o = { v: 0 }
        tl.to(o, { v: 1, duration: 2.4, ease: 'power2.out', onUpdate: () => { c.el.textContent = fmt(c.kind, c.from + (c.to - c.from) * o.v) } }, 9)
      })
      leave(3, 11.6)

      tl.to('#world', { opacity: 0.12, duration: 1.2 }, 11.9)
      tl.to('#ladder', { autoAlpha: 1, duration: 0.6 }, 12.4)
      tl.fromTo('#ladder [data-rung]', { scaleY: 0 }, { scaleY: 1, transformOrigin: '50% 100%', duration: 1.4, stagger: 0.25, ease: 'power3.out' }, 12.5)
      tl.fromTo('#ladder [data-tag]', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.25, ease: 'power2.out' }, 13.1)
      enter(4, 12.4)
      leave(4, 15.4)
      tl.to('#ladder', { autoAlpha: 0, duration: 0.6 }, 15.5)
      tl.to('#world', { opacity: 1, duration: 1.2 }, 15.6)

      enter(5, 16.2)
      tl.to({}, { duration: 0.1 }, TOTAL - 0.1)
    }, root)
    return () => ctx.revert()
  }, [pts, stats, sites])

  const first = sites[0]

  return (
    <div ref={scroller} className="fixed inset-0 z-40 overflow-y-auto bg-abyss">
      <header data-header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-14">
        <span className="font-serif text-2xl tracking-tight">GlacierWatch</span>
        <button className="btn btn-quiet pointer-events-auto bg-abyss/40 backdrop-blur-md" onClick={onMap}>Skip to the map<ArrowRight size={14} /></button>
      </header>

      <div ref={track} style={{ height: '900vh' }}>
        <div ref={root} className="grain sticky top-0 h-screen overflow-hidden">
          <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#040c13" />
                <stop offset="0.5" stopColor="#0c2f40" />
                <stop offset="1" stopColor="#2c6f86" />
              </linearGradient>
              <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#ffd9b0" stopOpacity="0.5" />
                <stop offset="1" stopColor="#ffd9b0" stopOpacity="0" />
              </radialGradient>
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
            <circle id="sun" cx="1120" cy="250" r="190" fill="url(#sunGlow)" />

            <g id="far">
              <path d="M-40 470 L90 330 L150 390 L260 250 L340 350 L430 300 L520 390 L640 270 L730 360 L840 300 L960 400 L1060 280 L1160 370 L1280 260 L1360 340 L1480 300 L1480 800 L-40 800 Z" fill="#14455a" opacity="0.75" />
              <path d="M260 250 L226 292 L262 280 L292 304 Z M640 270 L610 308 L640 298 L670 316 Z M1060 280 L1030 322 L1062 308 L1092 330 Z M1280 260 L1250 300 L1282 288 L1310 312 Z" fill="#d7eef5" opacity="0.8" />
            </g>
            <g id="mid">
              <path d="M-40 560 L120 470 L220 520 L330 430 L420 500 L560 470 L700 530 L820 480 L930 520 L1060 450 L1180 520 L1300 470 L1480 540 L1480 800 L-40 800 Z" fill="#0d2f40" />
            </g>

            <g id="world">
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
                    <circle data-dot={i} cx={p.x} cy={p.y} r="8" fill="#e9f2f3" stroke="#050f16" strokeWidth="2.5" />
                    <g className="site-label" data-label={i}>
                      <text x={end ? p.x - 4 : p.x} y={above ? p.y - 44 : p.y + 52} textAnchor={end ? 'end' : 'middle'}
                        className="fill-ink font-sans" style={{ fontSize: 20, fontWeight: 600, ...textOutline }}>
                        {s.name}
                      </text>
                      {s.eta != null && (
                        <text x={end ? p.x - 4 : p.x} y={above ? p.y - 20 : p.y + 76} textAnchor={end ? 'end' : 'middle'}
                          style={{ fontSize: 24, fontWeight: 700, fill: '#ff9a7e', fontVariantNumeric: 'tabular-nums', ...textOutline }}>
                          {fmtEta(s.eta)}
                        </text>
                      )}
                    </g>
                  </g>
                )
              })}
            </g>

            <g id="ladder">
              <line x1="800" y1="760" x2="1340" y2="760" stroke="#6fd0e6" strokeOpacity="0.35" strokeWidth="1.5" />
              {LADDER.map(l => {
                const y = ladderY(l.elev)
                return (
                  <g key={l.name}>
                    <line data-rung x1={l.x} y1="760" x2={l.x} y2={y} stroke="#6fd0e6" strokeWidth="2" />
                    <g data-tag>
                      <circle cx={l.x} cy={y} r="8" fill="#050f16" stroke="#6fd0e6" strokeWidth="2.5" />
                      <text x={l.x} y={y - 46} textAnchor="middle" style={{ fontSize: 30, fontWeight: 700, fill: '#eaf3f4', fontVariantNumeric: 'tabular-nums', ...textOutline }}>
                        {l.elev.toLocaleString('en-US')} m
                      </text>
                      <text x={l.x} y={y - 20} textAnchor="middle" style={{ fontSize: 18, fontWeight: 500, fill: '#a6e4f3', ...textOutline }}>
                        {l.name}
                      </text>
                    </g>
                  </g>
                )
              })}
            </g>
          </svg>

          <div className="pointer-events-none absolute inset-x-0 top-0 h-[66%] bg-gradient-to-b from-abyss/90 via-abyss/50 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[55%] bg-gradient-to-r from-abyss/55 to-transparent max-sm:hidden" />

          <div className="pointer-events-none absolute inset-0">
            <div data-beat="0" className="absolute left-6 right-6 top-[15vh] max-w-[60rem] sm:left-14 sm:right-14">
              <p className="eyebrow mb-5">Earth Ecosystem Trend Detective · Nepal Himalaya</p>
              <h1 data-hero-title className="display text-[clamp(3rem,7.6vw,7rem)]">Lakes are filling above the villages.</h1>
              <p data-hero-sub className="lede mt-7 max-w-[34rem] text-lg leading-relaxed text-ink/80">
                High in Nepal's Himalaya, melting glaciers feed lakes held back by nothing more than a wall of loose rock and ice. Satellites have been watching them for more than thirty years.
              </p>
            </div>

            <div data-beat="1" className="absolute left-6 right-6 top-[15vh] max-w-[60rem] sm:left-14 sm:right-14">
              <p data-rise className="eyebrow mb-4">01 · Warming</p>
              <h2 data-split className="display text-[clamp(2.4rem,5.2vw,4.6rem)]">Warmer air means more water.</h2>
              <ul className="mt-8 grid max-w-[46rem] grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-3">
                {stats.map(s => (
                  <li key={s.id} data-rise className="border-t border-glacier/40 pt-3">
                    <p className="text-sm text-ink/70">{s.name}, {s.y0} to {s.y1}</p>
                    <p className="num mt-1 text-2xl font-semibold">
                      <span data-count data-group="growth" data-from={s.from} data-to={s.to} />
                      <span className="mx-1.5 text-ink-2">→</span>
                      {s.to.toFixed(2)} <span className="text-base font-medium text-ink-2">km²</span>
                    </p>
                    <p className="num text-sm font-semibold text-glacier">
                      +<span data-count data-group="growth" data-kind="pct" data-to={s.pct} />% larger
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div data-beat="2" className="absolute left-6 right-6 top-[15vh] max-w-[46rem] sm:left-14 sm:right-14">
              <p data-rise className="eyebrow mb-4">02 · The wall</p>
              <h2 data-split className="display text-[clamp(2.4rem,5.2vw,4.6rem)]">The wall holds, until it doesn't.</h2>
              <ul className="bullets mt-7 max-w-[36rem] text-lg text-ink/90">
                <li data-rise>The dam is moraine, rubble the glacier left behind as it retreated.</li>
                <li data-rise>Ice or rock falling into the lake can send a wave over the top.</li>
                <li data-rise>Rising water cuts into the loose material from the inside.</li>
              </ul>
            </div>

            <div data-beat="3" className="absolute left-6 right-6 top-[15vh] grid max-w-[72rem] gap-10 sm:left-14 sm:right-14 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div>
                <p data-rise className="eyebrow mb-4">03 · The clock</p>
                <h2 data-split className="display text-[clamp(2.4rem,5.2vw,4.6rem)]">Then the clock starts.</h2>
                <p data-rise className="lede mt-6 max-w-[32rem] text-lg leading-relaxed text-ink/90">
                  {first && first.eta != null && focus
                    ? `If the dam at ${focus.name} failed completely, ${first.name} would have about ${first.eta} minutes. Every site downstream gets less warning the closer it sits to the lake.`
                    : 'Every site downstream gets less warning the closer it sits to the lake.'}
                </p>
              </div>
              <div data-rise className="panel self-start p-5 max-lg:hidden">
                <p className="eyebrow">People likely affected by lost resources</p>
                <ul className="mt-4 divide-y divide-rule/70">
                  {AT_RISK.map(r => (
                    <li key={r.name} className="flex items-baseline justify-between py-3">
                      <span className="text-sm text-ink/80">{r.name}</span>
                      <span className="num text-2xl font-semibold"><span data-count data-group="people" data-kind="int" data-to={r.people} /></span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-ink-2">Estimated for glacial lake outburst floods. Source: ICIMOD 2011.</p>
              </div>
            </div>

            <div data-beat="4" className="absolute left-6 right-6 top-[15vh] max-w-[34rem] sm:left-14 sm:right-auto">
              <p data-rise className="eyebrow mb-4">04 · The record</p>
              <h2 data-split className="display text-[clamp(2.4rem,5vw,4.4rem)]">No two lakes share a calendar.</h2>
              <p data-rise className="lede mt-6 text-base leading-relaxed text-ink/85">
                Imja Tsho lies at 5,010 m beneath the Lhotse face. Thulagi lies at 4,044 m. Freeze-up dates and the angle of mountain cast shadows differ by weeks, so one fixed date would blind the satellite at some lakes.
              </p>
              <ul className="bullets mt-5 text-base text-ink/90">
                <li data-rise>An adaptive candidate ranking engine scans multi-pass orbital windows for every lake.</li>
                <li data-rise>It favours the cleanest post-monsoon passes and drops frozen or shadowed ones.</li>
                <li data-rise>The result is the true liquid water surface, measured before freeze-over.</li>
              </ul>
            </div>

            <div data-beat="5" className="pointer-events-auto absolute left-6 right-6 top-[15vh] max-w-[46rem] sm:left-14 sm:right-14">
              <p data-rise className="eyebrow mb-4">05 · Act</p>
              <h2 data-split className="display text-[clamp(2.4rem,5.2vw,4.6rem)]">Those minutes can be used well.</h2>
              <ul className="bullets mt-7 max-w-[36rem] text-lg text-ink/90">
                <li data-rise>See which lakes are really warming, and which are not.</li>
                <li data-rise>Run a warming scenario and watch the flood reach further.</li>
                <li data-rise>Read what officials should do at each risk level.</li>
              </ul>
              <div data-rise className="mt-9 flex flex-wrap gap-3">
                <button className="btn btn-flood" onClick={onDetective}>Check the climate record<ArrowRight size={15} /></button>
                <button className="btn btn-quiet bg-abyss/40 backdrop-blur-md" onClick={onMap}><MapIcon size={15} />Open the flood map</button>
              </div>
            </div>
          </div>

          <div data-cue className="pointer-events-none absolute bottom-8 left-6 flex items-center gap-3 text-sm text-ink/75 sm:left-14">
            <span data-cue-arrow className="inline-block">↓</span>
            Scroll to follow the water
          </div>

          <ol className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 gap-2.5 text-right sm:grid" aria-label="Chapters">
            {CHAPTERS.map((c, i) => (
              <li key={c} className={`text-[11px] uppercase tracking-[0.16em] transition-all duration-500 ${i === active ? 'translate-x-0 text-ink opacity-100' : 'translate-x-2 text-ink-2 opacity-40'}`}>
                {c}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
