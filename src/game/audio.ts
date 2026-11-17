class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainVal = 0.14,
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playNoise(duration: number, filterFreq: number, gainVal = 0.12) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  swordSlash() {
    this.playNoise(0.11, 2400, 0.14);
    this.playTone(540, 220, 0.09, 'sawtooth', 0.07);
  }

  hitEnemy() {
    this.playTone(210, 85, 0.11, 'square', 0.14);
    this.playNoise(0.07, 1400, 0.12);
  }

  shieldClang() {
    this.playTone(980, 1420, 0.08, 'square', 0.11);
    this.playTone(1320, 880, 0.12, 'triangle', 0.1, 0.02);
  }

  bushCut() {
    this.playNoise(0.09, 1200, 0.11);
  }

  wallMergeEnter() {
    this.playTone(320, 640, 0.14, 'sine', 0.14);
    this.playTone(480, 960, 0.16, 'triangle', 0.1, 0.03);
  }

  wallMergeExit() {
    this.playTone(620, 340, 0.12, 'sine', 0.13);
    this.playTone(460, 260, 0.14, 'triangle', 0.09, 0.02);
  }

  fissureWarp() {
    this.playTone(260, 880, 0.25, 'sine', 0.15);
    this.playTone(390, 1180, 0.28, 'triangle', 0.11, 0.06);
    this.playTone(780, 520, 0.24, 'sine', 0.1, 0.18);
  }

  bowShoot() {
    this.playTone(460, 180, 0.09, 'triangle', 0.13);
    this.playNoise(0.05, 3200, 0.07);
  }

  boomerangThrow() {
    this.playTone(380, 560, 0.1, 'sine', 0.1);
  }

  bombPlace() {
    this.playTone(190, 140, 0.08, 'sine', 0.12);
  }

  bombExplode() {
    this.playNoise(0.38, 420, 0.28);
    this.playTone(120, 36, 0.35, 'sawtooth', 0.2);
  }

  crystalSwitch() {
    this.playTone(587.33, 587.33, 0.09, 'sine', 0.14);
    this.playTone(880, 880, 0.16, 'triangle', 0.13, 0.07);
  }

  pickupRupee() {
    this.playTone(987.77, 987.77, 0.07, 'sine', 0.11);
    this.playTone(1318.51, 1318.51, 0.14, 'sine', 0.12, 0.06);
  }

  pickupHeart() {
    this.playTone(523.25, 523.25, 0.07, 'triangle', 0.12);
    this.playTone(659.25, 659.25, 0.07, 'triangle', 0.12, 0.06);
    this.playTone(783.99, 783.99, 0.14, 'triangle', 0.13, 0.12);
  }

  itemFanfare() {
    const notes = [523.25, 587.33, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n, idx === notes.length - 1 ? 0.32 : 0.1, 'triangle', 0.14, idx * 0.08);
    });
  }

  doorUnlock() {
    this.playTone(330, 330, 0.08, 'square', 0.1);
    this.playTone(440, 440, 0.08, 'square', 0.1, 0.08);
    this.playTone(660, 660, 0.18, 'triangle', 0.13, 0.16);
  }

  playerHurt() {
    this.playTone(260, 110, 0.18, 'sawtooth', 0.16);
    this.playNoise(0.1, 900, 0.14);
  }

  victoryFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5];
    const delays = [0, 0.11, 0.22, 0.34, 0.52, 0.66];
    notes.forEach((n, i) => {
      this.playTone(n, n, i === notes.length - 1 ? 0.55 : 0.12, 'triangle', 0.16, delays[i]);
    });
  }

  gameOver() {
    const notes = [392.0, 349.23, 329.63, 261.63];
    notes.forEach((n, i) => {
      this.playTone(n, n * 0.96, 0.25, 'sine', 0.14, i * 0.22);
    });
  }
}

export const sound = new SoundEngine();
