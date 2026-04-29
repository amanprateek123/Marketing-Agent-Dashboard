import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function formatRelativeTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  try {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diffMs = now - then
    const absDiff = Math.abs(diffMs)
    const isFuture = diffMs < 0

    const minutes = Math.round(absDiff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return isFuture ? `in ${minutes}m` : `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return isFuture ? `in ${hours}h` : `${hours}h ago`
    const days = Math.round(hours / 24)
    return isFuture ? `in ${days}d` : `${days}d ago`
  } catch {
    return dateStr
  }
}
