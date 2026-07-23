import { getToken, clearToken } from './auth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8082/api/v1'

let installed = false

/**
 * Patches window.fetch once so every request to the API automatically
 * carries the bearer token and a 401 response bounces to /login.
 *
 * Why patch fetch globally instead of only updating apiFetch(): a good
 * chunk of pages in this dashboard call fetch() directly against their own
 * local API_BASE constant rather than going through lib/api.ts's apiFetch
 * (campaigns/[campaignId]/page.tsx's pause/resume/approve/reject actions,
 * settings page, runs pages, TriggerPipelineButton, etc). Patching apiFetch
 * alone would leave all of those unauthenticated and failing once the
 * backend's global guard is live. This covers every call site in one place
 * without touching each of them individually.
 */
export function installAuthFetchInterceptor(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString()
    const isApiCall = url.startsWith(API_BASE)
    // The login call itself 401s on a wrong password — that's the login
    // form's own error to show inline, not a "your session expired" signal.
    const isLoginCall = url.startsWith(`${API_BASE}/auth/login`)

    let finalInit = init
    if (isApiCall && !isLoginCall && !(input instanceof Request)) {
      const token = getToken()
      if (token) {
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Bearer ${token}`)
        finalInit = { ...init, headers }
      }
    }

    const res = await originalFetch(input, finalInit)

    if (isApiCall && !isLoginCall && res.status === 401) {
      clearToken()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return res
  }
}
