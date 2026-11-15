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
      .from(card.current, { y: 32, scale: 0.97, autoAlpha: 0, duration: 0.7, ease: 'expo.out' }, 0.05)
    return () => { tl.kill() }
  }, [])

  return (
    <div ref={back} className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-abyss/70 p-4 backdrop-blur-md sm:p-10" onMouseDown={onClose}>
      <div ref={card} role="dialog" aria-label={title} className="panel w-full max-w-2xl p-6 sm:p-8" onMouseDown={e => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="display text-4xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-ink-2 transition-colors hover:bg-white/10 hover:text-ink"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
