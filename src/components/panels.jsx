/**
 * 대시보드·모니터링·분석 화면 공통 파츠
 * Card(제목 있는 카드), KpiCard(지표), Meter(진행 막대), Tabs(탭), Tag(작은 상태 표시), EmptyState
 */
import { Link } from 'react-router-dom'
import Icon from './Icon'
import './panels.scss'

/** 제목·설명·우측 링크가 있는 카드 */
export function Card({ title, desc, action, children, className = '', as: Tag = 'section', ...rest }) {
  return (
    <Tag className={`card ${className}`} aria-label={typeof title === 'string' ? title : undefined} {...rest}>
      {(title || action) && (
        <header className="card__head">
          <div>
            {title && <h2>{title}</h2>}
            {desc && <p>{desc}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </Tag>
  )
}

/** 카드 우측 상단 텍스트 링크 */
export function CardLink({ to, onClick, children }) {
  if (to) return <Link to={to} className="card__link">{children}</Link>
  return <button type="button" className="card__link" onClick={onClick}>{children}</button>
}

/**
 * KPI 카드 — 값 + 단위 + 보조 설명 + (선택) 변화량 배지·막대
 * @param delta  { text, good }  good=true 초록, false 빨강
 * @param meter  0~100  (tone: brand | success | warning | danger)
 */
export function KpiCard({ label, value, unit, sub, delta, meter, tone, meterTone = 'brand', to, badge }) {
  const body = (
    <>
      <div className="kpi__top">
        <span>{label}</span>
        {delta && <em className={`kpi__delta ${delta.good ? 'is-good' : 'is-bad'}`}>{delta.text}</em>}
        {badge}
      </div>
      <strong className={`kpi__value num ${tone ? `is-${tone}` : ''}`}>
        {value}
        {unit && <small>{unit}</small>}
      </strong>
      {meter != null && <Meter value={meter} tone={meterTone} />}
      {sub && <p className="kpi__sub">{sub}</p>}
    </>
  )
  return to ? <Link to={to} className="kpi card is-link">{body}</Link> : <div className="kpi card">{body}</div>
}

/** 가로 진행 막대 */
export function Meter({ value, tone = 'brand', height = 6, label }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="meter" style={{ height }} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span className={`is-${tone}`} style={{ width: `${v}%` }} />
    </div>
  )
}

/** 밑줄형 탭 — items: [{ key, label, count? }] */
export function Tabs({ items, value, onChange, label, className = '' }) {
  return (
    <div className={`views ${className}`} role="tablist" aria-label={label}>
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          className={`views__tab ${value === t.key ? 'is-active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count != null && <span className={`count count--${value === t.key ? 'active' : 'default'} num`}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** 작은 색 태그 (경고, 비가동, 지연 1일 …) */
export function Tag({ tone = 'neutral', children, icon }) {
  return (
    <span className={`tag tag--${tone}`}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  )
}

/** 색 점 + 글자 (범례·상태) */
export function Dot({ tone = 'neutral', children }) {
  return (
    <span className="dot-label">
      <span className={`dot dot--${tone}`} aria-hidden="true" />
      {children}
    </span>
  )
}

export function EmptyState({ icon = 'inbox', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

/** 실시간 표시 (초록 점 + 문구) */
export function LiveBadge({ children }) {
  return (
    <span className="live">
      <span className="live__dot" aria-hidden="true" />
      {children}
    </span>
  )
}

