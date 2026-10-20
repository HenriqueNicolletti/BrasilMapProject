/** No animation on this site may run longer than this, stagger included (docs/PLAN.md: up to ~600 ms). */
export const MAX_TOTAL_SECONDS = 0.6;

export interface RevealTiming {
  /** Seconds each element takes to settle. */
  duration: number;
  /** Seconds between the first element starting and the last one starting. */
  spread: number;
  /** Seconds from the start to the last element settling. */
  total: number;
}

/** A short rise-and-fade for `count` elements; a long list gets a tighter spread, never a longer run. */
export function revealTiming(count: number): RevealTiming {
  const duration = 0.35;
  const spread = count <= 1 ? 0 : Math.min(0.2, MAX_TOTAL_SECONDS - duration - 0.05);
  return { duration, spread, total: duration + spread };
}
