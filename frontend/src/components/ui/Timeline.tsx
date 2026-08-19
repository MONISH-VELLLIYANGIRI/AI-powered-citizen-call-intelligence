import React from 'react'

export interface TimelineStep {
  id: string | number
  title: string
  subtitle?: string
  timestamp?: string
  status: 'completed' | 'current' | 'pending'
  actor?: string
  badgeText?: string
}

export interface TimelineProps {
  steps: TimelineStep[]
  className?: string
}

export const Timeline: React.FC<TimelineProps> = ({ steps, className = '' }) => {
  return (
    <div className={`ui-timeline ${className}`}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1
        const isDone = step.status === 'completed'
        const isCurrent = step.status === 'current'

        return (
          <div key={step.id} className={`ui-timeline-item ui-timeline-${step.status}`}>
            <div className="ui-timeline-marker-col">
              <div className={`ui-timeline-dot ${isDone ? 'is-done' : isCurrent ? 'is-current' : 'is-pending'}`}>
                {isDone ? (
                  <span className="ui-timeline-check">✓</span>
                ) : isCurrent ? (
                  <span className="ui-timeline-pulse" />
                ) : null}
              </div>
              {!isLast && <div className={`ui-timeline-line ${isDone ? 'is-done' : ''}`} />}
            </div>

            <div className="ui-timeline-content">
              <div className="ui-timeline-header-row">
                <span className="ui-timeline-title">{step.title}</span>
                {step.badgeText && (
                  <span className="ui-timeline-badge">{step.badgeText}</span>
                )}
                {step.timestamp && (
                  <span className="ui-timeline-time">{step.timestamp}</span>
                )}
              </div>
              {step.subtitle && <p className="ui-timeline-subtitle">{step.subtitle}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
