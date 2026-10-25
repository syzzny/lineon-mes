/**
 * 목록 화면 공통 파츠: 보기 탭, 필터 바, 하단 페이지 영역, 페이지 헤더
 */
import Icon from '../Icon'
import { Count } from '../ui'
import { Pagination } from '../feedback'
import { formatNumber } from '../../utils/format'
import './ListParts.scss'

/** 페이지 제목 + 설명 + 우측 액션 */
export function PageHeader({ title, count, description, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>
          {title} {count != null && <Count tone="title">{formatNumber(count)}</Count>}
        </h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}

/** 저장된 보기 탭 — views: [{ key, label, tone? }], counts: { key: n } */
export function ViewTabs({ views, counts, value, onChange, onSave }) {
  return (
    <div className="views" role="tablist" aria-label="저장된 보기">
      {views.map((v) => {
        const active = value === v.key
        const n = counts[v.key] ?? 0
        const tone = v.tone === 'danger' && n ? 'danger' : active ? 'active' : 'default'
        return (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`views__tab ${active ? 'is-active' : ''}`}
            onClick={() => onChange(v.key)}
          >
            {v.label}
            <Count tone={tone}>{n}</Count>
          </button>
        )
      })}
      {onSave && (
        <button type="button" className="views__save" onClick={onSave}>
          <Icon name="plus" size={14} /> 보기 저장
        </button>
      )}
    </div>
  )
}

/** 필터 바: 왼쪽엔 필터 칩, 오른쪽엔 검색 등 */
export function FilterBar({ children, end, onReset }) {
  return (
    <div className="filter-bar">
      {children}
      {onReset && (
        <button type="button" className="filter-bar__reset" onClick={onReset}>
          초기화
        </button>
      )}
      <div className="filter-bar__spacer" />
      {end}
    </div>
  )
}

/** 목록 내 검색 입력 */
export function SearchInput({ id, value, onChange, placeholder, label }) {
  return (
    <label className="list-search" htmlFor={id}>
      <Icon name="search" size={15} />
      <input id={id} type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
    </label>
  )
}

/** 하단: "1–20 / 128" + 페이지당 행 수 + 페이지네이션 */
export function ListFooter({ pagination, pageSize, pageSizes, onPageSize, onPage }) {
  const { page, pageCount, from, to, total } = pagination
  return (
    <footer className="list-footer">
      <div className="list-footer__left">
        <span className="num">
          {from ? `${from}–${to}` : 0} / {formatNumber(total)}
        </span>
        <label className="page-size">
          <span className="sr-only">페이지당 행 수</span>
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {pageSizes.map((n) => (
              <option key={n} value={n}>{n}개씩</option>
            ))}
          </select>
          <Icon name="chev" size={14} />
        </label>
      </div>
      <Pagination page={page} pageCount={pageCount} onChange={onPage} />
    </footer>
  )
}
