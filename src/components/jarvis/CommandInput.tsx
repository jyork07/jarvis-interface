import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Mic, Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandInputProps {
  onSubmit: (text: string) => void;
  onMicTranscript: () => Promise<void>;
  disabled?: boolean;
}

export function CommandInput({ onSubmit, onMicTranscript, disabled }: CommandInputProps) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [text]);

  const submit = () => {
    const v = text.trim();
    if (!v || disabled) return;
    onSubmit(v);
    setText("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleMic = async () => {
    if (listening || disabled) return;
    setListening(true);
    try {
      await onMicTranscript();
    } finally {
      setListening(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-3 sm:p-4">
      <div className="flex items-end gap-2 sm:gap-3">
        {/* Mic button */}
        <button
          type="button"
          onClick={handleMic}
          disabled={disabled}
          aria-label={listening ? "Listening" : "Activate microphone"}
          className={cn(
            "relative shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-300",
            "border border-border/60 bg-card/60 hover:bg-card hover:border-jarvis-glow/50",
            listening && "bg-jarvis-glow/15 border-jarvis-glow animate-pulse-ring",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {listening ? (
            <Square className="w-5 h-5 text-jarvis-glow fill-jarvis-glow" />
          ) : (
            <Mic className={cn("w-5 h-5 transition-colors", "text-foreground/80")} />
          )}
        </button>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={ref}
            value={listening ? "" : text}
            disabled={listening || disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            placeholder={listening ? "Listening…" : "Hey Jarvis, what can I help you with?"}
            className={cn(
              "w-full resize-none bg-transparent outline-none px-2 py-3 text-base sm:text-lg",
              "placeholder:text-muted-foreground/60 text-foreground",
              "scrollbar-thin",
            )}
          />
          {listening && (
            <div className="absolute inset-x-2 bottom-2 flex items-center gap-1 h-6">
              {[...Array(28)].map((_, i) => (
                <span
                  key={i}
                  className="flex-1 bg-jarvis-glow rounded-full animate-thinking-dot"
                  style={{
                    height: `${20 + Math.sin(i) * 60}%`,
                    animationDelay: `${i * 40}ms`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || disabled || listening}
          aria-label="Send"
          className={cn(
            "shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all",
            "bg-gradient-to-br from-jarvis-glow to-jarvis-teal text-jarvis-deep",
            "shadow-[0_0_24px_hsl(var(--jarvis-glow)/0.3)] hover:shadow-[0_0_32px_hsl(var(--jarvis-glow)/0.55)]",
            "disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed",
          )}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      <div className="px-2 pt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/60">
        <span>Press <kbd className="px-1 py-0.5 rounded border border-border/60 text-foreground/70 font-mono normal-case">Enter</kbd> to send · <kbd className="px-1 py-0.5 rounded border border-border/60 text-foreground/70 font-mono normal-case">Shift+Enter</kbd> newline</span>
        <span className="hidden sm:inline">Secure channel · End-to-End</span>
      </div>
    </div>
  );
}
