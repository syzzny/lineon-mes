/**
 * 사이드바 메뉴 설정 — IA(화면 목록)와 같은 구조
 * key는 화면 ID, path는 라우터 주소입니다.
 * 아직 만들지 않은 화면도 path를 두고, 라우터에서 "준비 중" 화면으로 연결합니다.
 */
export const NAVIGATION = [
  {
    group: '모니터링',
    items: [
      {
        key: 'dashboard', icon: 'dash', label: '대시보드', count: 3,
        children: [
          { key: 'DB-01', label: '생산 현황', path: '/dashboard' },
          { key: 'DB-02', label: '라인 모니터링', path: '/line-monitoring' },
        ],
      },
    ],
  },
  {
    group: '생산',
    items: [
      {
        key: 'planning', icon: 'clip', label: '생산계획·작업지시',
        children: [
          { key: 'PP-01', label: '생산계획', path: '/plans' },
          { key: 'PP-03', label: '작업지시', path: '/work-orders' },
          { key: 'PP-06', label: '작업 배정', path: '/assignments' },
        ],
      },
      {
        key: 'results', icon: 'chart', label: '생산실적',
        children: [
          { key: 'PR-01', label: '실적 현황', path: '/results' },
          { key: 'PR-02', label: '실적 승인', path: '/results/approval' },
        ],
      },
    ],
  },
  {
    group: '품질·설비',
    items: [
      {
        key: 'quality', icon: 'shield', label: '품질관리',
        children: [
          { key: 'QC-01', label: '불량 등록', path: '/defects/new' },
          { key: 'QC-02', label: '불량 분석', path: '/defects' },
          { key: 'QC-03', label: 'LOT 추적', path: '/lots' },
        ],
      },
      {
        key: 'equipment', icon: 'wrench', label: '설비관리',
        children: [
          { key: 'EQ-01', label: '설비 현황', path: '/equipment' },
          { key: 'EQ-02', label: '비가동 이력', path: '/downtime' },
        ],
      },
    ],
  },
  {
    group: '관리',
    items: [
      { key: 'master', icon: 'db', label: '기준정보', children: [{ key: 'MD-01', label: '품목 관리', path: '/items' }] },
      {
        key: 'system', icon: 'gear', label: '시스템 관리',
        children: [
          { key: 'SY-01', label: '사용자 관리', path: '/users' },
          { key: 'SY-02', label: '권한 관리', path: '/permissions' },
        ],
      },
    ],
  },
]

/** 모든 하위 화면 [{ key, label, path, parent, group }] */
export const SCREENS = NAVIGATION.flatMap((g) =>
  g.items.flatMap((item) => (item.children ?? []).map((c) => ({ ...c, parent: item.label, group: g.group }))),
)

export const findScreen = (key) => SCREENS.find((s) => s.key === key)

/** 화면 key로 브레드크럼 만들기: [{label, path?}] */
export function getBreadcrumb(current, extra = []) {
  const s = findScreen(current)
  if (!s) return extra
  return [{ label: s.group }, { label: s.parent }, { label: s.label, path: s.path }, ...extra]
}
