import { Navigate, Outlet, RouterProvider, createBrowserRouter, createHashRouter } from 'react-router-dom'
import { MesProvider, useMes } from './store/MesStore'
import { ToastProvider } from './store/ToastContext'
import { homeOf } from './config/access'
import { SCREENS } from './config/navigation'
import ComingSoon from './pages/ComingSoon'
import Dashboard from './pages/Dashboard'
import LineMonitoring from './pages/LineMonitoring'
import WorkOrderList from './pages/WorkOrderList'
import WorkOrderDetail from './pages/WorkOrderDetail'
import WorkOrderForm from './pages/WorkOrderForm'
import Equipment from './pages/Equipment'
import DowntimeHistory from './pages/DowntimeHistory'
import Tablet, { TabletPicker } from './pages/Tablet'
import Plans from './pages/Plans'
import Assignments from './pages/Assignments'
import Results from './pages/Results'
import ResultApproval from './pages/ResultApproval'
import DefectForm from './pages/DefectForm'
import DefectAnalysis from './pages/DefectAnalysis'
import Lots from './pages/Lots'
import Items from './pages/Items'
import Users from './pages/Users'
import Permissions from './pages/Permissions'

/** 모든 화면이 공유하는 데이터·토스트 */
function Providers() {
  return (
    <MesProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </MesProvider>
  )
}

/** 첫 화면: 로그인한 역할이 볼 수 있는 첫 메뉴 */
function Home() {
  const { user, permissions } = useMes()
  return <Navigate to={homeOf(permissions, user.role)} replace />
}

const PAGES = {
  'DB-01': <Dashboard />,
  'DB-02': <LineMonitoring />,
  'PP-03': <WorkOrderList />,
  'PP-01': <Plans />,
  'PP-06': <Assignments />,
  'PR-01': <Results />,
  'PR-02': <ResultApproval />,
  'QC-01': <DefectForm />,
  'QC-02': <DefectAnalysis />,
  'QC-03': <Lots />,
  'EQ-01': <Equipment />,
  'EQ-02': <DowntimeHistory />,
  'MD-01': <Items />,
  'SY-01': <Users />,
  'SY-02': <Permissions />,
}

const routes = [
  {
    element: <Providers />,
    children: [
      { path: '/', element: <Home /> },
      ...SCREENS.map((s) => ({ path: s.path, element: PAGES[s.key] ?? <ComingSoon screen={s} /> })),
      { path: '/work-orders/new', element: <WorkOrderForm /> },
      { path: '/work-orders/:id', element: <WorkOrderDetail /> },
      { path: '/work-orders/:id/edit', element: <WorkOrderForm /> },
      { path: '/equipment/:id', element: <Equipment /> },
      { path: '/lots/:lot', element: <Lots /> },
      { path: '/tablet', element: <TabletPicker /> },
      { path: '/tablet/:equip', element: <Tablet /> },
      { path: '*', element: <ComingSoon /> },
    ],
  },
]

// 미리보기용 단일 HTML 빌드에서는 주소창을 바꿀 수 없어 해시 라우터 사용
const router = (import.meta.env.MODE === 'single' ? createHashRouter : createBrowserRouter)(routes)

export default function App() {
  return <RouterProvider router={router} />
}
