/** PP-01 생산계획 — 주간 간트. 설비별로 작업지시 막대를 보고, 미발행 계획(점선)은 눌러서 바로 작업지시 발행 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import { Card, Dot, KpiCard } from '../components/panels'
import { Button, IconButton } from '../components/ui'
import { useMes } from '../store/MesStore'
import { EQUIPMENT, LINES, TODAY, addDays, isLate } from '../data/workOrders'
import { PLAN_ONLY } from '../data/mes'
import { formatNumber, percent } from '../utils/format'
import { levelOf } from '../config/access'
import './Plans.scss'

const WEEK = ['월', '화', '수', '목', '금', '토', '일']
const WEEKS = [
  { no: 42, start: '2026-10-12' },
  { no: 43, start: '2026-10-19' },
  { no: 44, start: '2026-10-26' },
]

/** 겹치는 막대를 줄(lane)로 나눔 */
function toLanes(bars) {
  const lanes = []
  bars
    .sort((a, b) => a.from.localeCompare(b.from))
    .forEach((b) => {
      const lane = lanes.find((l) => l[l.length - 1].to < b.from)
      if (lane) lane.push(b)
      else lanes.push([b])
    })
  return lanes
}

export default function Plans() {
  const navigate = useNavigate()
  const { workOrders, items, equipment, user, permissions } = useMes()
  const [weekIdx, setWeekIdx] = useState(1)
  const [lineFilter, setLineFilter] = useState(() => (user.line && user.line !== '전체' ? user.line : '가공'))
  const [hover, setHover] = useState(null)
  const canIssue = levelOf(permissions, user.role, 'PP-05') === '처리'

  const week = WEEKS[weekIdx]
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.start, i))
  const end = days[6]
  const inWeek = (from, to) => from <= end && to >= week.start
  const col = (d) => Math.max(0, Math.min(7, Math.round((new Date(d) - new Date(week.start)) / 86400000)))

  const wos = workOrders.filter((w) => w.status !== '취소' && inWeek(w.start, w.due) && (!lineFilter || w.line === lineFilter))
  const issued = new Set(workOrders.map((w) => w.planRef).filter(Boolean))
  const plans = PLAN_ONLY.filter((p) => !issued.has(p.id) && inWeek(p.from, p.to) && (!lineFilter || p.line === lineFilter))

  const totalQty = wos.reduce((n, w) => n + w.qty, 0) + plans.reduce((n, p) => n + p.qty, 0)
  const doneQty = wos.reduce((n, w) => n + w.done, 0)

  const issue = (p) => {
    const item = items.find((i) => i.code === p.itemCode)
    const q = new URLSearchParams({ itemCode: p.itemCode, qty: p.qty, due: p.to, line: p.line, start: p.from < TODAY ? TODAY : p.from, plan: p.plan, planRef: p.id })
    if (!item) return
    navigate(`/work-orders/new?${q}`)
  }

  const bar = (b) => {
    const from = b.from < week.start ? week.start : b.from
    const startCol = col(from)
    const span = Math.max(1, col(b.to > end ? end : b.to) - startCol + 1)
    return { gridColumn: `${startCol + 2} / span ${span}` }
  }

  return (
    <AppLayout current="PP-01">
      <main className="page">
        <header className="page-top">
          <div>
            <h1>생산계획</h1>
            <p>설비별 주간 일정 · 점선 막대는 아직 작업지시로 발행하지 않은 계획이에요</p>
          </div>
          <div className="page-top__right">
            <div className="week-nav">
              <IconButton icon="chevL" label="이전 주" onClick={() => setWeekIdx((i) => Math.max(0, i - 1))} disabled={weekIdx === 0} />
              <strong className="num">2026년 {week.no}주차 <small>{week.start.slice(5).replace('-', '.')} – {end.slice(5).replace('-', '.')}</small></strong>
              <IconButton icon="chevR" label="다음 주" onClick={() => setWeekIdx((i) => Math.min(WEEKS.length - 1, i + 1))} disabled={weekIdx === WEEKS.length - 1} />
            </div>
            <Button onClick={() => setWeekIdx(1)} disabled={weekIdx === 1}>이번 주</Button>
            {canIssue && <Button variant="primary" icon="plus" onClick={() => navigate('/work-orders/new')}>작업지시 등록</Button>}
          </div>
        </header>

        <div className="kpi-row">
          <KpiCard label="주간 계획 수량" value={formatNumber(totalQty)} unit="EA" sub={`작업지시 ${wos.length}건 + 미발행 ${plans.length}건`} />
          <KpiCard label="생산 진행" value={percent(doneQty, totalQty)} unit="%" meter={percent(doneQty, totalQty)} sub={`${formatNumber(doneQty)} EA 생산`} />
          <KpiCard label="미발행 계획" value={plans.length} unit="건" tone={plans.length ? 'brand' : undefined} sub="점선 막대를 눌러 발행" />
          <KpiCard label="지연" value={wos.filter(isLate).length} unit="건" tone={wos.some(isLate) ? 'danger' : undefined} sub="납기가 지난 작업지시" />
        </div>

        <Card
          className="gantt-card"
          title="설비별 주간 일정"
          action={
            <div className="gantt__tools">
              <div className="seg" role="group" aria-label="라인">
                <button type="button" aria-pressed={!lineFilter} onClick={() => setLineFilter('')}>전체</button>
                {LINES.map((l) => <button key={l} type="button" aria-pressed={lineFilter === l} onClick={() => setLineFilter(l)}>{l}</button>)}
              </div>
            </div>
          }
        >
          <div className="gantt__legend">
            <Dot tone="brand">진행</Dot><Dot tone="warning">일시정지</Dot><Dot tone="muted">대기</Dot><Dot tone="success">완료</Dot><Dot tone="danger">지연</Dot>
            <span className="gantt__legend-plan">미발행 계획</span>
          </div>
          <div className="gantt-scroll">
            <div className="gantt" role="table" aria-label={`${week.no}주차 설비별 일정`}>
              <div className="gantt__row gantt__row--head" role="row">
                <span role="columnheader">설비</span>
                {days.map((d, i) => (
                  <span key={d} role="columnheader" className={`num ${d === TODAY ? 'is-today' : ''} ${i >= 5 ? 'is-weekend' : ''}`}>
                    {WEEK[i]} {d.slice(5).replace('-', '.')}
                  </span>
                ))}
              </div>

              {(lineFilter ? [lineFilter] : LINES).map((line) => {
                const linePlans = plans.filter((p) => p.line === line)
                const unassigned = wos.filter((w) => w.line === line && !w.equip)
                const rows = [
                  ...EQUIPMENT[line].map((eq) => ({ key: eq, label: eq, sub: equipment.find((e) => e.id === eq)?.status, bars: wos.filter((w) => w.equip === eq) })),
                  { key: `${line}-none`, label: '미배정', sub: '', bars: unassigned },
                  { key: `${line}-plan`, label: '미발행 계획', sub: '', plans: linePlans },
                ].filter((r) => r.bars?.length || r.plans?.length)
                return (
                  <div key={line} className="gantt__group" role="rowgroup">
                    <div className="gantt__line" role="row"><strong role="cell">{line} 라인</strong></div>
                    {rows.map((r) => {
                      const lanes = r.plans ? toLanes(r.plans.map((p) => ({ ...p, isPlan: true }))) : toLanes(r.bars.map((w) => ({ ...w, from: w.start, to: w.due })))
                      return (
                        <div key={r.key} className="gantt__row" role="row" style={{ gridTemplateRows: `repeat(${lanes.length}, 32px)` }}>
                          <span className="gantt__label" role="rowheader" style={{ gridRow: `1 / span ${lanes.length}` }}>
                            <span className="num">{r.label}</span>
                            {r.sub && r.sub !== '가동' && <small>{r.sub}</small>}
                          </span>
                          {days.map((d, i) => (
                            <span key={d} className={`gantt__cell ${d === TODAY ? 'is-today' : ''} ${i >= 5 ? 'is-weekend' : ''}`} style={{ gridColumn: i + 2, gridRow: `1 / span ${lanes.length}` }} aria-hidden="true" />
                          ))}
                          {lanes.flatMap((lane, li) =>
                            lane.map((b) =>
                              b.isPlan ? (
                                <button
                                  key={b.id}
                                  type="button"
                                  className="gantt__bar is-plan"
                                  style={{ ...bar(b), gridRow: li + 1 }}
                                  onClick={() => canIssue && issue(b)}
                                  disabled={!canIssue}
                                  title={canIssue ? '눌러서 작업지시 발행' : '작업지시 등록 권한이 없어요'}
                                >
                                  <Icon name="plus" size={13} /> {items.find((i) => i.code === b.itemCode)?.name} · <span className="num">{formatNumber(b.qty)}</span>
                                </button>
                              ) : (
                                <Link
                                  key={b.id}
                                  to={`/work-orders/${b.id}`}
                                  className={`gantt__bar is-${isLate(b) ? 'late' : b.status}`}
                                  style={{ ...bar(b), gridRow: li + 1 }}
                                  onMouseEnter={() => setHover(b.id)}
                                  onMouseLeave={() => setHover(null)}
                                  aria-label={`${b.id} ${b.itemName} ${b.status} ${b.start}~${b.due}`}
                                >
                                  <span className="gantt__fill" style={{ width: `${percent(b.done, b.qty)}%` }} />
                                  <span className="gantt__text"><span className="num">{b.id.slice(-4)}</span> {b.itemName}</span>
                                  {hover === b.id && (
                                    <span className="chart-tip gantt__tip">
                                      <strong className="num">{b.id} · {b.status}</strong>
                                      <span>{b.itemName}</span>
                                      <span className="num">{formatNumber(b.done)} / {formatNumber(b.qty)} EA · 납기 {b.due.slice(5).replace('-', '.')}</span>
                                    </span>
                                  )}
                                </Link>
                              ),
                            ),
                          )}
                        </div>
                      )
                    })}
                    {rows.length === 0 && <p className="gantt__empty">이 주에 계획된 작업이 없어요</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </main>
    </AppLayout>
  )
}
