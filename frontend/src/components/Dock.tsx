import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { gsap, reducedMotion } from '../lib/motion'

type Side = 'left' | 'right' | 'bottom'

interface Props { side: Side; label: string; icon: ReactNode; className: string; children: ReactNode }

const HIDE = { left: { xPercent: -115, yPercent: 0 }, right: { xPercent: 115, yPercent: 0 }, bottom: { xPercent: 0, yPercent: 140 } }
const PILL = {
  left: 'left-4 top-4',
  right: 'right-4 top-4',
  bottom: 'inset-x-0 bottom-4 mx-auto w-fit max-sm:hidden',
}

export default function Dock({ side, label, icon, className, children }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLButtonElement>(null)
  const first = useRef(true)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (!box.current) return
    const d = reducedMotion() ? 0 : undefined
    if (open) gsap.to(box.current, { xPercent: 0, yPercent: 0, autoAlpha: 1, duration: d ?? 0.9, ease: 'expo.out', overwrite: 'auto' })
    else gsap.to(box.current, { ...HIDE[side], autoAlpha: 0, duration: d ?? 0.55, ease: 'power3.in', overwrite: 'auto' })
  }, [open, side])

  useLayoutEffect(() => {
    if (open || !pill.current || reducedMotion()) return
    gsap.fromTo(pill.current, { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.6, delay: 0.35, ease: 'back.out(1.6)' })
  }, [open])

  const Chevron = side === 'left' ? ChevronLeft : side === 'right' ? ChevronRight : ChevronDown

  return (
    <>
      <div ref={box} data-dock={side} className={className} aria-hidden={!open}>
        {children}
        <button onClick={() => setOpen(false)} aria-label={`Hide ${label}`} title={`Hide ${label}`}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-ink/10 hover:text-ink">
          <Chevron size={16} />
        </button>
      </div>
      {!open && (
        <button ref={pill} onClick={() => setOpen(true)} aria-label={`Show ${label}`}
          className={`panel absolute z-10 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${PILL[side]}`}>
          {icon}{label}
        </button>
      )}
    </>
  )
}
