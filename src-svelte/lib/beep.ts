let audioCtx: AudioContext | null = null;

/** 在用户交互后预热 AudioContext，便于后续到点响铃 */
export function ensureAudioReady(): void {
  getAudioContext();
}

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

/** 短提示音，需在用户交互后调用；失败时静默 */
export function playShortBeep(durationMs = 250, frequency = 880): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // 浏览器限制或 Audio API 不可用时忽略
  }
}
