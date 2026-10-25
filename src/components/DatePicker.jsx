/**
 * DatePicker — 입력칸 어디를 눌러도 달력이 열리는 날짜 선택
 *
 * - 값 형식은 'YYYY-MM-DD' (input[type=date]와 같음) → 폼·검증 코드 그대로 사용
 * - min / max 바깥 날짜는 선택 불가
 * - 키보드: ← → ↑ ↓ 날짜 이동, PageUp/PageDown 월 이동, Enter 선택, Esc 닫기
 * - 오늘, 선택한 날짜, 주말을 구분해서 표시
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Icon from './Icon'
import './DatePicker.scss'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/* ---------- 날짜 계산 (시간대 영향 없이 로컬 날짜로) ---------- */
const pad = (n) => String(n).padStart(2, '0')
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (iso, n) => {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
const addMonths = (iso, n) => {
  const d = fromISO(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toISO(d)
}
const label = (iso) => {
  const d = fromISO(iso)
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WEEK[d.getDay()]})`
}

/** 해당 월을 6주(42칸) 그리드로 */
function monthGrid(viewISO) {
  const v = fromISO(viewISO)
  const first = new Date(v.getFullYear(), v.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return { iso: toISO(d), day: d.getDate(), dow: d.getDay(), inMonth: d.getMonth() === v.getMonth() }
  })
}

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  today,
  placeholder = '날짜 선택',
  disabled,
  id,
  className = '',
  ...aria
}) {
  const [systemToday] = useState(() => toISO(new Date()))
  const todayISO = today ?? systemToday
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(value || todayISO) // 키보드 포커스 날짜
  const [view, setView] = useState(value || todayISO) // 보고 있는 달
  const rootRef = useRef(null)
  const gridRef = useRef(null)
  const triggerRef = useRef(null)
  const popId = useId()

  const isDisabled = (iso) => (min && iso < min) || (max && iso > max)

  const openPicker = () => {
    if (disabled) return
    const start = value || (min && todayISO < min ? min : todayISO)
    setCursor(start)
    setView(start)
    setOpen(true)
  }
  const close = (focusTrigger = true) => {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }
  const pick = (iso) => {
    if (isDisabled(iso)) return
    onChange(iso)
    close()
  }

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // 열리면 커서 날짜에 포커스
  useEffect(() => {
    if (open) gridRef.current?.querySelector(`[data-iso="${cursor}"]`)?.focus()
  }, [open, cursor, view])

  const moveCursor = (iso) => {
    setCursor(iso)
    if (iso.slice(0, 7) !== view.slice(0, 7)) setView(iso)
  }

  const onGridKey = (e) => {
    const map = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, -1),
      PageDown: () => addMonths(cursor, 1),
      Home: () => addDays(cursor, -fromISO(cursor).getDay()),
      End: () => addDays(cursor, 6 - fromISO(cursor).getDay()),
    }
    if (map[e.key]) {
      e.preventDefault()
      moveCursor(map[e.key]())
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(cursor)
    }
  }

  const onRootKey = (e) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      close()
    }
  }

  const days = useMemo(() => monthGrid(view), [view])
  const v = fromISO(view)
  const canPrev = !min || addMonths(view, -1).slice(0, 7) >= min.slice(0, 7)
  const canNext = !max || addMonths(view, 1).slice(0, 7) <= max.slice(0, 7)

  return (
    <div className={`datepicker ${className}`} ref={rootRef} onKeyDown={onRootKey}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`input datepicker__trigger ${disabled ? 'is-disabled' : ''} ${open ? 'is-open' : ''}`}
        onClick={() => (open ? close(false) : openPicker())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            openPicker()
          }
        }}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        {...aria}
      >
        <span className={`datepicker__value ${value ? 'num' : 'is-placeholder'}`}>{value ? label(value) : placeholder}</span>
        <Icon name="cal" size={16} />
      </button>

      {open && (
        <div className="datepicker__pop" id={popId} role="dialog" aria-modal="false" aria-label="날짜 선택">
          <div className="datepicker__head">
            <button type="button" className="datepicker__nav" onClick={() => setView(addMonths(view, -1))} disabled={!canPrev} aria-label="이전 달">
              <Icon name="chevL" size={18} />
            </button>
            <strong className="num" aria-live="polite">
              {v.getFullYear()}년 {v.getMonth() + 1}월
            </strong>
            <button type="button" className="datepicker__nav" onClick={() => setView(addMonths(view, 1))} disabled={!canNext} aria-label="다음 달">
              <Icon name="chevR" size={18} />
            </button>
          </div>

          <div className="datepicker__week" aria-hidden="true">
            {WEEK.map((w, i) => (
              <span key={w} className={i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : ''}>{w}</span>
            ))}
          </div>

          <div className="datepicker__grid" role="grid" ref={gridRef} onKeyDown={onGridKey}>
            {days.map((d) => {
              const off = isDisabled(d.iso)
              const cls = [
                'datepicker__day',
                !d.inMonth && 'is-out',
                d.dow === 0 && 'is-sun',
                d.dow === 6 && 'is-sat',
                d.iso === todayISO && 'is-today',
                d.iso === value && 'is-selected',
              ].filter(Boolean).join(' ')
              return (
                <button
                  key={d.iso}
                  type="button"
                  role="gridcell"
                  data-iso={d.iso}
                  className={cls}
                  tabIndex={d.iso === cursor ? 0 : -1}
                  disabled={off}
                  aria-selected={d.iso === value}
                  aria-current={d.iso === todayISO ? 'date' : undefined}
                  aria-label={label(d.iso)}
                  onClick={() => pick(d.iso)}
                >
                  <span className="num">{d.day}</span>
                </button>
              )
            })}
          </div>

          <div className="datepicker__foot">
            <button type="button" onClick={() => pick(todayISO)} disabled={isDisabled(todayISO)}>오늘</button>
            {value && <span className="num">{label(value)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
