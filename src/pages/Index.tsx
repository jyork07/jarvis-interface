import { useEffect, useRef, useState } from "react";
import { Activity, ArrowUpRight, AudioLines, Bot, CircleDot, Clock3, Database, Diamond, Gauge, Home, Layers3, Mic, Radio, Settings as SettingsIcon, ShieldCheck, SlidersHorizontal, Terminal, Workflow, Wrench, Zap } from "lucide-react";
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
  const navigation = [
    { id: "home", label: "Home / Core", icon: CircleDot },
    { id: "conversation", label: "Conversation", icon: Terminal },
    { id: "memory", label: "Memory", icon: Database, unavailable: true },
    { id: "skills", label: "Skills", icon: Layers3, unavailable: true },
    { id: "tools", label: "Tools", icon: Wrench, unavailable: true },
    { id: "automations", label: "Automations", icon: Workflow, unavailable: true },
    { id: "services", label: "Services", icon: Radio },
    { id: "diagnostics", label: "Diagnostics", icon: Activity },
    { id: "config", label: "System Config", icon: SlidersHorizontal },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];
  const lastReply = [...messages].reverse().find(m => m.role === "jarvis");
  const coreLabel = thinking ? "PROCESSING" : micState === "listening" ? "LISTENING" : micState === "transcribing" ? "TRANSCRIBING" : configMissing ? "AWAITING LINK" : "SCARLET STANDBY";
  const composer = <CommandInput onSubmit={handleSubmit} onMicStart={handleMicStart} onMicStop={handleMicStop} micState={micState} disabled={thinking} voiceMode={voiceMode} />;
  const timeline = <div ref={logRef} className="scarlet-timeline scrollbar-thin" aria-live="polite">
    {messages.length === 0 && <div className="timeline-empty"><Terminal size={24} /><span>No conversation yet.</span></div>}
    {messages.map(m => m.role === "user" ? <UserBubble key={m.id} text={m.text} ts={m.ts} /> : m.role === "jarvis" ? <JarvisBubble key={m.id} sections={m.sections} agent={m.agent} ts={m.ts} /> : <SystemErrorBubble key={m.id} message={m.message} ts={m.ts} />)}
    {thinking && <ThinkingIndicator />}
  </div>;
  return (
    <div className="scarlet-shell" data-config-revision={configRevision}>
      <div className="scarlet-layout">
        <aside className="scarlet-sidebar">
          <div className="scarlet-brand"><Diamond size={20} /><span>SCARLET <b>HUD</b></span></div>
          <div className="sidebar-caption">CONTROL INTERFACE / 01</div>
          <nav aria-label="SCARLET screens">
            {navigation.map(item => <Button key={item.id} variant="ghost" className="scarlet-nav" aria-current={view === item.id ? "page" : undefined} disabled={item.unavailable} title={item.unavailable ? "Service not connected" : item.label} onClick={() => item.id === "config" || item.id === "settings" ? setSettingsOpen(true) : setView(item.id)}><item.icon size={15} /><span>{item.label}</span>{view === item.id && <span className="nav-indicator" />}</Button>)}
          </nav>
          <div className="sidebar-bottom"><span className="scarlet-eyebrow">JARVIS / V3.0</span><div><span className="status-dot" />{configMissing ? "Configuration required" : "Endpoints configured"}</div><span className="sidebar-version">SCARLET CONTROL SYSTEM</span></div>
        </aside>
        <div className="scarlet-workspace">
          <header className="scarlet-header">
            <div><span className="scarlet-eyebrow">LIVE CONTROL SYSTEM <span className="text-muted-foreground">/ JARVIS BRIDGE</span></span><h1>SCARLET <span>{configMissing ? "awaits connection" : "is on standby"}</span></h1></div>
            <div className="header-status"><span className="scarlet-badge"><span className="status-dot" />LINK · {configMissing ? "NOT CONFIGURED" : "UNVERIFIED"}</span><Button variant="ghost" size="icon" title="Open settings" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><SettingsIcon /></Button></div>
          </header>
          <main className="scarlet-main">
            <div className="view-heading"><div className="flex items-center gap-2"><span className="text-primary">◇</span><span>{view === "home" ? "CORE OVERVIEW" : view.toUpperCase()}</span></div><span className="flex items-center gap-2"><Clock3 size={12} />{now.toLocaleTimeString("en-GB")}<span className="hidden sm:inline"> / {now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</span></span></div>
            {view === "home" && <>
              <div className="core-grid">
                <section className="neural-stage" aria-label="Scarlet neural core">
                  <div className="stage-heading"><span className="scarlet-eyebrow">NEURAL CORE / 01</span><h2>SCARLET CORE</h2></div>
                  <span className="stage-index">SYS.001 <span className="text-primary">+</span></span>
                  <div className="stage-core"><HudOrb state={orbState} level={micLevel} size={340} /><div className="core-presence"><strong>{coreLabel}</strong><span>{configMissing ? "GATEWAY CONFIGURATION REQUIRED" : "READY FOR YOUR DIRECTIVE"}</span></div></div>
                  <div className="stage-coordinate">NEURAL INTERFACE <span>01 / CORE</span></div>
                  <div className="core-telemetry">{[["GATEWAY", configMissing ? "NO LINK" : "CONFIGURED"], ["AGENT", config.ollamaEndpoint ? "UNVERIFIED" : "NOT LINKED"], ["VOICE", micState === "listening" ? "LISTENING" : config.sttEndpoint ? "STANDBY" : "NOT LINKED"], ["ACTIVE TASK", thinking ? "PROCESSING" : "IDLE"]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
                </section>
                <div className="core-right">
                  <section className="hud-section activity-section"><div className="section-title"><div><span className="scarlet-eyebrow">ACTIVITY / LIVE</span><h2>Recent activity</h2></div><Activity size={17} className="text-primary" /></div>
                    {messages.length === 0 ? <div className="activity-empty"><div className="empty-cross">+</div><p>No sessions yet</p><span>Awaiting the first directive</span></div> : <div className="recent-events">{messages.slice(-3).reverse().map(m => <div key={m.id}><span className="scarlet-eyebrow">{m.role === "system-error" ? "SYSTEM" : m.role === "user" ? "COMMAND" : "RESPONSE"} / {m.ts.toLocaleTimeString("en-GB")}</span><p>{m.role === "user" ? m.text : m.role === "system-error" ? m.message : m.sections.map(s => s.content).join(" ")}</p></div>)}</div>}
                    <Button variant="ghost" className="section-link" onClick={() => setView("conversation")}>Open conversation<ArrowUpRight size={14} /></Button>
                  </section>
                  <section className="hud-section health-section"><div className="section-title"><div><span className="scarlet-eyebrow">SYSTEM TELEMETRY</span><h2>System health</h2></div><Gauge size={17} className="text-primary" /></div><dl className="health-list"><div><dt>Bridge connection</dt><dd>{configMissing ? "Not configured" : "Unverified"}</dd></div><div><dt>Voice channel</dt><dd>{micState === "idle" ? config.sttEndpoint ? "Configured" : "Not configured" : micState}</dd></div><div><dt>Agent response</dt><dd>{thinking ? "Processing" : lastReply ? "Received" : "No activity"}</dd></div></dl><div className="health-foot"><ShieldCheck size={12} /><span>{configMissing ? "Waiting for a real endpoint" : "Connection verified only on response"}</span></div></section>
                </div>
              </div>
              <section className="orbit-section"><div className="section-title"><h2>Orbiting systems</h2><span className="scarlet-eyebrow">ADAPTERS / {endpoints.filter(e => e.value).length} CONFIGURED</span></div><div className="orbit-grid">{endpoints.map(e => <Button key={e.name} variant="outline" className="orbit-item" onClick={() => setSettingsOpen(true)}><e.icon size={18} /><div><strong>{e.name}</strong><span><i className="status-dot" />{e.value ? "CONFIGURED · UNVERIFIED" : "NOT CONFIGURED"}</span></div><ArrowUpRight size={13} /></Button>)}</div></section>
              <section className="command-section"><div className="section-title"><div className="flex items-center gap-3"><div className="voice-icon"><Mic size={18} /></div><div><span className="scarlet-eyebrow">VOICE / COMMAND CHANNEL</span><p>{micState === "listening" ? "Listening…" : micState === "transcribing" ? "Transcribing…" : "What’s on your mind?"}</p></div></div><Button variant="outline" size="sm" onClick={toggleVoiceMode} aria-pressed={voiceMode === "continuous"} title="Toggle continuous voice">{voiceMode === "continuous" ? <Zap /> : <Mic />}{voiceMode === "continuous" ? "LIVE VOICE" : "PUSH TO TALK"}</Button></div>{composer}{messages.length > 0 && <div className="latest-notice" role="status">{thinking ? "Processing your command…" : messages[messages.length - 1]?.role === "system-error" ? "Command could not be completed. See conversation for details." : "Command added to conversation."}<Button variant="link" size="sm" onClick={() => setView("conversation")}>View conversation<ArrowUpRight /></Button></div>}</section>
            </>}
            {view === "conversation" && <section className="conversation-view"><div className="section-title"><h2>Conversation</h2><Button variant="outline" size="sm" onClick={toggleVoiceMode}><Mic />{voiceMode === "continuous" ? "LIVE VOICE" : "PUSH TO TALK"}</Button></div>{timeline}{composer}</section>}
            {view === "services" && <section className="services-view"><div className="section-title"><h2>Connected services</h2><Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}><SettingsIcon />Configure</Button></div>{endpoints.map(e => <div className="service-row" key={e.name}><e.icon size={22} /><div><h3>{e.label}</h3><p>{e.value ? "Endpoint configured · connection not verified" : "Configuration required"}</p></div><Button variant="ghost" size="icon" aria-label={"Configure " + e.label} onClick={() => setSettingsOpen(true)}><ArrowUpRight /></Button></div>)}</section>}
            {view === "diagnostics" && <section className="diagnostics-view"><div className="section-title"><h2>Gateway log</h2><span className="scarlet-eyebrow">{messages.filter(m => m.role === "system-error").length} EVENTS</span></div>{messages.filter(m => m.role === "system-error").length === 0 ? <div className="timeline-empty"><Activity /><span>No errors reported in this session.</span></div> : messages.map(m => m.role === "system-error" ? <div className="diagnostic-line" key={m.id}><time>{m.ts.toLocaleTimeString("en-GB")}</time><span>{m.message}</span></div> : null)}</section>}
          </main>
          <footer className="scarlet-footer"><span>SCARLET HUD <span className="text-primary">/</span> JARVIS CONTROL SYSTEM</span><span><span className="status-dot" />REAL ENDPOINTS ONLY</span></footer>
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
