import React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helpText?: string
  error?: string
  requiredMarker?: boolean
  leftIcon?: React.ReactNode
  rightElement?: React.ReactNode
}

export const Input: React.FC<InputProps> = ({
  label,
  helpText,
  error,
  requiredMarker,
  leftIcon,
  rightElement,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="ui-form-group">
      {label && (
        <label htmlFor={inputId} className="ui-label">
          {label}
          {requiredMarker && <span className="ui-required-mark">*</span>}
        </label>
      )}
      <div className="ui-input-wrapper">
        {leftIcon && <span className="ui-input-left-icon">{leftIcon}</span>}
        <input
          id={inputId}
          className={`ui-input ${leftIcon ? 'has-left-icon' : ''} ${error ? 'is-invalid' : ''} ${className}`}
          {...props}
        />
        {rightElement && <div className="ui-input-right-element">{rightElement}</div>}
      </div>
      {error ? (
        <p className="ui-error-text">{error}</p>
      ) : helpText ? (
        <p className="ui-help-text">{helpText}</p>
      ) : null}
    </div>
  )
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helpText?: string
  error?: string
  requiredMarker?: boolean
  options?: { value: string; label: string }[]
}

export const Select: React.FC<SelectProps> = ({
  label,
  helpText,
  error,
  requiredMarker,
  options,
  children,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="ui-form-group">
      {label && (
        <label htmlFor={selectId} className="ui-label">
          {label}
          {requiredMarker && <span className="ui-required-mark">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={`ui-select ${error ? 'is-invalid' : ''} ${className}`}
        {...props}
      >
        {options
          ? options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      {error ? (
        <p className="ui-error-text">{error}</p>
      ) : helpText ? (
        <p className="ui-help-text">{helpText}</p>
      ) : null}
    </div>
  )
}
