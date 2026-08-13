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
 * Web Audio procedural ambient train sound synthesizer fallback.
 * Generates low warm rail rumble, track clatter rhythm, and coach fan hum.
 */
class ProceduralAmbientSynth {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private isRunning = false;
  private timer: number | null = null;

  start(targetVolume: number) {
    if (this.isRunning) {
      if (this.gainNode && this.ctx) {
        this.gainNode.gain.setTargetAtTime(targetVolume * 0.18, this.ctx.currentTime, 0.1);
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(targetVolume * 0.18, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);

      // Low train rumble noise generator
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02; // Brown/pink filter
        lastOut = output[i];
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 180;

      noiseNode.connect(lowpass);
      lowpass.connect(this.gainNode);
      noiseNode.start();

      // Coach ceiling fan hum
      const fanOsc = this.ctx.createOscillator();
      fanOsc.type = "sine";
      fanOsc.frequency.value = 54;
      const fanGain = this.ctx.createGain();
      fanGain.gain.value = 0.08;
      fanOsc.connect(fanGain);
      fanGain.connect(this.gainNode);
      fanOsc.start();

      this.isRunning = true;
    } catch {
      /* Web Audio unsupported */
    }
  }

  setVolume(vol: number) {
    if (this.ctx && this.gainNode) {
      this.gainNode.gain.setTargetAtTime(vol * 0.18, this.ctx.currentTime, 0.1);
    }
  }

  stop() {
    if (!this.isRunning) return;
    try {
      if (this.timer) window.clearInterval(this.timer);
      this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.gainNode = null;
    this.isRunning = false;
  }
}

export function useAmbientAudio(
  isMoving: boolean = true,
  journeyMode: boolean = false,
): AmbientAudioControls {
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolumeState] = useState(0.25);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const synthRef = useRef<ProceduralAmbientSynth | null>(null);

  // Initialize synth instance
  useEffect(() => {
    synthRef.current = new ProceduralAmbientSynth();
    return () => {
      synthRef.current?.stop();
    };
  }, []);

  // Sync ambient audio playback state
  useEffect(() => {
    if (!enabled) {
      synthRef.current?.stop();
      audioElementsRef.current.forEach((el) => {
        el.pause();
      });
      setIsAudioPlaying(false);
      return;
    }

    const effectiveVolume = journeyMode ? Math.min(1.0, volume * 1.25) : volume;
    let playedLocalAsset = false;

    // Attempt to play local audio files if present
    Object.entries(AMBIENT_FILES).forEach(([key, src]) => {
      let el = audioElementsRef.current.get(key);
      if (!el) {
        el = new Audio(src);
        el.loop = true;
        audioElementsRef.current.set(key, el);
      }

      el.volume = Math.max(0, Math.min(1, effectiveVolume * 0.4));
      el.play()
        .then(() => {
          playedLocalAsset = true;
          setIsAudioPlaying(true);
        })
        .catch(() => {
          /* File not found or blocked by browser policy */
        });
    });

    // If local mp3s are absent, use procedural audio synth
    if (!playedLocalAsset) {
      synthRef.current?.start(effectiveVolume);
      setIsAudioPlaying(true);
    }
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
