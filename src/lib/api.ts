const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
