import { AlertCircle, Sparkles, User } from "lucide-react";
import type { AgentSection } from "@/services/jarvis";

export type ChatMessage =
  | { id: string; role: "user"; text: string; ts: Date }
  | { id: string; role: "jarvis"; sections: AgentSection[]; agent: string; ts: Date }
  | { id: string; role: "system-error"; message: string; ts: Date };

const labelTone: Record<AgentSection["label"], string> = {
  Observation: "text-jarvis-teal border-jarvis-teal/30",
  Interpretation: "text-jarvis-glow border-jarvis-glow/30",
  "Recommended Action": "text-jarvis-warn border-jarvis-warn/30",
  "Final Output": "text-jarvis-ok border-jarvis-ok/40",
  Response: "text-jarvis-glow border-jarvis-glow/30",
};

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function UserBubble({ text, ts }: { text: string; ts: Date }) {
  return (
    <div className="flex justify-end animate-fade-up">
      <div className="flex items-start gap-3 max-w-[80%] flex-row-reverse">
        <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 bg-secondary/70 border border-border/60 text-sm text-foreground/95 whitespace-pre-wrap">
            {text}
          </div>
          <span className="text-[10px] text-muted-foreground/60 px-1">{formatTime(ts)}</span>
        </div>
      </div>
    </div>
  );
}

export function JarvisBubble({
  sections,
  agent,
  ts,
}: {
  sections: AgentSection[];
  agent: string;
  ts: Date;
}) {
  return (
    <div className="flex justify-start animate-fade-up">
      <div className="flex items-start gap-3 max-w-[88%]">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-jarvis-glow to-jarvis-teal flex items-center justify-center shrink-0 shadow-[0_0_20px_hsl(var(--jarvis-glow)/0.4)]">
          <Sparkles className="w-4 h-4 text-jarvis-deep" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-foreground">Jarvis</span>
            <span className="text-[10px] uppercase tracking-wider font-mono text-jarvis-glow/70">{agent}</span>
            <span className="text-[10px] text-muted-foreground/60 ml-auto">{formatTime(ts)}</span>
          </div>
          <div className="space-y-2">
            {sections.map((s, i) => (
              <div
                key={i}
                className={`rounded-xl border bg-card/50 backdrop-blur-sm px-4 py-3 ${labelTone[s.label]}`}
              >
                <div className="text-[10px] uppercase tracking-[0.18em] font-medium mb-1">{s.label}</div>
                <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{s.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SystemErrorBubble({ message, ts }: { message: string; ts: Date }) {
  return (
    <div className="flex justify-start animate-fade-up">
      <div className="flex items-start gap-3 max-w-[88%]">
        <div className="w-8 h-8 rounded-full bg-jarvis-warn/15 border border-jarvis-warn/40 flex items-center justify-center shrink-0">
          <AlertCircle className="w-4 h-4 text-jarvis-warn" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-jarvis-warn">System</span>
            <span className="text-[10px] uppercase tracking-wider font-mono text-jarvis-warn/70">status</span>
            <span className="text-[10px] text-muted-foreground/60 ml-auto">{formatTime(ts)}</span>
          </div>
          <div className="rounded-xl border border-jarvis-warn/40 bg-jarvis-warn/5 px-4 py-3 text-sm text-jarvis-warn/95">
            {message}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThinkingIndicator({ agent = "Ollama" }: { agent?: string }) {
  return (
    <div className="flex justify-start animate-fade-up">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-jarvis-glow to-jarvis-teal flex items-center justify-center shrink-0 shadow-[0_0_20px_hsl(var(--jarvis-glow)/0.5)] animate-glow-pulse">
          <Sparkles className="w-4 h-4 text-jarvis-deep" />
        </div>
        <div className="rounded-xl border border-jarvis-glow/20 bg-card/60 px-4 py-3 flex items-center gap-3">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-jarvis-glow animate-thinking-dot" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-jarvis-glow animate-thinking-dot" style={{ animationDelay: "200ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-jarvis-glow animate-thinking-dot" style={{ animationDelay: "400ms" }} />
          </div>
          <span className="text-xs font-mono text-foreground/80">
            ...[Agent: {agent}] Analyzing <span className="text-jarvis-warn">💡</span>...
          </span>
        </div>
      </div>
    </div>
  );
}
