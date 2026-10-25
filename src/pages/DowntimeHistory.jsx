/** EQ-02 비가동 이력 — 기간·라인·사유로 좁혀 보고, 사유별 비중을 눌러 바로 필터 */
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import FilterChip from '../components/FilterChip'
import DataTable from '../components/DataTable/DataTable'
import DowntimeModal from '../components/DowntimeModal'
import { LinkCell } from '../components/cells'
import { FilterBar, ListFooter, SearchInput } from '../components/list/ListParts'
import { Card, Dot, KpiCard, Meter } from '../components/panels'
import { Button } from '../components/ui'
import { Modal } from '../components/feedback'
import { Field, Select } from '../components/form'
import useListQuery from '../hooks/useListQuery'
import { useMes } from '../store/MesStore'
import { LINES, TODAY } from '../data/workOrders'
import { DOWNTIME_REASONS, PLANNED_REASON } from '../data/mes'
import { REASON_TONE } from '../constants/tones'
import { downtimeMinutes } from '../utils/mes'
import { formatDuration, shortStamp } from '../utils/clock'
import { formatNumber } from '../utils/format'
import { levelOf } from '../config/access'
import './DowntimeHistory.scss'

const PERIODS = [
  { key: 'today', label: '오늘', from: TODAY },
  { key: 'week', label: '이번 주', from: '2026-10-19' },
  { key: 'month', label: '이번 달', from: '2026-10-01' },
]
const REASONS = [...DOWNTIME_REASONS, PLANNED_REASON]

const FILTERS = {
  line: { match: (d, v) => v.includes(d.line) },
  reason: { match: (d, v) => v.includes(d.reason) },
  equip: { initial: '', match: (d, v) => d.equip === v },
}
const SORTERS = { start: (a, b) => a.start.localeCompare(b.start), minutes: (a, b) => a.minutes - b.minutes }

const COLUMNS = [
  { key: 'start', header: '시작', sortable: true, render: (d) => <span className="num">{shortStamp(d.start)}</span> },
  { key: 'end', header: '종료', render: (d) => (d.end ? <span className="num">{d.end.slice(11)}</span> : <strong className="is-danger">진행 중</strong>) },
  { key: 'minutes', header: '시간', sortable: true, align: 'right', render: (d) => <span className={`num ${d.end ? '' : 'is-danger'}`}>{formatDuration(d.minutes)}</span> },
  { key: 'equip', header: '라인 · 설비', render: (d) => <span>{d.line} · <Link to={`/equipment/${d.equip}`} className="cell-link num">{d.equip}</Link></span> },
  { key: 'reason', header: '사유', render: (d) => <Dot tone={REASON_TONE[d.reason]}>{d.reason}</Dot> },
  { key: 'wo', header: '작업지시', render: (d) => (d.woId ? <LinkCell to={`/work-orders/${d.woId}`}>{d.woId}</LinkCell> : <span className="muted">—</span>) },
  { key: 'by', header: '등록자', render: (d) => d.by },
  { key: 'note', header: '비고', render: (d) => <span className="muted">{d.note || '—'}</span> },
]

export default function DowntimeHistory() {
  const [params] = useSearchParams()
  const { downtime, equipment, user, permissions } = useMes()
  const [period, setPeriod] = useState('month')
  const [report, setReport] = useState(null) // 'pick' | 설비 ID
  const [pick, setPick] = useState('')
  const canAct = levelOf(permissions, user.role, 'EQ-02') === '처리'

  const from = PERIODS.find((p) => p.key === period).from
  const rows = useMemo(
    () =>
      downtime
        .filter((d) => d.start >= from)
        .map((d) => ({ ...d, line: equipment.find((e) => e.id === d.equip)?.line, minutes: downtimeMinutes(d) }))
        .sort((a, b) => b.start.localeCompare(a.start)),
    [downtime, equipment, from],
  )

  const q = useListQuery(rows, {
    filters: { ...FILTERS, equip: { ...FILTERS.equip, initial: params.get('equip') ?? '' } },
    sorters: SORTERS,
    search: (d) => [d.equip, d.reason, d.by, d.note, d.woId],
    pageSize: 20,
  })

  const list = q.list
  const unplanned = list.filter((d) => !d.planned)
  const total = unplanned.reduce((n, d) => n + d.minutes, 0)
  const byReason = DOWNTIME_REASONS.map((r) => {
    const items = unplanned.filter((d) => d.reason === r)
    return { reason: r, count: items.length, minutes: items.reduce((n, d) => n + d.minutes, 0) }
  }).sort((a, b) => b.minutes - a.minutes)
  const top = byReason[0]
  const open = list.filter((d) => !d.end && !d.planned)

  return (
    <AppLayout current="EQ-02">
      <main className="page">
        <header className="page-top">
          <div>
            <h1>비가동 이력</h1>
            <p>설비가 멈춘 기록을 사유별로 보고, 반복되는 원인을 찾습니다 · 계획 정비는 합계에서 제외</p>
          </div>
          <div className="page-top__right">
            <div className="seg" role="group" aria-label="기간">
              {PERIODS.map((p) => (
                <button key={p.key} type="button" aria-pressed={p.key === period} onClick={() => setPeriod(p.key)}>{p.label}</button>
              ))}
            </div>
            {canAct && <Button variant="primary" icon="plus" onClick={() => { setPick(''); setReport('pick') }}>비가동 등록</Button>}
          </div>
        </header>

        <div className="kpi-row">
          <KpiCard label="총 비가동 시간" value={(total / 60).toFixed(1)} unit="시간" sub={`${unplanned.length}건 · 계획 정비 제외`} />
          <KpiCard label="진행 중" value={open.length} unit="건" tone={open.length ? 'danger' : undefined} sub={open.length ? open.map((d) => d.equip).join(', ') : '멈춘 설비 없음'} />
          <KpiCard label="최다 사유" value={top?.minutes ? top.reason : '—'} sub={top?.minutes ? `${formatDuration(top.minutes)} · 전체의 ${Math.round((top.minutes / total) * 100)}%` : ''} />
          <KpiCard label="평균 복구 시간" value={unplanned.length ? Math.round(total / unplanned.length) : 0} unit="분" sub="목표 30분 이내" />
        </div>

        <div className="dth-grid">
          <Card title="사유별 비가동" desc="누르면 아래 목록을 그 사유로 좁혀요">
            <ul className="card__body reason-bars">
              {byReason.map((r) => {
                const on = q.values.reason?.length === 1 && q.values.reason[0] === r.reason
                return (
                  <li key={r.reason}>
                    <button type="button" className={on ? 'is-on' : ''} aria-pressed={on} onClick={() => q.setFilter('reason', on ? [] : [r.reason])}>
                      <span className="reason-bars__top">
                        <Dot tone={REASON_TONE[r.reason]}>{r.reason}</Dot>
                        <span className="num muted">{r.count}건</span>
                        <strong className="num">{formatDuration(r.minutes)}</strong>
                      </span>
                      <Meter value={total ? (r.minutes / byReason[0].minutes) * 100 : 0} tone={on ? 'brand' : 'neutral'} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>

          <section className="data-card" aria-label="비가동 목록">
            <FilterBar
              onReset={q.isDirty ? q.resetFilters : null}
              end={<SearchInput id="dt-search" value={q.query} onChange={q.setQuery} placeholder="설비·사유·등록자 검색" label="비가동 검색" />}
            >
              <FilterChip label="라인" options={LINES} selected={q.values.line} onChange={(v) => q.setFilter('line', v)} />
              <FilterChip label="사유" options={REASONS} selected={q.values.reason} onChange={(v) => q.setFilter('reason', v)} />
              {q.values.equip && (
                <button type="button" className="chip chip--active" onClick={() => q.setFilter('equip', '')}>
                  설비 <span className="chip__sep" /> <span className="num">{q.values.equip}</span> ✕
                </button>
              )}
            </FilterBar>
            <DataTable
              columns={COLUMNS}
              rows={q.pageRows}
              caption={`비가동 이력 ${list.length}건`}
              sort={q.sort}
              onSort={q.cycleSort}
              minWidth={960}
              empty={{ title: '조건에 맞는 비가동 기록이 없어요', actionLabel: '필터 초기화', onAction: q.resetFilters }}
            />
            <ListFooter pagination={q.pagination} pageSize={q.pageSize} pageSizes={[20, 50]} onPageSize={q.setPageSize} onPage={q.setPage} />
          </section>
        </div>

        <Modal
          open={report === 'pick'}
          onClose={() => setReport(null)}
          title="어느 설비인가요?"
          description="비가동을 등록할 설비를 고르세요"
          footer={<><Button onClick={() => setReport(null)}>취소</Button><Button variant="primary" disabled={!pick} onClick={() => setReport(pick)}>다음</Button></>}
        >
          <Field label="설비" required>
            {(p) => (
              <Select
                {...p}
                placeholder="설비 선택"
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                options={equipment.map((e) => ({ value: e.id, label: `${e.line} · ${e.id} ${e.name}${e.status !== '가동' && e.status !== '대기' ? ` (${e.status})` : ''}`, disabled: e.status === '비가동' || e.status === '점검' }))}
              />
            )}
          </Field>
        </Modal>
        <DowntimeModal open={Boolean(report && report !== 'pick')} equip={report} onClose={() => setReport(null)} />
        <p className="sr-only">{formatNumber(list.length)}건</p>
      </main>
    </AppLayout>
  )
}
