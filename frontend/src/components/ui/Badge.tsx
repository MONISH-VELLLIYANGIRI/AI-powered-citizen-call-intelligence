import React from 'react'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  icon?: React.ReactNode
  size?: 'sm' | 'md'
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  icon,
  size = 'md',
  className = '',
  ...props
}) => {
  return (
    <span className={`ui-badge ui-badge-${variant} ui-badge-${size} ${className}`} {...props}>
      {icon && <span className="ui-badge-icon" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    new: { label: 'Received', variant: 'neutral' },
    assigned: { label: 'Assigned', variant: 'warning' },
    in_progress: { label: 'In Progress', variant: 'info' },
    resolved: { label: 'Resolved', variant: 'success' },
  }

  const item = map[status] || { label: status.replace('_', ' '), variant: 'neutral' }
  return <Badge variant={item.variant}>{item.label}</Badge>
}

export function UrgencyBadge({ urgency = 'normal' }: { urgency?: string }) {
  const map: Record<string, { label: string; variant: BadgeVariant; dotColor: string }> = {
    emergency: { label: 'Emergency', variant: 'danger', dotColor: '#dc2626' },
    high: { label: 'High Priority', variant: 'warning', dotColor: '#d97706' },
    normal: { label: 'Standard', variant: 'info', dotColor: '#2563eb' },
    low: { label: 'Low', variant: 'neutral', dotColor: '#64748b' },
  }

  const item = map[urgency] || { label: urgency, variant: 'neutral', dotColor: '#64748b' }
  return (
    <Badge
      variant={item.variant}
      icon={<span style={{ width: 6, height: 6, borderRadius: '50%', background: item.dotColor, display: 'inline-block' }} />}
    >
      {item.label}
    </Badge>
  )
}
