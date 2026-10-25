/**
 * 표·카드에서 공통으로 쓰는 셀 컴포넌트
 * 작업지시 목록, 대시보드 지연 위험, 실적 현황 등에서 재사용합니다.
 */
import { Link } from 'react-router-dom'
import { Avatar } from '../ui'
import { dayDiff, formatNumber, formatShortDate, percent } from '../../utils/format'
import './cells.scss'

/** 두 줄 셀: 위는 이름, 아래는 코드 (품목명/품목코드, 라인/설비) */
export function TwoLineCell({ primary, secondary }) {
  return (
    <div className="cell-two">
      <span>{primary}</span>
      <small className="num">{secondary}</small>
    </div>
  )
}

/** 링크 셀 (작업지시번호, LOT 번호 등) — 라우터 주소 `to`로 이동 */
export function LinkCell({ to, children }) {
  return <Link to={to} className="cell-link num">{children}</Link>
}

/** 진행률: "1,240 / 2,000  62%" + 막대 */
export function ProgressCell({ done, total, width = 150 }) {
  const p = percent(done, total)
  const complete = p === 100
  return (
    <div className="cell-progress" style={{ width }}>
      <div className="cell-progress__top">
        <span className="num">{formatNumber(done)} / {formatNumber(total)}</span>
        <strong className={`num ${complete ? 'is-done' : ''}`}>{p}%</strong>
      </div>
      <div className="cell-progress__track" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label="진행률">
        <span className={complete ? 'is-done' : ''} style={{ width: `${p}%` }} />
      </div>
    </div>
  )
}

/**
 * 납기 셀: 날짜 + 상태 문구 (D-n / 오늘 / 지연 n일 / 완료)
 * @param closed  완료·취소처럼 더 이상 납기를 따지지 않는 상태명
 */
export function DueCell({ due, today, closed }) {
  const diff = dayDiff(due, today)
  let sub, tone = ''
  if (closed) sub = closed
  else if (diff < 0) { sub = `지연 ${-diff}일`; tone = 'late' }
  else if (diff === 0) { sub = '오늘'; tone = 'soon' }
  else { sub = `D-${diff}`; tone = diff <= 2 ? 'soon' : '' }
  return (
    <div className={`cell-due ${tone ? `cell-due--${tone}` : ''}`}>
      <span className="num">{formatShortDate(due)}</span>
      <small>{sub}</small>
    </div>
  )
}

/** 사람 셀: 아바타 + 이름 */
export function PersonCell({ name, tone }) {
  return (
    <span className="cell-person">
      <Avatar name={name} tone={tone} />
      {name}
    </span>
  )
}
