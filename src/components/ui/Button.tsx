import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import React from 'react'

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost'
type Size = 'sm' | 'md'

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary:   { background: '#4338ca', color: '#ffffff', boxShadow: '0 1px 3px rgba(2,132,199,0.25)' },
  secondary: { background: '#ffffff', border: '1px solid #e5e7eb', color: '#52525b' },
  success:   { background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d' },
  danger:    { background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' },
  warning:   { background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309' },
  ghost:     { background: 'transparent', color: '#71717a' },
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
        'inline-flex items-center rounded-lg font-semibold transition-all',
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
