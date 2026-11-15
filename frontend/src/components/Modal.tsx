import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { gsap, reducedMotion } from '../lib/motion'

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const back = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  useEffect(() => {
    if (reducedMotion() || !back.current || !card.current) return
    const tl = gsap.timeline()
    tl.from(back.current, { autoAlpha: 0, duration: 0.25 })
      .from(card.current, { y: 28, scale: 0.97, autoAlpha: 0, duration: 0.45, ease: 'power3.out' }, 0.05)
    return () => { tl.kill() }
  }, [])

  return (
    <div ref={back} className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/65 p-4 sm:p-10" onMouseDown={onClose}>
      <div ref={card} role="dialog" aria-label={title} className="panel w-full max-w-2xl p-6 sm:p-8" onMouseDown={e => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="display text-4xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-ink-2 hover:bg-paper-2"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
