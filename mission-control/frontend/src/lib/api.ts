const BASE = "/api";

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

export function postJSON<T>(path: string, body: unknown): Promise<T> {
  return fetchJSON(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteJSON<T>(path: string): Promise<T> {
  return fetchJSON(path, { method: "DELETE" });
}
