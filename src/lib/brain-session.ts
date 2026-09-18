/**
 * The conversation's identity, and why it is stored rather than generated.
 *
 * `conversation_turns` is keyed by session id, and the Brain reads that thread at the top of every
 * run — it is how "and what about lal_kitab?" resolves instead of restarting the review. A session
 * id minted per page load would give every question a fresh thread, so the Brain would answer each
 * one as though it had never spoken, and the table would fill with one-turn conversations that look
 * like a memory that does not work.
 *
 * So it lives in localStorage, per tenant: the same browser continues the same conversation
 * tomorrow. It is not a secret and not an auth token — it names a thread, and the thread is only
 * reachable behind the dashboard's own login.
 */

const KEY_PREFIX = 'brain.session.'

function mint(): string {
  // Prefixed so a thread's origin is legible in the brain's own rows. `conversation_turns.surface`
  // records 'dashboard' too, but an id that says where it came from survives being read out of
  // context, in a log line or a decision's evidence.
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  return `dash_${random}`
}

export function getBrainSessionId(tenantId: string): string {
  const key = `${KEY_PREFIX}${tenantId}`
  if (typeof window === 'undefined') return mint()
  try {
    const existing = window.localStorage.getItem(key)
    if (existing) return existing
    const fresh = mint()
    window.localStorage.setItem(key, fresh)
    return fresh
  } catch {
    // Private browsing, blocked storage, a wiped profile. A fresh id still works for this page —
    // the conversation simply does not survive a reload, which is better than the tab failing to
    // render at all.
    return mint()
  }
}

/** Start a new thread deliberately. The old one is not deleted; it is simply no longer continued. */
export function resetBrainSessionId(tenantId: string): string {
  const key = `${KEY_PREFIX}${tenantId}`
  const fresh = mint()
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, fresh)
    } catch {
      /* see above — an unwritable store still leaves a usable id for this page. */
    }
  }
  return fresh
}
