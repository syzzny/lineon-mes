/**
 * 화면 여러 곳에서 쓰는 업무 계산 — 설비 집계, 납기 위험, 가동 타임라인
 */
import { TODAY } from '../data/workOrders'
import { LINE_DONE_BASE, LINE_PLAN } from '../data/mes'
import { dayDiff } from './format'
import { minutesBetween, toMinutes } from './clock'

export const EQUIP_STATUSES = ['가동', '비가동', '대기', '점검']

/** { 가동: n, 비가동: n, 대기: n, 점검: n } */
export const countByStatus = (equipment) =>
  Object.fromEntries(EQUIP_STATUSES.map((s) => [s, equipment.filter((e) => e.status === s).length]))

/** 라인 오늘 생산량 / 계획 */
export const lineProgress = (line, extraOutput) => {
  const done = LINE_DONE_BASE[line] + (extraOutput?.[line] ?? 0)
  return { done, plan: LINE_PLAN[line], pct: Math.round((done / LINE_PLAN[line]) * 100) }
}

const WORK_HOURS = 9 // 08:00–17:00
const END_MIN = 17 * 60

/**
 * 납기 위험 판단
 * - 지연: 납기가 지났는데 완료되지 않음
 * - 부족: 남은 수량을 표준 사이클 타임으로 만들 시간이 납기까지의 근무시간보다 큼
 * - 여유 적음: 남는 시간이 4시간 미만
 * @returns { level: 'late' | 'short' | 'tight' | 'ok', label, tone, hours }
 */
export function dueRisk(wo, items, nowMin) {
  if (wo.status === '완료' || wo.status === '취소') return { level: 'ok' }
  const diff = dayDiff(wo.due, TODAY)
  if (diff < 0) return { level: 'late', label: `지연 ${-diff}일`, tone: 'danger', hours: 999 }
  const item = items.find((i) => i.code === wo.itemCode)
  const need = ((wo.qty - wo.done) * (item?.cycle ?? 60)) / 3600 / (wo.line === '가공' ? 4 : 2) // 라인 내 병행 작업 반영
  const today = Math.max(0, END_MIN - nowMin) / 60
  const avail = today + diff * WORK_HOURS
  const gap = avail - need
  if (gap < 0) return { level: 'short', label: `${Math.ceil(-gap)}시간 부족`, tone: 'warning', hours: -gap }
  if (gap < 4) return { level: 'tight', label: '여유 적음', tone: 'warning', hours: gap - 100 }
  return { level: 'ok', hours: gap - 1000 }
}

/** 오늘 08:00부터 지금까지의 설비 가동 구간 */
export function equipTimeline(equip, downtime, nowMin) {
  const start = 480
  const end = Math.min(nowMin, 1020)
  const today = downtime
    .filter((d) => d.equip === equip.id && d.start.startsWith(TODAY))
    .map((d) => ({
      from: toMinutes(d.start),
      to: Math.min(d.end ? toMinutes(d.end) : nowMin, d.planned ? toMinutes(d.end) : end),
      kind: d.planned ? 'plan' : d.reason === '셋업·품목 전환' ? 'setup' : 'down',
      note: d.reason,
    }))
    .sort((a, b) => a.from - b.from)
  const segs = []
  let cur = start
  const idle = equip.status === '대기'
  today.forEach((d) => {
    if (d.from > cur) segs.push({ from: cur, to: Math.min(d.from, end), kind: idle && d.from >= end ? 'setup' : 'run' })
    segs.push(d)
    cur = Math.max(cur, d.to)
  })
  if (cur < end) segs.push({ from: cur, to: end, kind: idle ? 'setup' : 'run', note: idle ? '작업 대기' : undefined })
  return segs.filter((s) => s.to > s.from)
}

/** 구간들의 분 합계 */
export const sumKind = (segs, kind) => segs.filter((s) => s.kind === kind).reduce((n, s) => n + (s.to - s.from), 0)

/** 비가동 1건 길이(분) */
export const downtimeMinutes = (d) => minutesBetween(d.start, d.end)

/** 설비에서 지금 돌아가는 작업지시 (번호가 가장 큰 진행·일시정지 건) */
export const currentWoOf = (workOrders, equip) =>
  workOrders
    .filter((w) => w.equip === equip && (w.status === '진행' || w.status === '일시정지'))
    .sort((a, b) => b.id.localeCompare(a.id))[0]

/** 실적 승인 시 확인이 필요한 이유 (없으면 빈 배열) */
export function resultFlags(r, wo) {
  const flags = []
  const total = r.good + r.defect
  const rate = total ? (r.defect / total) * 100 : 0
  if (rate > 2) flags.push(`불량률 ${rate.toFixed(1)}% · 기준 2.0% 초과`)
  if (wo && wo.done > wo.qty) flags.push(`지시수량 ${wo.qty.toLocaleString('ko-KR')} EA 초과 생산`)
  if (r.log?.some((l) => l.includes('실행 취소'))) flags.push('실행 취소 기록이 있어요')
  return flags
}
