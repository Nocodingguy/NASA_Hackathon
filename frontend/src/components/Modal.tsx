import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:p-10" onMouseDown={onClose}>
      <div role="dialog" aria-label={title} className="panel w-full max-w-2xl p-6 sm:p-8" onMouseDown={e => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-serif text-2xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-ink-2 hover:bg-paper-2"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
