// Configuration store for real endpoints. Persisted to localStorage.
// No mock fallbacks — if an endpoint is missing, callers must surface a clear error.

export type JarvisConfig = {
  telegramEndpoint: string;
  sttEndpoint: string;
  ollamaEndpoint: string;
  homeAssistantUrl: string;
  homeAssistantToken: string;
};

const STORAGE_KEY = "jarvis.config.v1";

const empty: JarvisConfig = {
  telegramEndpoint: "",
  sttEndpoint: "",
  ollamaEndpoint: "",
  homeAssistantUrl: "",
  homeAssistantToken: "",
};

export function loadConfig(): JarvisConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...empty };
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return { ...empty };
  }
}

export function saveConfig(c: JarvisConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  window.dispatchEvent(new CustomEvent("jarvis:config-changed"));
}

export function isConfigured(c: JarvisConfig, key: keyof JarvisConfig): boolean {
  return Boolean(c[key]?.trim());
}
