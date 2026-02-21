// Model pricing per 1K tokens. Models not listed here get $0 cost.
// Gradient/DO-hosted models are free (serverless AI inference).
export const MODEL_PRICING: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  // Anthropic
  "claude-haiku-4-5": { inputPer1k: 0.001, outputPer1k: 0.005 },
  "claude-sonnet-4-5": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-sonnet-4-6": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-opus-4-5": { inputPer1k: 0.015, outputPer1k: 0.075 },
  "claude-opus-4-6": { inputPer1k: 0.015, outputPer1k: 0.075 },
  // OpenAI
  "gpt-5.3-codex": { inputPer1k: 0.00175, outputPer1k: 0.014 },
  "openai-gpt-o1s-128k": { inputPer1k: 0.015, outputPer1k: 0.06 },
  "openai-gpt-4o-128k": { inputPer1k: 0.005, outputPer1k: 0.015 },
  "openai-gpt-4o-mini-128k": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  // Google
  "gemini-2.0-flash": { inputPer1k: 0.0001, outputPer1k: 0.0004 },
  "gemini-2.5-pro": { inputPer1k: 0.00125, outputPer1k: 0.01 },
};

// Substring patterns for models known to be free (Gradient, Meta, etc.)
const FREE_PATTERNS = ["gradient", "llama", "deepseek-r1"];

export function modelCost(model: string, inputTokens: number, outputTokens: number): number {
  // Check explicit pricing first
  const pricing = MODEL_PRICING[model];
  if (pricing) {
    return (inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;
  }
  // Substring match for model variants (e.g. "openai-codex/gpt-5.3-codex" → "gpt-5.3-codex")
  const lower = model.toLowerCase();
  for (const [key, p] of Object.entries(MODEL_PRICING)) {
    if (lower.includes(key)) {
      return (inputTokens / 1000) * p.inputPer1k + (outputTokens / 1000) * p.outputPer1k;
    }
  }
  // Known free models return 0 explicitly (not "unknown")
  if (FREE_PATTERNS.some((p) => lower.includes(p))) return 0;
  // Unknown models: return 0 (conservative — better than wrong estimates)
  return 0;
}
