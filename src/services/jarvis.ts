// Real endpoint clients. No mocks. Every function either returns the real
// response or throws an Error whose message is suitable for the UI.

import { JarvisConfig } from "./config";

export type AgentSection = {
  label: "Observation" | "Interpretation" | "Recommended Action" | "Final Output" | "Response";
  content: string;
};

export type JarvisResponse = {
  sections: AgentSection[];
  agent: string;
};

// ─── Telegram pipeline ──────────────────────────────────────────────────────
// Sends user text to the configured Telegram wrapper endpoint. Expected to
// proxy through to the Telegram bot + Ollama and return a JSON payload.
export async function sendToTelegramPipeline(
  text: string,
  config: JarvisConfig,
  signal?: AbortSignal,
): Promise<JarvisResponse> {
  if (!config.telegramEndpoint) throw new Error("Telegram endpoint not configured");

  const res = await fetch(config.telegramEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, source: "jarvis-gui" }),
    signal,
  });

  if (!res.ok) throw new Error(`Telegram endpoint error (${res.status})`);

  const data = await res.json().catch(() => {
    throw new Error("Telegram endpoint returned non-JSON response");
  });

  return normalizeResponse(data);
}

// ─── Ollama direct (optional, used when explicitly targeted) ────────────────
export async function sendToOllama(
  prompt: string,
  config: JarvisConfig,
  signal?: AbortSignal,
): Promise<JarvisResponse> {
  if (!config.ollamaEndpoint) throw new Error("Ollama agent not reachable");

  const res = await fetch(config.ollamaEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal,
  });

  if (!res.ok) throw new Error(`Ollama endpoint error (${res.status})`);
  const data = await res.json().catch(() => {
    throw new Error("Ollama endpoint returned non-JSON response");
  });
  return normalizeResponse(data, "Ollama");
}

// ─── STT ────────────────────────────────────────────────────────────────────
export async function transcribeAudio(
  audioBlob: Blob,
  config: JarvisConfig,
  signal?: AbortSignal,
): Promise<string> {
  if (!config.sttEndpoint) throw new Error("STT service unavailable");

  const form = new FormData();
  form.append("audio", audioBlob, "input.webm");

  const res = await fetch(config.sttEndpoint, {
    method: "POST",
    body: form,
    signal,
  });

  if (!res.ok) throw new Error(`STT service error (${res.status})`);
  const data = await res.json().catch(() => {
    throw new Error("STT service returned non-JSON response");
  });

  const transcript: unknown = data.text ?? data.transcript ?? data.result;
  if (typeof transcript !== "string" || !transcript.trim()) {
    throw new Error("STT service returned no transcript");
  }
  return transcript.trim();
}

// ─── Home Assistant ─────────────────────────────────────────────────────────
export type HomeAssistantStatus = {
  ok: boolean;
  message: string;
  details?: { entityId: string; state: string }[];
};

export async function fetchHomeAssistantStatus(
  config: JarvisConfig,
  signal?: AbortSignal,
): Promise<HomeAssistantStatus> {
  if (!config.homeAssistantUrl || !config.homeAssistantToken) {
    throw new Error("Home Assistant unavailable");
  }

  const url = config.homeAssistantUrl.replace(/\/$/, "") + "/api/";
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.homeAssistantToken}` },
    signal,
  });

  if (!res.ok) throw new Error(`Home Assistant error (${res.status})`);
  const data = await res.json().catch(() => null);
  return {
    ok: true,
    message: data?.message ?? "API running",
  };
}

export async function callHomeAssistantService(
  domain: string,
  service: string,
  serviceData: Record<string, unknown>,
  config: JarvisConfig,
): Promise<unknown> {
  if (!config.homeAssistantUrl || !config.homeAssistantToken) {
    throw new Error("Home Assistant unavailable");
  }
  const url =
    config.homeAssistantUrl.replace(/\/$/, "") + `/api/services/${domain}/${service}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.homeAssistantToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(serviceData),
  });
  if (!res.ok) throw new Error(`Home Assistant service error (${res.status})`);
  return res.json();
}

// ─── Response normalization ─────────────────────────────────────────────────
function normalizeResponse(data: any, defaultAgent = "Ollama"): JarvisResponse {
  // Backend may return either { sections, agent } or { text } or { response }.
  if (Array.isArray(data?.sections)) {
    return {
      agent: typeof data.agent === "string" ? data.agent : defaultAgent,
      sections: data.sections
        .filter((s: any) => s && typeof s.content === "string")
        .map((s: any) => ({
          label: (s.label as AgentSection["label"]) ?? "Response",
          content: s.content,
        })),
    };
  }

  const text: string | undefined =
    typeof data === "string"
      ? data
      : data?.text ?? data?.response ?? data?.message ?? data?.result;

  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Backend returned an empty response");
  }

  return {
    agent: typeof data?.agent === "string" ? data.agent : defaultAgent,
    sections: [{ label: "Response", content: text.trim() }],
  };
}
