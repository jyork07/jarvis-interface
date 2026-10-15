import { useEffect, useRef } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";
interface Props { state: OrbState; level?: number; size?: number }

export function HudOrb({ state, level = 0, size = 340 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activity = useRef({ state, level });
  useEffect(() => { activity.current = { state, level }; }, [state, level]);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = size * dpr; canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const color = getComputedStyle(document.documentElement).getPropertyValue("--core-particle").trim();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const points = Array.from({ length: 180 }, (_, i) => {
      const y = 1 - (i / 179) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = i * Math.PI * (3 - Math.sqrt(5));
      return [Math.cos(theta) * r, y, Math.sin(theta) * r];
    });
    let frame = 0;
    let angle = 0;
    const draw = () => {
      const active = activity.current.state !== "idle";
      angle += reduced.matches ? 0 : active ? 0.009 : 0.003;
      ctx.clearRect(0, 0, size, size);
      const radius = size * .37 * (1 + activity.current.level * .05);
      const projected = points.map(([x, y, z]) => {
        const rx = x * Math.cos(angle) - z * Math.sin(angle);
        const rz = x * Math.sin(angle) + z * Math.cos(angle);
        return { x: size / 2 + rx * radius, y: size / 2 + y * radius * .95, depth: (rz + 1) / 2 };
      });
      ctx.lineWidth = .45;
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        for (let j = i + 1; j < projected.length; j++) {
          const q = projected[j];
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < size * .105 && p.depth > .35 && q.depth > .35) {
            ctx.strokeStyle = `hsl(${color} / ${(1 - d / (size * .105)) * .28})`;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        ctx.fillStyle = `hsl(${color} / ${.2 + p.depth * .7})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, .7 + p.depth * 1.3, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduced.matches) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [size]);
  return <div className="neural-globe" aria-hidden="true"><div className="globe-orbit" /><canvas ref={ref} className="neural-canvas" /></div>;
}
