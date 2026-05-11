import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, Settings as SettingsIcon, X } from "lucide-react";
import { CommandInput } from "@/components/jarvis/CommandInput";
import { StatusPanel } from "@/components/jarvis/StatusPanel";
import {
  ChatMessage,
  JarvisBubble,
  SystemErrorBubble,
  ThinkingIndicator,
  UserBubble,
} from "@/components/jarvis/ChatMessage";
import { SettingsDialog } from "@/components/jarvis/SettingsDialog";
import { sendToTelegramPipeline, transcribeAudio } from "@/services/jarvis";
import { loadConfig } from "@/services/config";
import { MicRecorder } from "@/services/mic";

const uid = () => Math.random().toString(36).slice(2, 10);

export default function Index() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [micState, setMicState] = useState<"idle" | "listening" | "transcribing">("idle");
  const logRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MicRecorder | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const pushError = (message: string) =>
    setMessages((m) => [...m, { id: uid(), role: "system-error", message, ts: new Date() }]);

  const runPipeline = async (text: string) => {
    const config = loadConfig();
    if (!config.telegramEndpoint) {
      pushError("Telegram endpoint not configured. Open settings to add a real endpoint.");
      return;
    }
    setThinking(true);
    try {
      const res = await sendToTelegramPipeline(text, config);
      setMessages((m) => [
        ...m,
        { id: uid(), role: "jarvis", agent: res.agent, sections: res.sections, ts: new Date() },
      ]);
    } catch (e: any) {
      pushError(e?.message ?? "Backend request failed");
    } finally {
      setThinking(false);
    }
  };

  const handleSubmit = (text: string) => {
    setMessages((m) => [...m, { id: uid(), role: "user", text, ts: new Date() }]);
    runPipeline(text);
  };

  const handleMicStart = async () => {
    const config = loadConfig();
    if (!config.sttEndpoint) {
      pushError("STT service unavailable. Configure the STT endpoint in settings.");
      return;
    }
    try {
      const rec = new MicRecorder();
      await rec.start();
      recorderRef.current = rec;
      setMicState("listening");
    } catch (e: any) {
      pushError(e?.message ?? "Microphone access denied");
      setMicState("idle");
    }
  };

  const handleMicStop = async () => {
    const rec = recorderRef.current;
    if (!rec) {
      setMicState("idle");
      return;
    }
    setMicState("transcribing");
    try {
      const blob = await rec.stop();
      recorderRef.current = null;
      const config = loadConfig();
      const transcript = await transcribeAudio(blob, config);
      setMessages((m) => [...m, { id: uid(), role: "user", text: transcript, ts: new Date() }]);
      setMicState("idle");
      await runPipeline(transcript);
    } catch (e: any) {
      pushError(e?.message ?? "STT service unavailable");
      setMicState("idle");
    }
  };

  const config = loadConfig();
  const configMissing = !config.telegramEndpoint;

  return (
    <div className="min-h-screen w-full flex flex-col">
      <header className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-jarvis-glow to-jarvis-teal flex items-center justify-center shadow-[0_0_24px_hsl(var(--jarvis-glow)/0.4)]">
            <span className="text-jarvis-deep font-bold text-sm">J</span>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background animate-glow-pulse ${
                configMissing ? "bg-jarvis-warn" : "bg-jarvis-ok"
              }`}
            />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide glow-text">JARVIS</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Just a Rather Very Intelligent System
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg border border-border/60 bg-card/60 hover:border-jarvis-glow/50 transition"
            aria-label="Open settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setStatusOpen(true)}
            className="lg:hidden p-2 rounded-lg border border-border/60 bg-card/60 hover:border-jarvis-glow/50 transition"
            aria-label="Open status panel"
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 lg:gap-6 min-h-0">
        <section className="flex flex-col gap-4 min-h-0">
          <CommandInput
            onSubmit={handleSubmit}
            onMicStart={handleMicStart}
            onMicStop={handleMicStop}
            micState={micState}
            disabled={thinking}
          />

          <div className="glass-panel rounded-2xl flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full animate-glow-pulse ${
                    configMissing ? "bg-jarvis-warn" : "bg-jarvis-ok"
                  }`}
                />
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Communication Log
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/60">
                {messages.length} {messages.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            <div ref={logRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-5 space-y-6">
              {messages.length === 0 && !thinking && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-jarvis-glow/20 to-jarvis-teal/10 border border-jarvis-glow/20 flex items-center justify-center mb-4 animate-glow-pulse">
                    <span className="text-2xl font-light text-jarvis-glow glow-text">J</span>
                  </div>
                  <h2 className="text-sm font-medium text-foreground/90 mb-1">Awaiting directive</h2>
                  <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                    {configMissing
                      ? "No backend endpoints are configured. Open settings to connect the Telegram, STT, Ollama, and Home Assistant services."
                      : "Type a command or tap the microphone. All requests are routed through your configured real endpoints."}
                  </p>
                  {configMissing && (
                    <button
                      onClick={() => setSettingsOpen(true)}
                      className="mt-5 px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-br from-jarvis-glow to-jarvis-teal text-jarvis-deep shadow-[0_0_24px_hsl(var(--jarvis-glow)/0.3)] hover:shadow-[0_0_32px_hsl(var(--jarvis-glow)/0.55)] transition"
                    >
                      Configure endpoints
                    </button>
                  )}
                </div>
              )}
              {messages.map((m) => {
                if (m.role === "user") return <UserBubble key={m.id} text={m.text} ts={m.ts} />;
                if (m.role === "jarvis")
                  return <JarvisBubble key={m.id} sections={m.sections} agent={m.agent} ts={m.ts} />;
                return <SystemErrorBubble key={m.id} message={m.message} ts={m.ts} />;
              })}
              {thinking && <ThinkingIndicator />}
            </div>
          </div>
        </section>

        <div className="hidden lg:block min-h-0">
          <StatusPanel onOpenSettings={() => setSettingsOpen(true)} />
        </div>
      </main>

      {statusOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-jarvis-deep/80 backdrop-blur-sm animate-fade-up"
            onClick={() => setStatusOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-[88%] max-w-sm p-4 animate-fade-up overflow-y-auto scrollbar-thin">
            <button
              onClick={() => setStatusOpen(false)}
              className="absolute top-6 right-6 z-10 p-2 rounded-lg bg-card/80 border border-border"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <StatusPanel
              onOpenSettings={() => {
                setStatusOpen(false);
                setSettingsOpen(true);
              }}
            />
          </div>
        </div>
      )}

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
