import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface StaggerOpts { y?: number; stagger?: number; delay?: number; duration?: number }

export function useStagger(root: RefObject<HTMLElement | null>, selector: string, deps: unknown[], opts: StaggerOpts = {}) {
  useLayoutEffect(() => {
    if (!root.current || reducedMotion()) return
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>(selector)
      if (!items.length) return
      gsap.from(items, {
        autoAlpha: 0,
        y: opts.y ?? 16,
        duration: opts.duration ?? 0.55,
        stagger: opts.stagger ?? 0.06,
        delay: opts.delay ?? 0,
        ease: 'power3.out',
        clearProps: 'opacity,visibility,transform',
      })
    }, root)
    return () => ctx.revert()
  }, deps)
}
