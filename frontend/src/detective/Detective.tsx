import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Info, Map as MapIcon } from 'lucide-react'
import type { LakeFeature } from '../types'
import { getTrends } from '../lib/api'
import { useRemote } from '../hooks/useRemote'
import { STORIES, VARIABLES, type Story, type VarKey } from './content'
import { lakeInfos } from './lakeInfo'
import StoryRunner from './Story'
import Verdict from './Verdict'
import { Failed, Loading } from './Status'
import Glossary from '../components/Glossary'
import Credits from '../components/Credits'
import { useSplitReveal, useStagger } from '../lib/motion'

interface Props { lakes: LakeFeature[]; onOpenMap: (lakeId: string, delta?: number) => void; onClose: () => void }

const STEPS = ['Place', 'Variable', 'Verdict']

export default function Detective({ lakes, onOpenMap, onClose }: Props) {
  const infos = useMemo(() => lakeInfos(lakes), [lakes])
  const [step, setStep] = useState(1)
  const [lakeId, setLakeId] = useState<string | null>(null)
  const [varKey, setVarKey] = useState<VarKey>('t2m')
  const [story, setStory] = useState<Story | null>(null)
  const [beat, setBeat] = useState(0)
  const [modal, setModal] = useState<'glossary' | 'credits' | null>(null)

  const main = useRef<HTMLElement>(null)
  useStagger(main, '[data-reveal]', [step, story?.id, beat, lakeId], { y: 24, stagger: 0.08, delay: 0.15 })
  useSplitReveal(main, [step, story?.id, beat, lakeId])

  const lake = infos.find(l => l.id === (story ? story.lakeId : lakeId)) ?? null

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-abyss" style={{ backgroundImage: 'radial-gradient(60rem 28rem at 88% -8%, rgba(111,208,230,0.13), transparent 70%), radial-gradient(40rem 24rem at 0% 100%, rgba(255,106,69,0.06), transparent 70%)' }}>
      <header className="sticky top-0 z-10 border-b border-white/5 bg-abyss/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div className="flex items-baseline gap-3">
            <span className="display text-3xl">GlacierWatch</span>
            <span className="eyebrow hidden sm:inline">Data Detective</span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <button className="btn btn-quiet border-transparent text-ink-2 hover:text-ink" onClick={() => setModal('glossary')}><BookOpen size={15} />Glossary</button>
            <button className="btn btn-quiet border-transparent text-ink-2 hover:text-ink" onClick={() => setModal('credits')}><Info size={15} />Data and credits</button>
            <button className="btn ml-2" onClick={onClose}><MapIcon size={15} />Go to the map</button>
          </nav>
        </div>
      </header>

      <main ref={main} className="mx-auto max-w-5xl px-5 pb-24 pt-10">
        {story && lake ? (
          <StoryRunner story={story} lake={lake} beat={beat} setBeat={setBeat} onExit={() => { setStory(null); setStep(1) }}
            onOpenMap={(id, d) => onOpenMap(id, d)} />
        ) : (
          <>
            <ol className="mb-12 flex gap-10 text-xs uppercase tracking-[0.16em]">
              {STEPS.map((s, i) => {
                const n = i + 1, reachable = n === 1 || (n === 2 && lakeId) || (n === 3 && lakeId)
                return (
                  <li key={s}>
                    <button disabled={!reachable} onClick={() => setStep(n)}
                      className={`border-t pt-3 transition-colors duration-300 disabled:cursor-default disabled:opacity-30 ${n === step ? 'border-glacier text-ink' : 'border-rule text-ink-2 hover:text-glacier'}`}>
                      <span className="num mr-2 text-glacier">{String(n).padStart(2, '0')}</span>{s}
                    </button>
                  </li>
                )
              })}
            </ol>

            {step === 1 && (
              <>
                <h1 data-split className="display mb-6 text-[clamp(2.6rem,6vw,4.8rem)]">Which lake do you want to look into?</h1>
                <ul data-reveal className="bullets mb-10 max-w-2xl text-ink-2">
                  <li>A glacial lake outburst flood happens when the wall holding a lake back fails.</li>
                  <li>The wall is usually loose rock and ice left behind by the glacier.</li>
                  <li>Pick a lake and we will check whether its climate is really changing.</li>
                </ul>
                <ul className="border-t border-rule">
                  {infos.map(l => {
                    const a = l.epochs[0], b = l.epochs[l.epochs.length - 1]
                    return (
                      <li key={l.id} data-reveal className="border-b border-rule">
                        <button onClick={() => { setLakeId(l.id); setStep(2) }} className="group flex w-full items-center justify-between gap-4 px-2 py-6 text-left transition-colors duration-300 hover:bg-paper-2/70">
                          <span>
                            <span className="display block text-3xl">{l.name}</span>
                            <span className="text-sm text-ink-2">{l.region}{l.elevation ? ` · ${l.elevation.toLocaleString()} m` : ''}</span>
                          </span>
                          <span className="flex items-center gap-4">
                            <span className="num hidden text-right text-sm sm:block"><span className="block">{a.area.toFixed(2)} → {b.area.toFixed(2)} km²</span><span className="block text-xs text-ink-2">{a.year} to {b.year}{a.area > 0 ? <span className="ml-2 font-semibold text-glacier">{b.area >= a.area ? '+' : ''}{Math.round((b.area / a.area - 1) * 100)}%</span> : null}</span></span>
                            <ArrowRight className="text-ink-2 transition-transform group-hover:translate-x-1" size={18} />
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <div data-reveal className="mt-14">
                  <p className="eyebrow mb-4">Or take a guided case</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {STORIES.map(s => (
                      <button key={s.id} onClick={() => { setStory(s); setBeat(0) }} className="panel p-6 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-glacier/40">
                        <span className="eyebrow">{s.kicker}</span>
                        <span className="display mb-1 mt-1 block text-3xl">{s.title}</span>
                        <span className="block text-sm text-ink-2">{s.intro}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === 2 && lake && (
              <>
                <p data-reveal className="eyebrow">{lake.name}</p>
                <h1 data-split className="display mb-4 text-[clamp(2.6rem,6vw,4.8rem)]">What do you want to measure?</h1>
                <ul data-reveal className="bullets mb-10 max-w-2xl text-ink-2"><li>Both come from NASA's POWER record, one value per day for 40 years.</li><li>Pick one and we will test it for a real trend.</li></ul>
                <div className="grid gap-4 md:grid-cols-2">
                  {(Object.keys(VARIABLES) as VarKey[]).map(k => {
                    const v = VARIABLES[k]
                    return (
                      <button key={k} data-reveal onClick={() => { setVarKey(k); setStep(3) }} className="panel group p-7 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-glacier/40">
                        <span className="num text-xs text-ink-2">{v.code}</span>
                        <span className="display mb-2 block text-4xl">{v.name}</span>
                        <span className="mb-3 block">{v.plain}</span>
                        <span className="block text-sm text-ink-2">{v.why}</span>
                        <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-glacier">Test it <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
                      </button>
                    )
                  })}
                </div>
                <button className="btn btn-quiet mt-8" onClick={() => setStep(1)}><ArrowLeft size={16} />Pick another lake</button>
              </>
            )}

            {step === 3 && lake && <VerdictStep lakeId={lake.id} lakeName={lake.name} varKey={varKey} setVarKey={setVarKey}
              onBack={() => setStep(2)} onOpenMap={() => onOpenMap(lake.id)} />}
          </>
        )}
      </main>

      {modal === 'glossary' && <Glossary onClose={() => setModal(null)} />}
      {modal === 'credits' && <Credits onClose={() => setModal(null)} />}
    </div>
  )
}

function VerdictStep({ lakeId, lakeName, varKey, setVarKey, onBack, onOpenMap }:
  { lakeId: string; lakeName: string; varKey: VarKey; setVarKey: (k: VarKey) => void; onBack: () => void; onOpenMap: () => void }) {
  const t = useRemote(s => getTrends(lakeId, s), [lakeId])
  const other: VarKey = varKey === 't2m' ? 'precip' : 't2m'
  return (
    <>
      <p className="eyebrow mb-3">{lakeName} · {VARIABLES[varKey].name.toLowerCase()}</p>
      {t.loading && <Loading what="the NASA POWER record" />}
      {t.error && <Failed message={t.error} />}
      {t.data && <Verdict v={VARIABLES[varKey]} stat={t.data[varKey]} lakeName={lakeName} />}
      <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
        <button className="btn btn-quiet" onClick={onBack}><ArrowLeft size={16} />Change variable</button>
        <button className="btn btn-quiet" onClick={() => setVarKey(other)}>Check {VARIABLES[other].name.toLowerCase()} instead</button>
        <button className="btn ml-auto" onClick={onOpenMap}><MapIcon size={16} />See this lake on the 3D map</button>
      </div>
    </>
  )
}
