/**
 * 폼 컴포넌트 — Figma "Field" (Input / Select / Date / Search × Placeholder·Filled·Error·Disabled)
 * 모든 입력은 Field로 감싸면 라벨·필수 표시·도움말·오류 메시지가 같은 규칙으로 붙습니다.
 */
import { useId } from 'react'
import Icon from './Icon'
import './form.scss'

export function Field({ label, required, help, error, children, className = '' }) {
  const id = useId()
  const describedBy = error || help ? `${id}-msg` : undefined
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span className="field__req" aria-hidden="true">*</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, 'aria-required': required || undefined })}
      {(error || help) && (
        <p className="field__msg" id={describedBy} role={error ? 'alert' : undefined}>
          {error && <Icon name="alert" size={14} />}
          {error || help}
        </p>
      )}
    </div>
  )
}

export function TextInput({ suffix, className = '', ...props }) {
  return (
    <div className={`input ${props.disabled ? 'is-disabled' : ''} ${className}`}>
      <input {...props} />
      {suffix && <span className="input__suffix num">{suffix}</span>}
    </div>
  )
}

export function Select({ options, placeholder, className = '', ...props }) {
  return (
    <div className={`input input--select ${props.disabled ? 'is-disabled' : ''} ${className}`}>
      <select {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const value = typeof o === 'string' ? o : o.value
          const label = typeof o === 'string' ? o : o.label
          return <option key={value} value={value} disabled={o.disabled}>{label}</option>
        })}
      </select>
      <Icon name="chev" size={16} />
    </div>
  )
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`textarea ${className}`} {...props} />
}

/** Segmented — 우선순위처럼 2~4개 중 하나 고르기 */
export function Segmented({ options, value, onChange, label, disabled }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          className={value === o ? 'is-on' : ''}
          onClick={() => onChange(o)}
          disabled={disabled}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

/** 읽기 전용 값 (자동 입력되는 항목) */
export function ReadOnly({ children }) {
  return <div className="readonly">{children}</div>
}
