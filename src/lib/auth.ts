const TOKEN_KEY = 'meridian_auth_token'
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
}

/**
 * Calls the backend's single-operator login endpoint directly (not through
 * apiFetch/the fetch interceptor — there's no token yet, nothing to attach,
 * and a wrong-password 401 here must NOT trigger the interceptor's
 * "session expired, bounce to /login" behavior since the user is already
 * on the login form).
 */
export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('Incorrect email or password')
    if (res.status === 429) throw new Error('Too many attempts — wait a minute and try again')
    throw new Error(`Login failed (${res.status})`)
  }
  const data = (await res.json()) as { accessToken: string }
  setToken(data.accessToken)
}

export function logout(): void {
  clearToken()
  window.location.href = '/login'
}
