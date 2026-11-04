// The runtime the lab plays motion with. CSS (the Web Animations API with each version's easing
// curve) is the default; Motion (motion.dev) is a real animation library, the only one here with
// springs. The lab never simulates what a runtime lacks.

export type Runtime = 'css' | 'motion';

export const RUNTIMES: readonly Runtime[] = ['css', 'motion'];
export const RUNTIME_LABELS: Record<Runtime, string> = { css: 'CSS', motion: 'Motion' };

// One motion playing on one element, whatever runs it: the speed control, restarting a motion and
// stopping it work the same on both.
export interface PlayHandle {
  /** The element it plays on. */
  target: Element;
  /** Playback speed: 1 = normal. */
  speed: number;
  /** Seconds into the motion. */
  time: number;
  readonly finished: boolean;
  /** Settles when the motion ends or is cancelled (never rejects): what a hand-off to the next motion waits on. */
  done?: Promise<unknown>;
  cancel(): void;
}

// Wraps a native Web Animations animation as a PlayHandle.
export function cssHandle(target: Element, anim: Animation): PlayHandle {
  return {
    target,
    get speed() { return anim.playbackRate; },
    set speed(v: number) { anim.playbackRate = v; },
    get time() { return Number(anim.currentTime ?? 0) / 1000; },
    set time(v: number) { anim.currentTime = v * 1000; },
    get finished() { return anim.playState === 'finished'; },
    done: anim.finished.then(() => undefined, () => undefined),
    cancel() { anim.cancel(); },
  };
}

// The runtime a URL (?runtime=motion) asks for; CSS when it names none or an unknown one.
export function runtimeFromParam(value: string | null | undefined): Runtime {
  return value === 'motion' ? 'motion' : 'css';
}
