import { ArrowLeft, ArrowRight, Map as MapIcon } from 'lucide-react'
import { getExposure, getTrends } from '../lib/api'
import { useRemote } from '../hooks/useRemote'
import { VARIABLES, type Story } from './content'
import type { LakeInfo } from './lakeInfo'
import LakeFacts from './LakeFacts'
import Verdict from './Verdict'
import EtaTable from '../components/EtaTable'
import { Failed, Loading } from './Status'

const BEATS = ['The lake', 'The climate record', 'Who is downstream']

interface Props { story: Story; lake: LakeInfo; beat: number; setBeat: (b: number) => void; onExit: () => void; onOpenMap: (lakeId: string, delta: number) => void }

export default function StoryRunner({ story, lake, beat, setBeat, onExit, onOpenMap }: Props) {
  return (
    <div>
      <p className="eyebrow">{story.kicker}</p>
      <h1 className="mb-1 font-serif text-4xl">{story.title}</h1>
      <ol className="mb-8 mt-4 flex gap-6 border-b border-rule text-sm">
        {BEATS.map((b, i) => (
          <li key={b}>
            <button onClick={() => setBeat(i)} className={`-mb-px border-b-2 pb-2 ${i === beat ? 'border-ink font-semibold' : 'border-transparent text-ink-2 hover:text-ink'}`}>
              <span className="num mr-1.5 text-xs">{i + 1}</span>{b}
            </button>
          </li>
        ))}
      </ol>

      {beat === 0 && (
        <div className="grid gap-10 md:grid-cols-2">
          <p className="font-serif text-xl leading-relaxed">{story.intro}</p>
          <LakeFacts lake={lake} />
        </div>
      )}
      {beat === 1 && <Climate story={story} lake={lake} />}
      {beat === 2 && <Downstream lake={lake} story={story} onOpenMap={onOpenMap} />}

      <div className="mt-10 flex items-center justify-between border-t border-rule pt-4">
        <button className="btn btn-quiet" onClick={beat === 0 ? onExit : () => setBeat(beat - 1)}><ArrowLeft size={16} />{beat === 0 ? 'All cases' : 'Back'}</button>
        {beat < 2 && <button className="btn" onClick={() => setBeat(beat + 1)}>{BEATS[beat + 1]}<ArrowRight size={16} /></button>}
      </div>
    </div>
  )
}

function Climate({ story, lake }: { story: Story; lake: LakeInfo }) {
  const t = useRemote(s => getTrends(lake.id, s), [lake.id])
  if (t.loading) return <Loading what="the NASA POWER record" />
  if (t.error || !t.data) return <Failed message={t.error ?? 'No data'} />
  return (
    <div className="space-y-12">
      {story.variables.map(k => <Verdict key={k} v={VARIABLES[k]} stat={t.data![k]} lakeName={lake.name} chartHeight={story.variables.length > 1 ? 250 : 320} />)}
    </div>
  )
}

function Downstream({ lake, story, onOpenMap }: { lake: LakeInfo; story: Story; onOpenMap: Props['onOpenMap'] }) {
  const e = useRemote(s => getExposure(lake.id, s), [lake.id])
  if (e.loading) return <Loading what="downstream sites" />
  if (e.error || !e.data) return <Failed message={e.error ?? 'No data'} />
  const first = e.data.assets[0]
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div>
        <h2 className="mb-2 font-serif text-3xl">
          {first ? `${first.name} would have about ${first.eta_minutes} minutes.` : 'Nothing is mapped downstream yet.'}
        </h2>
        <p className="mb-6 max-w-2xl text-ink-2">
          If the dam failed completely, these are the places the flood reaches, in order. Warning time shrinks the further up the valley you live, which is why the slider on the map matters.
        </p>
        <EtaTable rows={e.data.assets} />
      </div>
      <div className="panel self-start p-5">
        <p className="eyebrow mb-1">Next</p>
        <p className="mb-4 font-serif text-xl leading-snug">See how a warmer climate changes the picture.</p>
        <button className="btn w-full justify-center" onClick={() => onOpenMap(lake.id, story.scenarioDelta)}><MapIcon size={16} />Open the 3D map at +{story.scenarioDelta.toFixed(1)} °C</button>
      </div>
    </div>
  )
}
