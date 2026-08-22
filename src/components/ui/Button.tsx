import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import React from 'react'

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost'
type Size = 'sm' | 'md'

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary:   {
    background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), 0 7px 16px -10px rgba(31,51,126,.8)',
    color: '#fff',
  },
  secondary: { background: 'var(--surface)', border: '1px solid var(--hairline)', color: 'var(--ink-2)' },
  success:   { background: 'var(--good-bg)', border: '1px solid var(--good-border)', color: 'var(--good)' },
  danger:    { background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', color: 'var(--bad)' },
  warning:   { background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--warn)' },
  ghost:     { background: 'transparent', color: 'var(--ink-3)' },
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      className={cn(
        'inline-flex items-center rounded-[10px] font-semibold transition-all',
        sizeClasses[size],
        isDisabled && 'opacity-60 cursor-not-allowed',
        className
      )}
      style={{ ...variantStyles[variant], ...style }}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 11 : 14} className="animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  )
}
