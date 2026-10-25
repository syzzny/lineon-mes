/**
 * 권한 규칙 — SY-02 권한 매트릭스의 값으로 메뉴 노출·버튼 사용 여부를 정합니다.
 * 처리: 조회 + 등록·수정 / 조회: 읽기만 / 숨김: 메뉴에서 감춤
 */
import { NAVIGATION, SCREENS } from './navigation'

/** 화면 ID → 권한 매트릭스의 행 key */
export function permKeyOf(screen) {
  if (!screen) return null
  if (screen.startsWith('DB')) return 'dashboard'
  if (screen === 'PP-04') return 'PP-03'
  if (screen.startsWith('PP')) return screen
  if (screen.startsWith('PR')) return 'results'
  if (screen.startsWith('QC')) return 'quality'
  if (screen.startsWith('EQ')) return 'equipment'
  if (screen.startsWith('MD')) return 'master'
  if (screen.startsWith('SY')) return 'system'
  return null
}

export const levelOf = (permissions, role, screen) => {
  const key = permKeyOf(screen)
  if (!key) return '처리'
  return permissions[role]?.[key] ?? '숨김'
}

/** 숨길 화면 ID + 하위 화면이 모두 숨겨진 상위 메뉴 key */
export function hiddenKeys(permissions, role) {
  const hidden = SCREENS.filter((s) => levelOf(permissions, role, s.key) === '숨김').map((s) => s.key)
  NAVIGATION.forEach((g) =>
    g.items.forEach((it) => {
      if (it.children?.every((c) => hidden.includes(c.key))) hidden.push(it.key)
    }),
  )
  return hidden
}

/** 역할별 첫 화면 */
export function homeOf(permissions, role) {
  const visible = SCREENS.find((s) => levelOf(permissions, role, s.key) !== '숨김')
  return visible?.path ?? '/tablet'
}
