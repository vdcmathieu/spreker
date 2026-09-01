/**
 * Whether the opening wave has finished.
 *
 * The wave and three.js cannot both have the main thread: evaluating the 3D
 * bundle is a single task long enough to hold the screen still for most of a
 * second, and a loading animation that freezes is worse than none. So the rig
 * waits for the wave, and arrives a moment after the hero does.
 */

let done = false;
const listeners = new Set<() => void>();

export function markSplashDone() {
  if (done) return;
  done = true;
  for (const l of listeners) l();
}

export function subscribeSplash(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export const splashDone = () => done;
/** Nothing on the page may depend on the splash behaving. */
export const splashDoneServer = () => true;

if (typeof window !== 'undefined') {
  // Belt and braces: whatever happens to the overlay, the rig turns up.
  setTimeout(markSplashDone, 3000);
}
