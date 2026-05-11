import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Clock, Home, Radio, Settings as SettingsIcon } from "lucide-react";
import { JarvisConfig, loadConfig } from "@/services/config";
import { fetchHomeAssistantStatus } from "@/services/jarvis";

type Status =
  | { kind: "unconfigured"; message: string }
  | { kind: "loading" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

interface Props {
  onOpenSettings: () => void;
}

export function StatusPanel({ onOpenSettings }: Props) {
  const [now, setNow] = useState(new Date());
  const [config, setConfig] = useState<JarvisConfig>(() => loadConfig());
  const [haStatus, setHaStatus] = useState<Status>({ kind: "unconfigured", message: "Home Assistant unavailable" });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    const onChange = () => setConfig(loadConfig());
    window.addEventListener("jarvis:config-changed", onChange);
    return () => {
      clearInterval(t);
      window.removeEventListener("jarvis:config-changed", onChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    async function check() {
      if (!config.homeAssistantUrl || !config.homeAssistantToken) {
        setHaStatus({ kind: "unconfigured", message: "Home Assistant not configured" });
        return;
      }
      setHaStatus({ kind: "loading" });
      try {
        const r = await fetchHomeAssistantStatus(config, ctrl.signal);
        if (!cancelled) setHaStatus({ kind: "ok", message: r.message });
      } catch (e: any) {
        if (!cancelled) setHaStatus({ kind: "error", message: e?.message ?? "Home Assistant unavailable" });
      }
    }

    check();
    const id = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearInterval(id);
    };
  }, [config.homeAssistantUrl, config.homeAssistantToken]);

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

  const endpoint = (label: string, value: string, fallback: string) => ({
    label,
    configured: Boolean(value?.trim()),
    text: value?.trim() ? "Configured" : fallback,
  });

  const endpoints = [
    endpoint("Telegram", config.telegramEndpoint, "Telegram endpoint not configured"),
    endpoint("STT", config.sttEndpoint, "STT service unavailable"),
    endpoint("Ollama", config.ollamaEndpoint, "Ollama agent not reachable"),
  ];

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

      {/* Endpoint Status */}
      <div>
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">Endpoint Status</span>
          <button
            onClick={onOpenSettings}
            className="text-[10px] uppercase tracking-wider text-jarvis-glow/80 hover:text-jarvis-glow flex items-center gap-1"
          >
            <SettingsIcon className="w-3 h-3" /> Configure
          </button>
        </div>
        <div className="rounded-xl border border-border/40 bg-card/40 px-4 divide-y divide-border/30">
          {endpoints.map((e) => (
            <div key={e.label} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Radio className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{e.label}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[11px] truncate ${e.configured ? "text-jarvis-ok" : "text-jarvis-warn"}`}
                  title={e.text}
                >
                  {e.text}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    e.configured
                      ? "bg-jarvis-ok shadow-[0_0_12px_hsl(var(--jarvis-ok)/0.8)]"
                      : "bg-jarvis-warn shadow-[0_0_12px_hsl(var(--jarvis-warn)/0.8)]"
                  } animate-glow-pulse`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Home Assistant */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1 px-1">
          Smart Home
        </div>
        <div className="rounded-xl border border-border/40 bg-card/40 p-4">
          <div className="flex items-start gap-2.5">
            <Home className="w-3.5 h-3.5 text-jarvis-teal mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Home Assistant</div>
              <div
                className={`text-xs font-mono break-words ${
                  haStatus.kind === "ok"
                    ? "text-jarvis-ok"
                    : haStatus.kind === "loading"
                    ? "text-muted-foreground"
                    : "text-jarvis-warn"
                }`}
              >
                {haStatus.kind === "loading" ? "Checking…" : haStatus.message}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reasoning Agent */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-1 px-1">
          Reasoning Agent
        </div>
        <div className="rounded-xl border border-border/40 bg-card/40 p-4">
          <div className="flex items-start gap-2.5">
            <Activity className="w-3.5 h-3.5 text-jarvis-glow mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
              <div className={`text-xs font-mono ${config.ollamaEndpoint ? "text-jarvis-glow" : "text-jarvis-warn"}`}>
                {config.ollamaEndpoint ? "Endpoint configured" : "Ollama agent not reachable"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {!config.telegramEndpoint && (
        <div className="rounded-xl border border-jarvis-warn/40 bg-jarvis-warn/5 p-3 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-jarvis-warn mt-0.5 shrink-0" />
          <p className="text-[11px] text-jarvis-warn/90 leading-relaxed">
            Configuration required. Open settings to add real endpoints — Jarvis will not run with mock data.
          </p>
        </div>
      )}

      <div className="mt-auto text-[10px] text-muted-foreground/50 text-center tracking-widest uppercase">
        J.A.R.V.I.S · v3.0
      </div>
    </aside>
  );
}
