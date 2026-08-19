import React from 'react'

export interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  badge?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  action,
  badge,
}) => {
  return (
    <div className="ui-page-header">
      <div className="ui-page-header-text">
        <div className="ui-page-header-title-row">
          <h1 className="ui-page-title">{title}</h1>
          {badge}
        </div>
        {description && <p className="ui-page-description">{description}</p>}
      </div>
      {action && <div className="ui-page-header-action">{action}</div>}
    </div>
  )
}
