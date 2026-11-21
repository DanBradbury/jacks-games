// Thin wrapper around the YouTube Playables SDK that degrades gracefully when
// the game runs outside YouTube (local dev, plain web hosting).
/// <reference path="./ytgame.d.ts" />

const sdk = (): YTGame | undefined => window.ytgame;

export const inPlayables = (): boolean => !!sdk()?.IN_PLAYABLES_ENV;

function safe(fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.warn('[playables]', err);
  }
}

/** Call as soon as the first frame is drawn. Must come before gameReady(). */
export function firstFrameReady() {
  if (inPlayables()) safe(() => sdk()!.game.firstFrameReady());
}

/** Call once the game is interactive. */
export function gameReady() {
  if (inPlayables()) safe(() => sdk()!.game.gameReady());
}

/** Load JSON save data (YouTube cloud save in Playables, localStorage otherwise). */
export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = inPlayables() ? await sdk()!.game.loadData() : localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch (err) {
    console.warn('[playables] load failed', err);
    return fallback;
  }
}

export async function save(key: string, data: unknown): Promise<void> {
  const raw = JSON.stringify(data);
  try {
    if (inPlayables()) await sdk()!.game.saveData(raw);
    else localStorage.setItem(key, raw);
  } catch (err) {
    console.warn('[playables] save failed', err);
  }
}

export function sendScore(value: number) {
  if (inPlayables()) sdk()!.engagement.sendScore({ value: Math.floor(value) }).catch(() => {});
}

export function isAudioEnabled(): boolean {
  if (!inPlayables()) return true;
  try {
    return sdk()!.system.isAudioEnabled();
  } catch {
    return true;
  }
}

export function onAudioEnabledChange(cb: (enabled: boolean) => void) {
  if (inPlayables()) safe(() => sdk()!.system.onAudioEnabledChange(cb));
}

/** Pause/resume from the Playables host, plus tab visibility everywhere. */
export function onPause(cb: () => void) {
  if (inPlayables()) safe(() => sdk()!.system.onPause(cb));
  document.addEventListener('visibilitychange', () => document.hidden && cb());
}

export function onResume(cb: () => void) {
  if (inPlayables()) safe(() => sdk()!.system.onResume(cb));
  document.addEventListener('visibilitychange', () => !document.hidden && cb());
}

/** Report uncaught errors to Playables health metrics. */
export function installErrorLogging() {
  if (!inPlayables()) return;
  window.addEventListener('error', () => safe(() => sdk()!.health.logError()));
  window.addEventListener('unhandledrejection', () => safe(() => sdk()!.health.logError()));
}
