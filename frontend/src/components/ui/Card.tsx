import React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle'
  hoverable?: boolean
  compact?: boolean
  header?: React.ReactNode
  footer?: React.ReactNode
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  hoverable = false,
  compact = false,
  header,
  footer,
  className = '',
  ...props
}) => {
  const classes = [
    'ui-card',
    `ui-card-${variant}`,
    hoverable ? 'ui-card-hoverable' : '',
    compact ? 'ui-card-compact' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} {...props}>
      {header && <div className="ui-card-header">{header}</div>}
      <div className="ui-card-body">{children}</div>
      {footer && <div className="ui-card-footer">{footer}</div>}
    </div>
  )
}
