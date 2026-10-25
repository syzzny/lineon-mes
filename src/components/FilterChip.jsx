import { useEffect, useId, useRef, useState } from 'react'
import Icon from './Icon'
import { Checkbox } from './ui'
import './FilterChip.scss'

/**
 * FilterChip — Figma "Filter Chip" (Default / Active)
 * 누르면 다중 선택 목록이 열리고, 선택된 값이 있으면 Active 상태로 바뀜
 */
export default function FilterChip({ label, icon, options, selected, onChange, summary }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const id = useId()
  const active = selected.length > 0 && selected.length < options.length

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const toggle = (v) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v])

  const value = summary ?? (active ? (selected.length === 1 ? selected[0] : `${selected.length}개 선택`) : null)

  return (
    <div className="filter" ref={ref}>
      <button
        type="button"
        className={`chip ${active || summary ? 'chip--active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {icon && <Icon name={icon} size={15} />}
        <span className="chip__label">{label}</span>
        {value && (
          <>
            <span className="chip__sep" aria-hidden="true" />
            <span className="chip__value num">{value}</span>
          </>
        )}
        <Icon name="chev" size={14} className="chip__caret" />
      </button>

      {open && options.length > 0 && (
        <div className="filter__menu" id={id} role="group" aria-label={`${label} 선택`}>
          {options.map((o) => (
            <label key={o} className="filter__option">
              <Checkbox checked={selected.includes(o)} onChange={() => toggle(o)} label={o} />
              <span>{o}</span>
            </label>
          ))}
          <div className="filter__foot">
            <button type="button" onClick={() => onChange([])}>선택 해제</button>
            <button type="button" onClick={() => onChange(options)}>전체 선택</button>
          </div>
        </div>
      )}
    </div>
  )
}
