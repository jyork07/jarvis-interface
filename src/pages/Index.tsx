import { useEffect, useRef, useState } from "react";
import { AudioLines, Bot, Home, Radio, Settings as SettingsIcon, Terminal, Mic, Pause, Play, Maximize, X, MessageSquare, Diamond } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandInput } from "@/components/jarvis/CommandInput";
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
  const [view, setView] = useState("home");
  const [now, setNow] = useState(new Date());
  const [density, setDensity] = useState<"high" | "medium" | "low">("high");
  const [paused, setPaused] = useState(false);
  const [visualStats, setVisualStats] = useState({ fps: 0, links: 0 });
  const [started] = useState(Date.now());
  const [configRevision, setConfigRevision] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    const refresh = () => setConfigRevision(v => v + 1);
    window.addEventListener("jarvis:config-changed", refresh);
    return () => { clearInterval(timer); window.removeEventListener("jarvis:config-changed", refresh); };
  }, []);
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

  const endpoints = [
    { name: "TELEGRAM GATEWAY", label: "Telegram", icon: Radio, value: config.telegramEndpoint },
    { name: "OLLAMA AGENT", label: "Ollama", icon: Bot, value: config.ollamaEndpoint },
    { name: "VOICE BRIDGE", label: "Speech to text", icon: AudioLines, value: config.sttEndpoint },
    { name: "HOME ASSISTANT", label: "Home Assistant", icon: Home, value: config.homeAssistantUrl },
  ];
  const coreLabel = thinking ? "PROCESSING" : micState === "listening" ? "LISTENING" : micState === "transcribing" ? "TRANSCRIBING" : "STANDBY";
  const elapsed = Math.floor((now.getTime() - started) / 1000);
  const uptime = [Math.floor(elapsed / 3600), Math.floor(elapsed / 60) % 60, elapsed % 60].map(v => String(v).padStart(2, "0")).join(":");
  const latest = messages[messages.length - 1];
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { pushError("Fullscreen is unavailable in this window."); }
  };
  const composer = <CommandInput onSubmit={handleSubmit} onMicStart={handleMicStart} onMicStop={handleMicStop} micState={micState} disabled={thinking} voiceMode={voiceMode} />;
  const timeline = <div ref={logRef} className="scarlet-timeline scrollbar-thin" aria-live="polite">
    {messages.length === 0 && <div className="timeline-empty"><Terminal size={24} /><span>No conversation yet.</span></div>}
    {messages.map(m => m.role === "user" ? <UserBubble key={m.id} text={m.text} ts={m.ts} /> : m.role === "jarvis" ? <JarvisBubble key={m.id} sections={m.sections} agent={m.agent} ts={m.ts} /> : <SystemErrorBubble key={m.id} message={m.message} ts={m.ts} />)}
    {thinking && <ThinkingIndicator />}
  </div>;
  return (
    <div className="neural-shell" data-config-revision={configRevision}>
      <HudOrb state={orbState} level={micLevel} density={density} paused={paused} onStats={setVisualStats} />
      <div className="neural-frame">
        <div className="frame-corner corner-tl" /><div className="frame-corner corner-tr" /><div className="frame-corner corner-bl" /><div className="frame-corner corner-br" />
        <header className="neural-header">
          <div><h1>SCARLET <span>// 01</span></h1><p>NEURAL NETWORK INTERFACE</p></div>
          <div className="intelligence-badge"><Diamond size={9} /> CENTRAL INTELLIGENCE / {coreLabel}</div>
          <div className="neural-clock"><time>{now.toLocaleTimeString("en-GB")}</time><span>{now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</span></div>
        </header>
        <div className="corner-ticks" aria-hidden="true">◦ ◦ ◦ ◦ ◦</div>
        <section className="neural-panel panel-live"><h2><AudioLines size={12} /> LIVE // DATA</h2>
          <dl><div><dt>COMMAND STATUS</dt><dd>{coreLabel}</dd></div><div><dt>AI GATEWAY</dt><dd className="link-state">{configMissing ? "NOT CONFIGURED" : "UNVERIFIED"}</dd></div><div><dt>VISUAL FILAMENTS</dt><dd>{visualStats.links.toLocaleString()}</dd></div><div><dt>VOICE CHANNEL</dt><dd>{micState === "idle" ? "STANDBY" : micState.toUpperCase()}</dd></div></dl>
        </section>
        <section className="neural-panel panel-memory"><h2><MessageSquare size={12} /> CONTEXT // SESSION</h2>
          <dl><div><dt>CONVERSATION</dt><dd className="cyan-value">{messages.length ? "IN SESSION" : "EMPTY"}</dd></div><div><dt>MESSAGES</dt><dd>{messages.length}</dd></div><div><dt>MEMORY GRAPH</dt><dd className="link-state">NOT LINKED</dd></div></dl>
          <Button variant="ghost" className="panel-chat-link" onClick={() => setView("conversation")}><Terminal size={12} /> OPEN CONVERSATION</Button>
        </section>
        <section className="neural-panel panel-links"><h2><Radio size={12} /> EXTERNAL // LINKS</h2>
          {endpoints.map(e => <div className="neural-node" key={e.name}><span>{e.label.toUpperCase()}</span><span className="link-state">{e.value ? "UNVERIFIED" : "NOT LINKED"}</span></div>)}
          {["OBSIDIAN MEMORY", "TRADING 212"].map(name => <div className="neural-node" key={name}><span>{name}</span><span className="link-state">NOT LINKED</span></div>)}
          <Button variant="ghost" className="panel-chat-link" onClick={() => setSettingsOpen(true)}><SettingsIcon size={12} /> CONNECTION SETTINGS</Button>
        </section>
        <section className="neural-panel panel-controls"><h2><SettingsIcon size={12} /> SYSTEM // CONTROL</h2>
          <dl><div><dt>VISUAL ENGINE</dt><dd className="cyan-value">{paused ? "PAUSED" : "RUNNING"}</dd></div><div><dt>ANIMATION RATE</dt><dd>{paused ? 0 : visualStats.fps} FPS</dd></div><div><dt>NEURAL DENSITY</dt><dd>{density === "medium" ? "MED" : density.toUpperCase()}</dd></div></dl>
          <div className="density-controls" aria-label="Neural density">{(["high", "medium", "low"] as const).map(d => <Button key={d} variant="outline" className={cn("neural-chip", density === d && "active")} aria-pressed={density === d} onClick={() => setDensity(d)}>{d === "medium" ? "MED" : d.toUpperCase()}</Button>)}</div>
          <div className="visual-controls"><Button variant="outline" className="neural-chip" onClick={() => setPaused(p => !p)} aria-label={paused ? "Resume core" : "Pause core"} title={paused ? "Resume core" : "Pause core"}>{paused ? <Play /> : <Pause />}{paused ? "RESUME" : "PAUSE"}</Button><Button variant="outline" size="icon" className="neural-chip" onClick={fullscreen} aria-label="Fullscreen" title="Fullscreen"><Maximize /></Button></div>
        </section>
        <div className="neural-core-label">SCARLET // NEURAL CORE</div>
        <div className="neural-command">
          {thinking && <ThinkingIndicator />}
          {!thinking && latest && <div className={cn("command-result", latest.role === "system-error" && "command-error")} role="status">{latest.role === "system-error" ? latest.message : latest.role === "jarvis" ? latest.sections.map(s => s.content).join(" ") : "Command submitted"}</div>}
          <div className="command-caption"><span>COMMAND CHANNEL / {coreLabel}</span><Button variant="ghost" size="icon" onClick={toggleVoiceMode} aria-pressed={voiceMode === "continuous"} aria-label="Toggle continuous voice" title={voiceMode === "continuous" ? "Continuous voice on" : "Push to talk"}><Mic size={12} /><span>{voiceMode === "continuous" ? "LIVE" : "PTT"}</span></Button></div>
          {composer}
        </div>
        <div className="neural-sublabel">COGNITIVE NETWORK // SYNAPTIC ACTIVITY</div>
        <footer className="neural-footer"><span className="visual-dot" /><span>VISUAL {paused ? "PAUSED" : "ACTIVE"}</span><span className="footer-divider">|</span><time>{uptime}</time><span className="footer-divider">|</span><Button variant="outline" className="neural-chip" onClick={() => setSettingsOpen(true)}>CONNECTION INFO</Button><Button variant="ghost" size="icon" aria-label="Open conversation" title="Open conversation" onClick={() => setView("conversation")}><MessageSquare size={14} /></Button></footer>
      </div>
      {view === "conversation" && <div className="conversation-backdrop"><section className="conversation-view" role="dialog" aria-modal="true" aria-label="Conversation"><div className="conversation-heading"><h2>SCARLET // CONVERSATION</h2><Button variant="ghost" size="icon" aria-label="Close conversation" onClick={() => setView("home")}><X /></Button></div>{timeline}{composer}</section></div>}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
