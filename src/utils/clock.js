/**
 * 데모용 시계 — 시드 데이터의 기준 시각(10.22 14:32)에서 시작해 실제 흐른 시간만큼 움직입니다.
 * 새로 기록하는 이벤트(실적, 비가동 등)가 이 시각을 사용합니다.
 */
import { NOW_TIME, TODAY } from '../data/workOrders'

const [h, m] = NOW_TIME.split(':').map(Number)
const BASE_MIN = h * 60 + m
const LOADED = Date.now()
const pad = (n) => String(n).padStart(2, '0')

/** 하루 중 분(0~1439) */
export const nowMinutes = () => Math.min(23 * 60 + 59, BASE_MIN + Math.floor((Date.now() - LOADED) / 60000))
export const nowTime = () => {
  const t = nowMinutes()
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`
}
/** "2026-10-22 14:32" */
export const stamp = () => `${TODAY} ${nowTime()}`

/** "YYYY-MM-DD HH:MM" → 기준일 자정부터 분 (다른 날짜는 하루 단위로 더함) */
export const toMinutes = (s) => {
  const [d, t] = s.split(' ')
  const [hh, mm] = t.split(':').map(Number)
  const days = Math.round((new Date(d) - new Date(TODAY)) / 86400000)
  return days * 1440 + hh * 60 + mm
}

/** 두 시각 사이 분 (end 없으면 지금까지) */
export const minutesBetween = (start, end) => Math.max(0, (end ? toMinutes(end) : nowMinutes()) - toMinutes(start))

/** 95 → "1시간 35분" */
export const formatDuration = (min) => {
  if (min < 60) return `${min}분`
  const hh = Math.floor(min / 60)
  return min % 60 ? `${hh}시간 ${min % 60}분` : `${hh}시간`
}

/** "2026-10-22 13:57" → "10.22 13:57" */
export const shortStamp = (s) => (s ? `${s.slice(5, 7)}.${s.slice(8, 10)} ${s.slice(11)}` : '')
