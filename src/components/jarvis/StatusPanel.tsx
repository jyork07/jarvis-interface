import { useEffect, useState } from "react";
import { Activity, Clock, Cpu, Home, Radio, ShieldCheck, Wifi } from "lucide-react";

type StatusLevel = "ok" | "warn" | "info";

const dotColor: Record<StatusLevel, string> = {
  ok: "bg-jarvis-ok shadow-[0_0_12px_hsl(var(--jarvis-ok)/0.8)]",
  warn: "bg-jarvis-warn shadow-[0_0_12px_hsl(var(--jarvis-warn)/0.8)]",
  info: "bg-jarvis-glow shadow-[0_0_12px_hsl(var(--jarvis-glow)/0.8)]",
};

function StatusRow({ icon: Icon, label, value, level }: { icon: any; label: string; value: string; level: StatusLevel }) {
  return (
    <div className="flex items-center justify-between py-2.5 group">
      <div className="flex items-center gap-2.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-jarvis-glow transition-colors" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground/90">{value}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor[level]} animate-glow-pulse`} />
      </div>
    </div>
  );
}

export function StatusPanel() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

  return (
    <aside className="glass-panel rounded-2xl p-5 flex flex-col gap-5 h-full">
      {/* Clock */}
      <div className="relative overflow-hidden rounded-xl border border-jarvis-glow/10 bg-jarvis-deep/40 p-4">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-jarvis-glow/60 to-transparent animate-scan-line" />
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-jarvis-glow/70 mb-1">
          <Clock className="w-3 h-3" />
          System Time
        </div>
        <div className="text-3xl font-light tracking-wider glow-text font-mono">{time}</div>
        <div className="text-xs text-muted-foreground mt-1">{date}</div>
      </div>

      {/* Ambient Status */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1 px-1">Ambient Status</div>
        <div className="rounded-xl border border-border/40 bg-card/40 px-4 divide-y divide-border/30">
          <StatusRow icon={Home} label="Lights" value="OK" level="ok" />
          <StatusRow icon={Wifi} label="Network" value="Caution" level="warn" />
          <StatusRow icon={ShieldCheck} label="Security" value="Armed" level="ok" />
          <StatusRow icon={Cpu} label="CPU Load" value="34%" level="ok" />
        </div>
      </div>

      {/* Active Protocols */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1 px-1">Active Protocols</div>
        <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <Radio className="w-3.5 h-3.5 text-jarvis-teal mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Intelligence Source</div>
              <div className="text-xs font-mono text-jarvis-teal truncate">KNOWLEDGE_BASE.md</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Activity className="w-3.5 h-3.5 text-jarvis-glow mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reasoning Agent</div>
              <div className="text-xs font-mono text-jarvis-glow">Ollama · llama3.1</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto text-[10px] text-muted-foreground/50 text-center tracking-widest uppercase">
        J.A.R.V.I.S · v3.0
      </div>
    </aside>
  );
}
