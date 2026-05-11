import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, Mic, Radio, Settings as SettingsIcon, X, Zap } from "lucide-react";
import { CommandInput } from "@/components/jarvis/CommandInput";
import { StatusPanel } from "@/components/jarvis/StatusPanel";
import { HudOrb, OrbState } from "@/components/jarvis/HudOrb";
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
import { cn } from "@/lib/utils";

const uid = () => Math.random().toString(36).slice(2, 10);

type MicState = "idle" | "listening" | "transcribing";
type VoiceMode = "ptt" | "continuous";

export default function Index() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [micState, setMicState] = useState<MicState>("idle");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("ptt");
  const [micLevel, setMicLevel] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MicRecorder | null>(null);
  const voiceModeRef = useRef(voiceMode);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

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
      // Restart listening if in continuous mode
      if (voiceModeRef.current === "continuous") {
        setTimeout(() => startListening("continuous"), 400);
      }
    }
  };

  const handleSubmit = (text: string) => {
    setMessages((m) => [...m, { id: uid(), role: "user", text, ts: new Date() }]);
    runPipeline(text);
  };

  const finalizeRecording = async () => {
    const rec = recorderRef.current;
    if (!rec) {
      setMicState("idle");
      return;
    }
    setMicState("transcribing");
    setMicLevel(0);
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

  const startListening = async (mode: VoiceMode = voiceModeRef.current) => {
    const config = loadConfig();
    if (!config.sttEndpoint) {
      pushError("STT service unavailable. Configure the STT endpoint in settings.");
      return;
    }
    if (recorderRef.current) return;
    try {
      const rec = new MicRecorder();
      await rec.start({
        onLevel: (lvl) => setMicLevel(lvl),
        ...(mode === "continuous"
          ? {
              silenceMs: 1400,
              silenceThreshold: 0.022,
              onSilenceStop: () => finalizeRecording(),
            }
          : {}),
      });
      recorderRef.current = rec;
      setMicState("listening");
    } catch (e: any) {
      pushError(e?.message ?? "Microphone access denied");
      setMicState("idle");
    }
  };

  const handleMicStart = () => startListening("ptt");
  const handleMicStop = () => finalizeRecording();

  const toggleVoiceMode = async () => {
    const next: VoiceMode = voiceMode === "ptt" ? "continuous" : "ptt";
    // Stop any active recording when switching
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
      setMicState("idle");
      setMicLevel(0);
    }
    setVoiceMode(next);
    voiceModeRef.current = next;
    if (next === "continuous") {
      startListening("continuous");
    }
  };

  const config = loadConfig();
  const configMissing = !config.telegramEndpoint;

  const orbState: OrbState = thinking
    ? "thinking"
    : micState === "listening"
    ? "listening"
    : micState === "transcribing"
    ? "thinking"
    : "idle";

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
            onClick={toggleVoiceMode}
            title={voiceMode === "ptt" ? "Switch to continuous voice" : "Switch to push-to-talk"}
            className={cn(
              "px-3 h-9 rounded-lg border text-[10px] uppercase tracking-[0.16em] flex items-center gap-1.5 transition",
              voiceMode === "continuous"
                ? "border-jarvis-glow/60 bg-jarvis-glow/10 text-jarvis-glow shadow-[0_0_16px_hsl(var(--jarvis-glow)/0.3)]"
                : "border-border/60 bg-card/60 text-foreground/80 hover:border-jarvis-glow/40",
            )}
          >
            {voiceMode === "continuous" ? (
              <>
                <Zap className="w-3 h-3" /> Live
              </>
            ) : (
              <>
                <Mic className="w-3 h-3" /> PTT
              </>
            )}
          </button>
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
            voiceMode={voiceMode}
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
                {voiceMode === "continuous" && (
                  <span className="ml-2 flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-jarvis-glow">
                    <Radio className="w-3 h-3 animate-pulse" /> Live voice
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/60">
                {messages.length} {messages.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            <div ref={logRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-5 space-y-6">
              {messages.length === 0 && !thinking && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6 py-8 gap-6">
                  <HudOrb state={orbState} level={micLevel} size={260} />
                  <div className="max-w-sm">
                    <h2 className="text-sm font-medium text-foreground/90 mb-1 tracking-wider uppercase">
                      {orbState === "idle" ? "Awaiting directive" : orbState === "listening" ? "I'm listening" : "Working on it"}
                    </h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {configMissing
                        ? "No backend endpoints are configured. Open settings to connect the Telegram, STT, Ollama, and Home Assistant services."
                        : voiceMode === "continuous"
                        ? "Live voice mode is on. Speak naturally — I'll auto-send when you pause."
                        : "Type a command or hold the mic. All requests run through your real endpoints."}
                    </p>
                  </div>
                  {configMissing && (
                    <button
                      onClick={() => setSettingsOpen(true)}
                      className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-br from-jarvis-glow to-jarvis-teal text-jarvis-deep shadow-[0_0_24px_hsl(var(--jarvis-glow)/0.3)] hover:shadow-[0_0_32px_hsl(var(--jarvis-glow)/0.55)] transition"
                    >
                      Configure endpoints
                    </button>
                  )}
                </div>
              )}

              {messages.length > 0 && (
                <div className="flex justify-center pb-2">
                  <HudOrb state={orbState} level={micLevel} size={120} />
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
