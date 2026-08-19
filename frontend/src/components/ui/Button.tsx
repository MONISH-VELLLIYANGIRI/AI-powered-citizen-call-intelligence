import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  loading?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled,
  className = '',
  style,
  ...props
}) => {
  const baseClasses = `ui-btn ui-btn-${variant} ui-btn-${size} ${className}`

  return (
    <button
      className={baseClasses}
      disabled={disabled || loading}
      style={style}
      {...props}
    >
      {loading ? (
        <span className="ui-btn-spinner" aria-hidden="true" />
      ) : icon ? (
        <span className="ui-btn-icon" aria-hidden="true">{icon}</span>
      ) : null}
      <span className="ui-btn-label">{children}</span>
    </button>
  )
}
