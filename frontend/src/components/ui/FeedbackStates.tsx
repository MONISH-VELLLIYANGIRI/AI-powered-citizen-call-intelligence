import React from 'react'
import { Button } from './Button'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="ui-empty-state">
      {icon && <div className="ui-empty-icon">{icon}</div>}
      <h3 className="ui-empty-title">{title}</h3>
      {description && <p className="ui-empty-description">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
}) => {
  return (
    <div className="ui-error-state">
      <div className="ui-error-icon">⚠️</div>
      <h4 className="ui-error-title">{title}</h4>
      <p className="ui-error-message">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  )
}

export interface LoadingSkeletonProps {
  count?: number
  height?: number
  className?: string
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  count = 3,
  height = 48,
  className = '',
}) => {
  return (
    <div className={`ui-skeleton-wrapper ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="ui-skeleton-block"
          style={{ height }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  return <div className={`ui-spinner ui-spinner-${size}`} aria-label="Loading..." />
}
