import { useEffect, useRef } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "error";
interface Props { state: OrbState; level?: number; density?: "high" | "medium" | "low"; paused?: boolean; onStats?: (stats: { fps: number; links: number }) => void }

export function HudOrb({ state, level = 0, density = "high", paused = false, onStats }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activity = useRef({ state, level, paused, onStats });
  useEffect(() => { activity.current = { state, level, paused, onStats }; }, [state, level, paused, onStats]);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const css = getComputedStyle(document.documentElement);
    const colors = new Map<string, string>();
    for (const name of ["--neuron-blue", "--primary", "--neuron-violet", "--neuron-pink", "--neuron-mint", "--core-white"]) colors.set(name, css.getPropertyValue(name).trim());
    const token = (name: string, alpha = 1) => `hsl(${colors.get(name)} / ${alpha})`;
    const palette = ["--neuron-blue", "--primary", "--neuron-violet", "--neuron-pink", "--neuron-mint"];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0, height = 0, frame = 0, lastSample = performance.now(), frames = 0;
    let filaments: { points: { x: number; y: number }[]; color: string; phase: number; speed: number; thickness: number }[] = [];
    let stars: { x: number; y: number; alpha: number }[] = [];
    const random = (a: number, b: number) => a + Math.random() * (b - a);
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scale = Math.min(width / 1250, height / 730, 1.5);
      const count = Math.round(480 * (density === "high" ? 1 : density === "medium" ? .6 : .25));
      filaments = Array.from({ length: count }, (_, i) => {
        const angle = random(0, Math.PI * 2), length = random(65, 370) * scale;
        const steps = Math.floor(random(3, 10)), bend = random(-.7, .7);
        const ox = width / 2 + random(-48, 48) * scale, oy = height * .485 + random(-57, 57) * scale;
        const points = Array.from({ length: steps + 1 }, (_, j) => {
          const t = j / steps, theta = angle + bend * t + Math.sin(t * 9 + i) * .045;
          return { x: ox + Math.cos(theta) * length * t * (1 + .17 * Math.sin(t * 4 + i)), y: oy + Math.sin(theta) * length * t * .7 * (1 + .2 * Math.cos(t * 5 + i)) };
        });
        return { points, color: angle > 1 && angle < 2.5 ? "--neuron-pink" : angle > 3.7 && angle < 5.2 ? "--neuron-mint" : palette[i % palette.length], phase: random(0, 7), speed: random(.3, 2.5), thickness: random(.3, 1.25) };
      });
      stars = Array.from({ length: 230 }, () => ({ x: Math.random() * width, y: Math.random() * height, alpha: random(.05, .23) }));
      activity.current.onStats?.({ fps: 0, links: count });
      draw(performance.now(), true);
    };
    const draw = (time: number, force = false) => {
      if (activity.current.paused && !force) return;
      const t = reduced.matches ? 0 : time;
      const cx = width / 2, cy = height * .485;
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) { ctx.fillStyle = token("--neuron-blue", star.alpha); ctx.fillRect(star.x, star.y, 1, 1); }
      ctx.globalCompositeOperation = "screen";
      for (let pass = 0; pass < 2; pass++) {
        for (const f of filaments) {
          const a = .18 + .33 * (.5 + .5 * Math.sin(t * .001 * f.speed + f.phase));
          ctx.strokeStyle = token(f.color, a * (pass === 0 ? .2 : 1));
          ctx.lineWidth = f.thickness * (pass === 0 ? 4.2 : 1);
          ctx.shadowBlur = 0;
          ctx.beginPath();
          f.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.stroke();
          if (pass === 1 && f.phase > 4.6) {
            const p = f.points[Math.floor(f.phase) % f.points.length];
            ctx.fillStyle = token(f.color, .4 + .6 * Math.abs(Math.sin(t * .0015 + f.phase)));
            ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      const scale = Math.min(width / 1250, height / 730, 1.5);
      const radius = (105 + 15 * Math.sin(t * .002) + activity.current.level * 35) * scale;
      const gx = cx + Math.sin(t * .0014) * 15 * scale, gy = cy + Math.cos(t * .0011) * 8 * scale;
      ctx.shadowBlur = 0;
      const core = ctx.createRadialGradient(gx, gy, 1, gx, gy, Math.max(2, radius));
      core.addColorStop(0, token("--core-white", .98)); core.addColorStop(.06, token("--primary", .94)); core.addColorStop(.17, token("--neuron-blue", .62)); core.addColorStop(.4, token("--neuron-blue", .15)); core.addColorStop(1, token("--neuron-blue", 0));
      ctx.fillStyle = core; ctx.beginPath(); ctx.ellipse(gx, gy, radius * .8, radius * 1.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineCap = "round";
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        for (let k = 0; k <= 35; k++) {
          const p = k / 35, y = gy + (p - .5) * 160 * scale;
          const x = gx + (Math.sin(p * 5.8 + t * .0017 + j * 1.4) * 14 + Math.sin(p * 13 + t * .0012) * 7) * (1 - Math.abs(p - .5) * .75) * scale;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineWidth = [8, 3, 1.3][j] * scale; ctx.strokeStyle = token(j === 0 ? "--primary" : "--core-white", [.38, .8, .85][j]); ctx.shadowBlur = 20; ctx.shadowColor = token("--primary"); ctx.stroke();
      }
      ctx.shadowBlur = 0; ctx.globalCompositeOperation = "source-over";
    };
    let lastDraw = 0;
    const loop = (time: number) => {
      if (!reduced.matches && !activity.current.paused && time - lastDraw >= 32) { draw(time); frames++; lastDraw = time; }
      if (time - lastSample >= 1000) {
        activity.current.onStats?.({ fps: activity.current.paused || reduced.matches ? 0 : Math.round(frames * 1000 / (time - lastSample)), links: filaments.length });
        lastSample = time; frames = 0;
      }
      frame = requestAnimationFrame(loop);
    };
    resize(); frame = requestAnimationFrame(loop);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, [density]);
  return <canvas ref={ref} className="neural-field" aria-hidden="true" />;
}
