// Unwrap the nested tool invoke response to get the actual data
// Gateway returns { ok, result: { details: ..., content: [...] } }
export function unwrapToolResult(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const result = obj.result as Record<string, unknown> | undefined;
  if (result?.details) return result.details;
  if (result?.content && Array.isArray(result.content)) {
    const text = (result.content[0] as Record<string, string>)?.text;
    if (text) {
      try { return JSON.parse(text); } catch { /* ignore */ }
    }
  }
  return raw;
}
