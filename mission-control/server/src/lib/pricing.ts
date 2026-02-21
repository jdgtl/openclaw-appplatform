export const MODEL_PRICING: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  "claude-haiku-4-5": { inputPer1k: 0.001, outputPer1k: 0.005 },
  "claude-sonnet-4-5": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-opus-4-5": { inputPer1k: 0.015, outputPer1k: 0.075 },
  "openai-gpt-o1s-128k": { inputPer1k: 0.015, outputPer1k: 0.06 },
  "openai-gpt-4o-128k": { inputPer1k: 0.005, outputPer1k: 0.015 },
};

export function modelCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;
}
