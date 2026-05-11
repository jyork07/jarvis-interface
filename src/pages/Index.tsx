import { useEffect, useRef, useState } from "react";
import { CommandInput } from "@/components/jarvis/CommandInput";
import { StatusPanel } from "@/components/jarvis/StatusPanel";
import {
  ChatMessage,
  JarvisBubble,
  ThinkingIndicator,
  UserBubble,
} from "@/components/jarvis/ChatMessage";
import { sendToTelegramPipeline, transcribeAudio } from "@/services/jarvis";
import { LayoutDashboard, X } from "lucide-react";

const initialMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "jarvis",
    agent: "Ollama",
    ts: new Date(Date.now() - 1000 * 60 * 4),
    sections: [
      { label: "Observation", content: "Good evening, sir. All core systems are nominal. The Network protocol is flagged for caution due to elevated latency on subnet 10.0.2.x." },
      { label: "Recommended Action", content: "Consider a passive diagnostic before any bandwidth-sensitive task. I can run one quietly in the background on your word." },
      { label: "Final Output", content: "I'm listening — type or tap the microphone to begin." },
    ],
  },
];

const uid = () => Math.random().toString(36).slice(2, 10);

export default function Index() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [thinking, setThinking] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const runPipeline = async (text: string) => {
    setThinking(true);
    try {
      const res = await sendToTelegramPipeline(text);
      setMessages((m) => [
        ...m,
        { id: uid(), role: "jarvis", agent: res.agent, sections: res.sections, ts: new Date() },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const handleSubmit = (text: string) => {
    setMessages((m) => [...m, { id: uid(), role: "user", text, ts: new Date() }]);
    runPipeline(text);
  };

  const handleMic = async () => {
    const transcript = await transcribeAudio();
    setMessages((m) => [...m, { id: uid(), role: "user", text: transcript, ts: new Date() }]);
    runPipeline(transcript);
  };

  return (
    <div className="min-h-screen w-full flex flex-col">
      {/* Top bar */}
      <header className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-jarvis-glow to-jarvis-teal flex items-center justify-center shadow-[0_0_24px_hsl(var(--jarvis-glow)/0.4)]">
            <span className="text-jarvis-deep font-bold text-sm">J</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-jarvis-ok border-2 border-background animate-glow-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide glow-text">JARVIS</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Just a Rather Very Intelligent System</p>
          </div>
        </div>
        <button
          onClick={() => setStatusOpen(true)}
          className="lg:hidden p-2 rounded-lg border border-border/60 bg-card/60 hover:border-jarvis-glow/50 transition"
          aria-label="Open status panel"
        >
          <LayoutDashboard className="w-4 h-4" />
        </button>
      </header>

      {/* Main grid */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 lg:gap-6 min-h-0">
        {/* Center column: command input + log */}
        <section className="flex flex-col gap-4 min-h-0">
          <CommandInput onSubmit={handleSubmit} onMicTranscript={handleMic} disabled={thinking} />

          <div className="glass-panel rounded-2xl flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-jarvis-ok animate-glow-pulse" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Communication Log</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/60">{messages.length} entries</span>
            </div>
            <div ref={logRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-5 space-y-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} text={m.text} ts={m.ts} />
                ) : (
                  <JarvisBubble key={m.id} sections={m.sections} agent={m.agent} ts={m.ts} />
                ),
              )}
              {thinking && <ThinkingIndicator />}
            </div>
          </div>
        </section>

        {/* Right sidebar — desktop */}
        <div className="hidden lg:block min-h-0">
          <StatusPanel />
        </div>
      </main>

      {/* Mobile status drawer */}
      {statusOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-jarvis-deep/80 backdrop-blur-sm animate-fade-up"
            onClick={() => setStatusOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-[88%] max-w-sm p-4 animate-fade-up">
            <button
              onClick={() => setStatusOpen(false)}
              className="absolute top-6 right-6 z-10 p-2 rounded-lg bg-card/80 border border-border"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <StatusPanel />
          </div>
        </div>
      )}
    </div>
  );
}
