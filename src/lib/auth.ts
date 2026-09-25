const TOKEN_KEY = 'meridian_auth_token'
const ROLE_KEY = 'meridian_auth_role'
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
  window.localStorage.removeItem(ROLE_KEY)
}

export type AuthRole = 'brain' | 'workspace'

interface LoginResponse {
  accessToken: string
  expiresIn?: number
  role?: AuthRole
}

/** Which kind of account the workspace session belongs to. Older backends send no role. */
export function getRole(): AuthRole | null {
  if (typeof window === 'undefined') return null
  const role = window.localStorage.getItem(ROLE_KEY)
  return role === 'brain' || role === 'workspace' ? role : null
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
  const data = (await res.json()) as LoginResponse
  setToken(data.accessToken)
  window.localStorage.setItem(ROLE_KEY, data.role ?? 'workspace')
  // Signing in with the Brain account on the main form unlocks the Brain as well — the same token
  // is a Brain token, so asking for the same password twice would be pointless.
  if (data.role === 'brain') setBrainToken(data.accessToken)
}

export function logout(): void {
  clearToken()
  clearBrainToken()
  window.location.href = '/login'
}

// ── The Brain ──────────────────────────────────────────────────────────────
//
// The Brain has its own login, and its token is kept apart from the workspace one on purpose:
//
//   meridian_auth_token   — the workspace session. Every page, every call, as before.
//   meridian_brain_token  — only ever sent by lib/brain-api.ts, only to /brain/* routes.
//
// So a person signs into the workspace as usual and unlocks the Brain on top; locking the Brain
// drops only its token and never signs them out of the workspace, and a Brain 401/403 never bounces
// them to /login (lib/auth-fetch.ts leaves /brain/* calls alone). One token per scope means no role
// juggling at call sites: brain-api has one token to send and everything else has the other.

const BRAIN_TOKEN_KEY = 'meridian_brain_token'
const BRAIN_AUTH_EVENT = 'meridian:brain-auth'

/** Why the Brain is locked, when there is something to tell the person beyond "sign in". */
export type BrainLockReason = 'signed_out' | 'expired' | 'not_configured'

let lastLockReason: BrainLockReason = 'signed_out'

function announceBrainAuth(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(BRAIN_AUTH_EVENT))
}

export function getBrainToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(BRAIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setBrainToken(token: string): void {
  try {
    window.localStorage.setItem(BRAIN_TOKEN_KEY, token)
  } catch {
    /* blocked storage: the Brain simply stays locked */
  }
  lastLockReason = 'signed_out'
  announceBrainAuth()
}

export function clearBrainToken(reason: BrainLockReason = 'signed_out'): void {
  if (typeof window === 'undefined') return
  lastLockReason = reason
  try {
    window.localStorage.removeItem(BRAIN_TOKEN_KEY)
  } catch {
    /* nothing stored to remove */
  }
  announceBrainAuth()
}

/** Why the Brain was last locked in this tab — the sign-in card words its notice from this. */
export function getBrainLockReason(): BrainLockReason {
  return lastLockReason
}

/** Re-render when the Brain is unlocked or locked, in this tab or another. */
export function subscribeBrainAuth(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === BRAIN_TOKEN_KEY) onChange()
  }
  window.addEventListener(BRAIN_AUTH_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(BRAIN_AUTH_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * Unlocks the Brain with the Brain account. Errors are already in plain words — the card shows
 * `message` as it is.
 */
export async function brainLogin(username: string, password: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    throw new Error("We couldn't reach the server. Check your connection and try again.")
  }
  if (!res.ok) {
    if (res.status === 401) throw new Error("That username and password don't match the Brain account.")
    if (res.status === 429) throw new Error('Too many tries. Wait a minute, then try again.')
    if (res.status === 503) throw new Error("The Brain login hasn't been set up on the server yet.")
    throw new Error("We couldn't sign you in just now. Try again.")
  }
  const data = (await res.json()) as LoginResponse
  if (data.role && data.role !== 'brain') {
    throw new Error("That's a workspace account. Use the Brain account's username and password.")
  }
  setBrainToken(data.accessToken)
}
