// Microphone capture with optional live level metering and silence-based auto-stop.

export type MicOptions = {
  onLevel?: (level: number) => void; // 0..1
  onSilenceStop?: () => void; // called when silence threshold reached (continuous mode)
  silenceMs?: number;
  silenceThreshold?: number;
};

export class MicRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId: number | null = null;
  private silenceStart: number | null = null;
  private opts: MicOptions = {};
  private startedAt = 0;

  async start(opts: MicOptions = {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone not supported in this browser");
    }
    this.opts = { silenceMs: 1500, silenceThreshold: 0.025, ...opts };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.startedAt = performance.now();
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: mime });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();

    // Setup analyser for level/VAD
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AC();
      const src = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);
      const data = new Uint8Array(this.analyser.fftSize);
      const loop = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const level = Math.min(1, rms * 3);
        this.opts.onLevel?.(level);

        if (this.opts.onSilenceStop) {
          const elapsed = performance.now() - this.startedAt;
          if (elapsed > 600) {
            // grace period
            if (rms < (this.opts.silenceThreshold ?? 0.025)) {
              if (this.silenceStart == null) this.silenceStart = performance.now();
              else if (performance.now() - this.silenceStart > (this.opts.silenceMs ?? 1500)) {
                this.opts.onSilenceStop();
                this.opts.onSilenceStop = undefined; // fire once
              }
            } else {
              this.silenceStart = null;
            }
          }
        }
        this.rafId = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      // Analyser optional — recording still works
    }
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("Recorder not started"));
        return;
      }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType ?? "audio/webm",
        });
        this.cleanup();
        resolve(blob);
      };
      this.mediaRecorder.onerror = (e) => {
        this.cleanup();
        reject(e);
      };
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        this.cleanup();
        reject(e as Error);
      }
    });
  }

  cancel() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        /* noop */
      }
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.silenceStart = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser = null;
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.mediaRecorder = null;
  }
}
