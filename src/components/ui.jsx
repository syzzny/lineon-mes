import { useEffect, useRef } from 'react'
import Icon from './Icon'
import './ui.scss'

/** Button — Figma "Button" (Primary / Secondary / Ghost / Danger) */
export function Button({ variant = 'secondary', icon, children, className = '', ...rest }) {
  return (
    <button type="button" className={`btn btn--${variant} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={16} strokeWidth={2} />}
      <span>{children}</span>
    </button>
  )
}

/** IconButton — 아이콘만 있는 정사각형 버튼 (aria-label 필수) */
export function IconButton({ icon, label, className = '', children, ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={18} />
      {children}
    </button>
  )
}

/** StatusBadge — Figma "Status Badge" */
const STATUS_TONE = {
  // 작업지시
  대기: 'neutral', 진행: 'brand', 일시정지: 'warning', 완료: 'success', 취소: 'muted',
  // 설비
  가동: 'success', 비가동: 'danger', 점검: 'brand',
  // 실적 승인
  '승인 대기': 'warning', 승인: 'success', 반려: 'danger',
  // 불량 조치
  미조치: 'danger', 조치중: 'warning',
  // LOT
  '출하 보류': 'danger', '출하 가능': 'success', 출하완료: 'neutral',
  // 사용 여부
  사용: 'success', '사용 중지': 'muted',
}
/** 상태 문구 + 점 (색만으로 구분하지 않도록 항상 글자와 함께) */
export function StatusBadge({ status, tone, children }) {
  return (
    <span className={`badge badge--${tone ?? STATUS_TONE[status] ?? 'neutral'}`}>
      <span className="badge__dot" aria-hidden="true" />
      {children ?? status}
    </span>
  )
}

/** Checkbox — Figma "Checkbox" (Off / On / Mixed) */
export function Checkbox({ checked, indeterminate = false, onChange, label }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <label className="checkbox">
      <input ref={ref} type="checkbox" checked={checked} onChange={onChange} />
      <span className="checkbox__box" aria-hidden="true">
        {indeterminate ? <span className="checkbox__mixed" /> : <Icon name="check" size={13} strokeWidth={3.2} />}
      </span>
      <span className="sr-only">{label}</span>
    </label>
  )
}

/** Avatar — Figma "Avatar" (Blue / Green / Orange / Gray) */
export function Avatar({ name, tone = 'blue', size = 26 }) {
  return (
    <span className={`avatar avatar--${tone}`} style={{ width: size, height: size }} aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  )
}

/** Count — 탭·제목 옆 숫자 알약 */
export function Count({ children, tone = 'default' }) {
  return <span className={`count count--${tone} num`}>{children}</span>
}
