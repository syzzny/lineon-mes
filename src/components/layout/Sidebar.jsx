import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import { Avatar } from '../ui'
import Logo from './Logo'
import { NAVIGATION } from '../../config/navigation'
import { homeOf } from '../../config/access'
import { DEMO_ACCOUNTS } from '../../data/mes'
import { useMes } from '../../store/MesStore'
import { useToast } from '../../store/ToastContext'
import './Sidebar.scss'

/**
 * Sidebar — Figma "Layout/Sidebar"
 * @param current  현재 화면 key (예: 'PP-03'). 해당 상위 메뉴가 펼쳐지고 활성화됩니다.
 * @param user     { name, role }
 */
export default function Sidebar({ current, user, open, onClose, hiddenKeys = [], counts = {}, home = '/work-orders' }) {
  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="주 메뉴">
        <Link to={home} className="sidebar__logo" onClick={onClose}>
          <Logo />
        </Link>

        <button type="button" className="sidebar__workspace">
          <span>
            <strong>(주)한결정밀</strong>
            <small>김해공장 · 주간 근무</small>
          </span>
          <Icon name="chev" size={16} />
        </button>

        <nav className="sidebar__nav">
          {NAVIGATION.map((g) => {
            const items = g.items.filter((it) => !hiddenKeys.includes(it.key))
            if (!items.length) return null
            return (
              <div key={g.group} className="sidebar__group">
                <p className="sidebar__group-title">{g.group}</p>
                <ul>
                  {items.map((it) => (
                    <NavItem
                      key={it.key}
                      item={{ ...it, count: counts[it.key], children: it.children?.filter((c) => !hiddenKeys.includes(c.key)) }}
                      current={current}
                      onNavigate={onClose}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>

        <UserMenu user={user} />
      </aside>
    </>
  )
}

function NavItem({ item, current, onNavigate }) {
  const active = item.children?.some((c) => c.key === current)
  const first = item.children?.[0]
  return (
    <li>
      <Link
        to={first?.path ?? '#'}
        className={`nav-item ${active ? 'is-active' : ''}`}
        aria-expanded={item.children ? Boolean(active) : undefined}
        title={item.label}
        onClick={onNavigate}
      >
        <Icon name={item.icon} />
        <span className="nav-item__label">{item.label}</span>
        {item.count ? <span className="nav-item__count num">{item.count}</span> : null}
        {item.children && <Icon name={active ? 'chev' : 'chevR'} size={14} className="nav-item__caret" />}
      </Link>
      {item.children && active && (
        <ul className="sidebar__subs">
          {item.children.map((c) => (
            <li key={c.key}>
              <Link
                to={c.path}
                className={`nav-sub ${c.key === current ? 'is-active' : ''}`}
                aria-current={c.key === current ? 'page' : undefined}
                onClick={onNavigate}
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** 사용자 메뉴 — 데모용 역할 전환, 태블릿 화면, 데이터 초기화 */
function UserMenu({ user }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { users, permissions, run } = useMes()
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const switchTo = (u) => {
    run('session/switch', { userId: u.id })
    setOpen(false)
    navigate(homeOf(permissions, u.role))
    toast(`${u.name} (${u.role})로 전환했어요`)
  }

  return (
    <div className="user-menu" ref={ref}>
      {open && (
        <div className="user-menu__pop" role="menu" aria-label="사용자 메뉴">
          <p className="user-menu__title">데모 계정 전환</p>
          {DEMO_ACCOUNTS.map((id) => users.find((u) => u.id === id)).map((u) => (
            <button key={u.id} type="button" role="menuitemradio" aria-checked={u.id === user.id} className={u.id === user.id ? 'is-on' : ''} onClick={() => switchTo(u)}>
              <Avatar name={u.name} size={28} tone={u.id === user.id ? 'blue' : 'gray'} />
              <span><strong>{u.name}</strong><small>{u.role}</small></span>
              {u.id === user.id && <Icon name="check" size={16} />}
            </button>
          ))}
          <hr />
          <button type="button" role="menuitem" onClick={() => { setOpen(false); navigate('/tablet') }}>
            <Icon name="dash" size={18} /> <span>작업자 태블릿 화면</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              run('reset')
              try { sessionStorage.clear() } catch { /* 무시 */ }
              setOpen(false)
              toast('데모 데이터를 처음 상태로 되돌렸어요')
            }}
          >
            <Icon name="edit" size={18} /> <span>데모 데이터 초기화</span>
          </button>
        </div>
      )}
      <button type="button" className="sidebar__user" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar name={user.name} size={36} />
        <span className="sidebar__user-text">
          <strong>{user.name}</strong>
          <small>{user.role}</small>
        </span>
        <Icon name="more" size={18} />
      </button>
    </div>
  )
}
