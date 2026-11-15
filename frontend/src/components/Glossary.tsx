import Modal from './Modal'
import { GLOSSARY } from '../detective/content'

export default function Glossary({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Plain-language glossary" onClose={onClose}>
      <dl className="divide-y divide-white/10 border-y border-white/10">
        {GLOSSARY.map(g => (
          <div key={g.term} className="py-3">
            <dt className="font-semibold">{g.term}</dt>
            <dd className="mt-0.5 text-sm text-ink-2">{g.plain}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}
