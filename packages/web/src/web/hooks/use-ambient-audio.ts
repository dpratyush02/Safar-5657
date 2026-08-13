import { useCallback, useEffect, useRef, useState } from "react";

export type AmbientSoundTrack =
  | "train-running"
  | "fan"
  | "coach-ambience"
  | "station-ambience"
  | "rail-joint";

export interface AmbientAudioControls {
  enabled: boolean;
  volume: number;
  isAudioPlaying: boolean;
  toggleAmbience: () => void;
  setVolume: (vol: number) => void;
}

const AMBIENT_FILES: Record<AmbientSoundTrack, string> = {
  "train-running": "/audio/ambient/train-running.mp3",
  fan: "/audio/ambient/fan.mp3",
  "coach-ambience": "/audio/ambient/coach-ambience.mp3",
  "station-ambience": "/audio/ambient/station-ambience.mp3",
  "rail-joint": "/audio/ambient/rail-joint.mp3",
};

/**
 * Web Audio procedural ambient train sound synthesizer.
 * Synthesizes low warm rail rumble, periodic rail-joint "clack-clack" rhythm, and coach fan hum.
 */
class ProceduralAmbientSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isRunning = false;
  private rhythmTimer: number | null = null;

  start(targetVolume: number) {
    if (this.isRunning) {
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(targetVolume * 0.35, this.ctx.currentTime, 0.1);
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      if (this.ctx.state === "suspended") {
        void this.ctx.resume();
      }

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(targetVolume * 0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // 1. Continuous Low Train Rumble (Brownian noise filtered)
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 160;

      noiseNode.connect(lowpass);
      lowpass.connect(this.masterGain);
      noiseNode.start();

      // 2. Coach Ceiling Fan Hum
      const fanOsc = this.ctx.createOscillator();
      fanOsc.type = "sine";
      fanOsc.frequency.value = 52;
      const fanGain = this.ctx.createGain();
      fanGain.gain.value = 0.12;
      fanOsc.connect(fanGain);
      fanGain.connect(this.masterGain);
      fanOsc.start();

      // 3. Periodic Rail-Joint "clack-clack" rhythm generator
      const triggerRailJoint = () => {
        if (!this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;

        // Double click: "clack... clack"
        [0, 0.12].forEach((offset) => {
          const clickOsc = this.ctx!.createOscillator();
          const clickGain = this.ctx!.createGain();
          const filter = this.ctx!.createBiquadFilter();

          clickOsc.type = "triangle";
          clickOsc.frequency.setValueAtTime(320, now + offset);
          clickOsc.frequency.exponentialRampToValueAtTime(80, now + offset + 0.08);

          filter.type = "bandpass";
          filter.frequency.value = 400;

          clickGain.gain.setValueAtTime(0.25, now + offset);
          clickGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.09);

          clickOsc.connect(filter);
          filter.connect(clickGain);
          clickGain.connect(this.masterGain!);

          clickOsc.start(now + offset);
          clickOsc.stop(now + offset + 0.1);
        });
      };

      // Trigger rail-joint clack every ~1.8 seconds
      this.rhythmTimer = window.setInterval(triggerRailJoint, 1800);

      this.isRunning = true;
    } catch {
      /* Web Audio unsupported */
    }
  }

  setVolume(vol: number) {
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(vol * 0.35, this.ctx.currentTime, 0.1);
    }
  }

  stop() {
    if (!this.isRunning) return;
    try {
      if (this.rhythmTimer) window.clearInterval(this.rhythmTimer);
      this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.masterGain = null;
    this.rhythmTimer = null;
    this.isRunning = false;
  }
}

export function useAmbientAudio(
  isMoving: boolean = true,
  journeyMode: boolean = false,
): AmbientAudioControls {
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolumeState] = useState(0.3);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const synthRef = useRef<ProceduralAmbientSynth | null>(null);

  useEffect(() => {
    synthRef.current = new ProceduralAmbientSynth();
    return () => {
      synthRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      synthRef.current?.stop();
      audioElementsRef.current.forEach((el) => {
        el.pause();
      });
      setIsAudioPlaying(false);
      return;
    }

    const effectiveVolume = journeyMode ? Math.min(1.0, volume * 1.2) : volume;

    // Start procedural synth sound immediately
    synthRef.current?.start(effectiveVolume);
    setIsAudioPlaying(true);

    // Also attempt loading local audio assets if present
    Object.entries(AMBIENT_FILES).forEach(([key, src]) => {
      let el = audioElementsRef.current.get(key);
      if (!el) {
        el = new Audio(src);
        el.loop = true;
        audioElementsRef.current.set(key, el);
      }

      el.volume = Math.max(0, Math.min(1, effectiveVolume * 0.4));
      el.play().catch(() => {
        /* Local asset fallback to synth */
      });
    });
  }, [enabled, volume, journeyMode, isMoving]);

  const toggleAmbience = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    synthRef.current?.setVolume(clamped);
    audioElementsRef.current.forEach((el) => {
      el.volume = clamped * 0.4;
    });
  }, []);

  return {
    enabled,
    volume,
    isAudioPlaying,
    toggleAmbience,
    setVolume,
  };
}
