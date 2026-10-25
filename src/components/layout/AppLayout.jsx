import { useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Icon from '../Icon'
import { getBreadcrumb } from '../../config/navigation'
import { hiddenKeys as getHidden, homeOf, levelOf } from '../../config/access'
import { useMes, useNotices } from '../../store/MesStore'
import './AppLayout.scss'

/**
 * 모든 화면이 공유하는 레이아웃 (사이드바 + 상단바 + 본문)
 * - 로그인한 사용자의 역할 권한(SY-02)으로 메뉴를 숨기고, 숨김 화면은 "접근 권한 없음"을 보여줍니다.
 * @param current  화면 ID (사이드바 활성 메뉴·브레드크럼·권한 기준)
 * @param crumbs   브레드크럼 뒤에 붙일 항목 (예: [{ label: 'WO-2610-0142' }])
 */
export default function AppLayout({ current, crumbs = [], children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, permissions } = useMes()
  const notices = useNotices()
  const hidden = getHidden(permissions, user.role)
  const blocked = current && levelOf(permissions, user.role, current) === '숨김'

  return (
    <div className="app">
      <Sidebar
        current={current}
        user={user}
        hiddenKeys={hidden}
        counts={{ dashboard: notices.filter((n) => !n.read).length }}
        home={homeOf(permissions, user.role)}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <div className="app__main">
        <Topbar crumbs={getBreadcrumb(current, crumbs)} onMenu={() => setMenuOpen(true)} />
        {blocked ? <NoAccess role={user.role} home={homeOf(permissions, user.role)} /> : children}
      </div>
    </div>
  )
}

function NoAccess({ role, home }) {
  return (
    <main className="page">
      <section className="data-card no-access">
        <span className="no-access__icon"><Icon name="shield" size={28} /></span>
        <h1>이 화면을 볼 권한이 없어요</h1>
        <p><strong>{role}</strong> 역할에는 이 메뉴가 "숨김"으로 설정되어 있어요. 필요하면 시스템 관리자에게 권한을 요청하세요.</p>
        <Link to={home} className="btn btn--primary">내 첫 화면으로</Link>
      </section>
    </main>
  )
}
