// Service layer for backend integration. Swap mocks with real endpoints later.

export type AgentSection = {
  label: "Observation" | "Interpretation" | "Recommended Action" | "Final Output";
  content: string;
};

export type JarvisResponse = {
  sections: AgentSection[];
  agent: string;
};

const MOCK_RESPONSES: Record<string, JarvisResponse> = {
  default: {
    agent: "Ollama",
    sections: [
      { label: "Observation", content: "I parsed your request and cross-referenced it against the active KNOWLEDGE_BASE.md protocol. No ambiguity detected in the intent." },
      { label: "Interpretation", content: "You're looking for a concise, actionable response — not a research paper. I'll prioritize clarity and the smallest viable next step." },
      { label: "Recommended Action", content: "Proceed with the suggested path below. I've left contextual hooks in case you'd like to drill deeper into any single point." },
      { label: "Final Output", content: "Done. Standing by for the next directive, sir." },
    ],
  },
  weather: {
    agent: "Ollama",
    sections: [
      { label: "Observation", content: "Local sensor mesh reports clear skies, 21°C, humidity 54%. No precipitation events in the next 6 hours." },
      { label: "Interpretation", content: "Conditions favor outdoor activity. UV index is moderate around midday." },
      { label: "Final Output", content: "Pleasant afternoon ahead — light layer recommended after 19:00." },
    ],
  },
  lights: {
    agent: "HomeAutomation",
    sections: [
      { label: "Observation", content: "Three zones are currently active: Living Room, Kitchen, Study. Total draw: 142W." },
      { label: "Recommended Action", content: "Dim Living Room to 40% to match ambient lux levels and reduce eye strain." },
      { label: "Final Output", content: "Lighting profile 'Evening Calm' is one tap away. Shall I deploy it?" },
    ],
  },
};

function pickMock(text: string): JarvisResponse {
  const t = text.toLowerCase();
  if (t.includes("weather") || t.includes("temperature")) return MOCK_RESPONSES.weather;
  if (t.includes("light") || t.includes("lamp")) return MOCK_RESPONSES.lights;
  return MOCK_RESPONSES.default;
}

// Placeholder: send text input to Telegram bot wrapper / Ollama pipeline
export async function sendToTelegramPipeline(text: string): Promise<JarvisResponse> {
  // TODO: replace with real fetch to /api/telegram or edge function
  await new Promise((r) => setTimeout(r, 1400 + Math.random() * 800));
  return pickMock(text);
}

// Placeholder: route mic audio to STT, then into the pipeline
export async function transcribeAudio(_audioBlob?: Blob): Promise<string> {
  await new Promise((r) => setTimeout(r, 900));
  const samples = [
    "What's the status of the home network?",
    "Jarvis, dim the living room lights.",
    "Brief me on today's weather.",
    "Run a system diagnostic.",
  ];
  return samples[Math.floor(Math.random() * samples.length)];
}
