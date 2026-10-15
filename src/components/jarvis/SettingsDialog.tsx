import { useEffect, useState } from "react";
import { JarvisConfig, loadConfig, saveConfig } from "@/services/config";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
}

const FIELDS: { key: keyof JarvisConfig; label: string; placeholder: string; type?: string; hint?: string }[] = [
  {
    key: "telegramEndpoint",
    label: "Telegram Endpoint",
    placeholder: "https://your-backend.example.com/telegram",
    hint: "POST endpoint that proxies user text into the Telegram bot + Ollama pipeline.",
  },
  {
    key: "sttEndpoint",
    label: "STT Endpoint",
    placeholder: "https://your-backend.example.com/stt",
    hint: "Multipart POST endpoint that returns { text } for an uploaded audio blob.",
  },
  {
    key: "ollamaEndpoint",
    label: "Ollama / Backend Endpoint",
    placeholder: "https://your-backend.example.com/ollama",
    hint: "Optional. Direct reasoning agent endpoint for explicit Ollama calls.",
  },
  {
    key: "homeAssistantUrl",
    label: "Home Assistant URL",
    placeholder: "http://192.168.0.60:8123",
    hint: "Only called when a smart-home function is explicitly requested.",
  },
  {
    key: "homeAssistantToken",
    label: "Home Assistant Bearer Token",
    placeholder: "Long-lived access token",
    type: "password",
  },
];

export function SettingsDialog({ open, onClose }: Props) {
  const [config, setConfig] = useState<JarvisConfig>(() => loadConfig());

  useEffect(() => {
    if (open) setConfig(loadConfig());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open, onClose]);

  if (!open) return null;

  const save = () => {
    saveConfig(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-jarvis-deep/80 backdrop-blur-md animate-fade-up" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="endpoint-title" className="relative glass-panel rounded-sm w-full max-w-lg max-h-[90vh] flex flex-col animate-fade-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div>
            <h2 id="endpoint-title" className="text-sm font-semibold glow-text">Endpoint Configuration</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
              Real endpoints only · no mock fallbacks
            </p>
          </div>
          <Button variant="outline" size="icon"
            onClick={onClose}
            className="p-2 rounded-lg border border-border/60 bg-card/60 hover:border-jarvis-glow/50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={f.key} className="text-[10px] uppercase text-muted-foreground block mb-1.5">
                {f.label}
              </label>
              <input
                id={f.key}
                type={f.type ?? "text"}
                value={config[f.key]}
                onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                spellCheck={false}
                autoComplete="off"
                className="w-full bg-input/60 border border-border/60 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-jarvis-glow/60 focus:bg-input transition"
              />
              {f.hint && <p className="text-[10px] text-muted-foreground/70 mt-1">{f.hint}</p>}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border/40 flex justify-end gap-2">
          <Button variant="outline"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border border-border/60 bg-card/60 hover:bg-card transition"
          >
            Cancel
          </Button>
          <Button
            onClick={save}
            className="rounded-sm"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
