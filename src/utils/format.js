const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** 1240 → "1,240" */
export const formatNumber = (n) => n.toLocaleString('ko-KR')

/** "2026-10-24" → "10.24 (토)" */
export const formatShortDate = (iso) => {
  const d = new Date(iso + 'T00:00:00')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}.${dd} (${WEEK[d.getDay()]})`
}

/** 두 날짜("YYYY-MM-DD") 사이의 일수 (a - b) */
export const dayDiff = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000)

/** 0~100 사이 정수 퍼센트 */
export const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0)
