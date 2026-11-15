import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

export { gsap, ScrollTrigger, SplitText }

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
        duration: opts.duration ?? 0.7,
        stagger: opts.stagger ?? 0.07,
        delay: opts.delay ?? 0,
        ease: 'expo.out',
        clearProps: 'opacity,visibility,transform',
      })
    }, root)
    return () => ctx.revert()
  }, deps)
}

export function useSplitReveal(root: RefObject<HTMLElement | null>, deps: unknown[]) {
  useLayoutEffect(() => {
    if (!root.current || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-split]').forEach(el => {
        const s = SplitText.create(el, { type: 'lines', mask: 'lines' })
        gsap.from(s.lines, { yPercent: 110, duration: 1.15, stagger: 0.1, ease: 'expo.out', delay: 0.05 })
      })
    }, root)
    return () => ctx.revert()
  }, deps)
}
