import { useEffect, useRef } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface Props {
  state: OrbState;
  level?: number; // 0..1 mic level (listening) or response intensity
  size?: number;
}

/**
 * Animated HUD orb. Pure canvas, deep-space teal palette.
 * State drives ring speed, glow intensity, and waveform amplitude.
 */
export function HudOrb({ state, level = 0, size = 240 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const stateRef = useRef(state);
  const levelRef = useRef(level);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let t = 0;
    const cx = size / 2;
    const cy = size / 2;
    const baseR = size * 0.28;

    const palette = {
      glow: "rgba(56, 224, 240, ",
      teal: "rgba(46, 213, 196, ",
      warn: "rgba(245, 180, 60, ",
      deep: "rgba(8, 16, 32, ",
    };

    const draw = () => {
      t += 0.016;
      const s = stateRef.current;
      const lvl = Math.min(1, Math.max(0, levelRef.current));

      const speedMult = s === "thinking" ? 2.4 : s === "listening" ? 1.6 + lvl : s === "speaking" ? 2 : 1;
      const intensity =
        s === "idle" ? 0.55 : s === "listening" ? 0.75 + lvl * 0.25 : s === "thinking" ? 1 : s === "speaking" ? 0.95 : 0.5;
      const color = s === "error" ? palette.warn : s === "thinking" ? palette.glow : palette.teal;

      ctx.clearRect(0, 0, size, size);

      // Outer atmospheric glow
      const glowGrad = ctx.createRadialGradient(cx, cy, baseR * 0.5, cx, cy, baseR * 2.4);
      glowGrad.addColorStop(0, `${palette.glow}${0.22 * intensity})`);
      glowGrad.addColorStop(0.5, `${palette.glow}${0.08 * intensity})`);
      glowGrad.addColorStop(1, `${palette.glow}0)`);
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, size, size);

      // Rotating outer ring with ticks
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.3 * speedMult);
      const ringR = baseR * 1.85;
      ctx.strokeStyle = `${color}${0.4 * intensity})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const tickLen = i % 5 === 0 ? 8 : 3;
        const x1 = Math.cos(a) * ringR;
        const y1 = Math.sin(a) * ringR;
        const x2 = Math.cos(a) * (ringR + tickLen);
        const y2 = Math.sin(a) * (ringR + tickLen);
        ctx.strokeStyle = `${color}${(i % 5 === 0 ? 0.7 : 0.25) * intensity})`;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();

      // Counter-rotating arc segments
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.6 * speedMult);
      ctx.strokeStyle = `${color}${0.55 * intensity})`;
      ctx.lineWidth = 2;
      const arcR = baseR * 1.45;
      [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((a) => {
        ctx.beginPath();
        ctx.arc(0, 0, arcR, a, a + Math.PI / 6);
        ctx.stroke();
      });
      ctx.restore();

      // Mid ring with dashes
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.9 * speedMult);
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = `${color}${0.35 * intensity})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, baseR * 1.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Core: pulsing orb
      const pulse = 0.92 + Math.sin(t * 3 * speedMult) * 0.06 + lvl * 0.15;
      const coreR = baseR * pulse;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      coreGrad.addColorStop(0, `${color}${0.9 * intensity})`);
      coreGrad.addColorStop(0.45, `${color}${0.35 * intensity})`);
      coreGrad.addColorStop(1, `${palette.deep}0.9)`);
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      // Inner waveform / equalizer
      const bars = 36;
      ctx.save();
      ctx.translate(cx, cy);
      for (let i = 0; i < bars; i++) {
        const a = (i / bars) * Math.PI * 2;
        const seed = Math.sin(i * 0.7 + t * 4 * speedMult) * 0.5 + 0.5;
        const amp = (s === "listening" ? lvl : s === "thinking" || s === "speaking" ? 0.6 : 0.25) * intensity;
        const len = baseR * 0.12 + seed * baseR * 0.35 * amp;
        const r1 = baseR * 0.55;
        const r2 = r1 + len;
        const x1 = Math.cos(a) * r1;
        const y1 = Math.sin(a) * r1;
        const x2 = Math.cos(a) * r2;
        const y2 = Math.sin(a) * r2;
        ctx.strokeStyle = `${color}${0.7 * intensity})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();

      // Center bright dot
      ctx.fillStyle = `rgba(220, 250, 255, ${0.85 * intensity})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 3 + lvl * 4, 0, Math.PI * 2);
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [size]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[10px] uppercase tracking-[0.3em] text-jarvis-glow/80 font-mono mt-[1px]">
          {state === "idle" ? "STANDBY" : state === "listening" ? "LISTENING" : state === "thinking" ? "ANALYZING" : state === "speaking" ? "RESPONDING" : "ERROR"}
        </span>
      </div>
    </div>
  );
}
