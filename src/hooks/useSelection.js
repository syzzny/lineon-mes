import { useCallback, useState } from 'react'

/**
 * 목록 행 선택 상태 (페이지를 넘겨도 선택이 유지됨)
 * 어느 목록 화면에서든 재사용할 수 있습니다.
 */
export default function useSelection(initial = []) {
  const [selected, setSelected] = useState(() => new Set(initial))

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /** ids를 모두 선택하거나(on=true) 모두 해제(on=false) */
  const setMany = useCallback((ids, on) => {
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  return { selected, count: selected.size, toggle, setMany, clear }
}
