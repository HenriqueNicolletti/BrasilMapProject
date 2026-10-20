import { gsap } from 'gsap';
import { revealTiming } from '../lib/motion-timing.ts';

// Short, decorative motion for content that appears after a click (twin results, compare tables,
// the chosen municipality). Content present at load is never animated, so nothing waits on this
// script to be visible. Everything is skipped under prefers-reduced-motion.

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Rise and fade `targets` in, one after another. */
export function reveal(targets: Iterable<Element>): void {
  const list = [...targets];
  if (list.length === 0 || reducedMotion()) return;
  const { duration, spread } = revealTiming(list.length);
  gsap.from(list, {
    opacity: 0,
    y: 10,
    duration,
    ease: 'power2.out',
    stagger: spread === 0 ? 0 : { amount: spread },
    clearProps: 'opacity,transform',
  });
}
