import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import { IconButton } from '../ui'
import { useMes, useNotices } from '../../store/MesStore'
import { useToast } from '../../store/ToastContext'
import { shortStamp } from '../../utils/clock'
import './Topbar.scss'

/** @param crumbs [{ label, path? }] — 마지막 항목이 현재 위치 */
export default function Topbar({ crumbs, onMenu }) {
  const [drawer, setDrawer] = useState(false)
  const notices = useNotices()
  const unread = notices.filter((n) => !n.read).length

  return (
    <header className="topbar">
      <IconButton icon="menu" label="메뉴 열기" className="topbar__menu" onClick={onMenu} />

      <nav aria-label="현재 위치" className="topbar__crumbs">
        <ol>
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1
            return (
              <li key={c.label + i} aria-current={last ? 'page' : undefined}>
                {i > 0 && <Icon name="chevR" size={14} />}
                {c.path && !last ? <Link to={c.path}>{c.label}</Link> : <span>{c.label}</span>}
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="topbar__right">
        <GlobalSearch />
        <IconButton icon="bell" label={`알림 ${unread}건`} aria-expanded={drawer} onClick={() => setDrawer(true)}>
          {unread > 0 && <span className="topbar__dot" aria-hidden="true" />}
        </IconButton>
        <IconButton icon="help" label="도움말" />
      </div>

      {drawer && <NoticeDrawer notices={notices} onClose={() => setDrawer(false)} />}
    </header>
  )
}

/**
 * 전체 검색 — Enter로 이동
 * 작업지시번호(일부도 가능)·설비 코드·품목 코드·LOT 번호를 알아보고 해당 화면으로, 나머지는 작업지시 목록 검색으로
 */
function GlobalSearch() {
  const [q, setQ] = useState('')
  const ref = useRef(null)
  const navigate = useNavigate()
  const toast = useToast()
  const { workOrders, equipment, items } = useMes()

  // ⌘K / Ctrl+K 로 포커스
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const go = () => {
    const v = q.trim().toUpperCase()
    if (!v) return
    const wo = workOrders.find((w) => w.id === v || w.id.endsWith(`-${v.padStart(4, '0')}`))
    const eq = equipment.find((e) => e.id === v || e.id.replace('-', '') === v.replace('-', ''))
    const item = items.find((i) => i.code === v)
    if (wo) navigate(`/work-orders/${wo.id}`)
    else if (eq) navigate(`/equipment/${eq.id}`)
    else if (item) navigate(`/items?code=${item.code}`)
    else if (/^L\d{4}-\d{2}-\d{3}$/.test(v)) navigate(`/lots/${v}`)
    else {
      // 작업지시 목록의 검색어로 넘김 (목록이 저장된 조건을 읽음)
      try {
        const key = 'lineon:list:work-orders'
        const saved = JSON.parse(sessionStorage.getItem(key)) ?? {}
        sessionStorage.setItem(key, JSON.stringify({ ...saved, query: q.trim(), view: 'all', page: 1 }))
      } catch { /* 무시 */ }
      navigate('/work-orders', { state: { q: q.trim() } })
      toast(`"${q.trim()}"(으)로 작업지시를 검색했어요`)
    }
    setQ('')
    ref.current?.blur()
  }

  return (
    <label className="global-search">
      <Icon name="search" size={16} />
      <input
        ref={ref}
        type="search"
        placeholder="작업지시·품목·설비 검색"
        aria-label="전체 검색 (작업지시번호, 설비 코드, 품목 코드, LOT 번호)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && go()}
      />
      <kbd className="num">⌘K</kbd>
    </label>
  )
}

/** CM-02 알림 패널 */
function NoticeDrawer({ notices, onClose }) {
  const { run } = useMes()
  const navigate = useNavigate()
  const ref = useRef(null)
  const [tab, setTab] = useState('all')
  const list = tab === 'unread' ? notices.filter((n) => !n.read) : notices

  useEffect(() => {
    ref.current?.focus()
    const esc = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  const open = (n) => {
    run('notices/read', { ids: [n.id] })
    onClose()
    navigate(n.to)
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="알림" tabIndex={-1} ref={ref}>
        <header className="drawer__head">
          <h2>알림</h2>
          <button type="button" className="drawer__link" onClick={() => run('notices/read', { ids: notices.map((n) => n.id) })}>모두 읽음</button>
          <IconButton icon="x" label="닫기" onClick={onClose} />
        </header>
        <div className="drawer__tabs" role="tablist">
          {[['all', '전체', notices.length], ['unread', '읽지 않음', notices.filter((n) => !n.read).length]].map(([k, label, n]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
              {label} <span className="num">{n}</span>
            </button>
          ))}
        </div>
        <ul className="drawer__list">
          {list.map((n) => (
            <li key={n.id}>
              <button type="button" className={`notice-item ${n.read ? 'is-read' : ''}`} onClick={() => open(n)}>
                <span className={`notice-item__tag is-${n.tone}`}>{n.label}</span>
                <span className="notice-item__body">
                  <strong>{n.title}</strong>
                  <small>{n.desc}</small>
                </span>
                <span className="notice-item__time num">{shortStamp(n.at).slice(6)}</span>
                {!n.read && <span className="notice-item__dot" aria-label="읽지 않음" />}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="drawer__empty"><Icon name="check" size={20} /> 새 알림이 없어요</li>}
        </ul>
      </aside>
    </>
  )
}
