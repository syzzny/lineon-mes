/** PR-01 실적 현황 — 입력된 생산실적을 기간·라인·상태로 조회 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import FilterChip from '../components/FilterChip'
import DataTable from '../components/DataTable/DataTable'
import { LinkCell, TwoLineCell } from '../components/cells'
import { FilterBar, ListFooter, SearchInput } from '../components/list/ListParts'
import { Card, KpiCard } from '../components/panels'
import { BarChart } from '../components/charts'
import { Button, StatusBadge } from '../components/ui'
import useListQuery from '../hooks/useListQuery'
import { useMes } from '../store/MesStore'
import { useToast } from '../store/ToastContext'
import { LINES, TODAY } from '../data/workOrders'
import { formatNumber, percent } from '../utils/format'
import { shortStamp } from '../utils/clock'
import './Results.scss'

const RESULT_STATUSES = ['승인 대기', '승인', '반려']
const PERIODS = [
  { key: 'today', label: '오늘', from: TODAY },
  { key: 'week', label: '이번 주', from: '2026-10-19' },
  { key: 'month', label: '이번 달', from: '2026-10-01' },
]

const FILTERS = {
  line: { match: (r, v) => v.includes(r.line) },
  status: { match: (r, v) => v.includes(r.status) },
}
const SORTERS = {
  at: (a, b) => a.at.localeCompare(b.at),
  good: (a, b) => a.good - b.good,
  rate: (a, b) => a.rate - b.rate,
}
const COLUMNS = [
  { key: 'at', header: '입력 시각', sortable: true, render: (r) => <span className="num">{shortStamp(r.at)}</span> },
  { key: 'wo', header: '작업지시', render: (r) => <LinkCell to={`/work-orders/${r.woId}`}>{r.woId}</LinkCell> },
  { key: 'item', header: '품목', render: (r) => <TwoLineCell primary={r.itemName} secondary={r.itemCode} /> },
  { key: 'line', header: '라인 · 설비', render: (r) => <TwoLineCell primary={r.line} secondary={r.equip} /> },
  { key: 'worker', header: '작업자', render: (r) => r.worker },
  { key: 'good', header: '양품', sortable: true, align: 'right', render: (r) => <span className="num">{formatNumber(r.good)}</span> },
  { key: 'defect', header: '불량', align: 'right', render: (r) => <span className="num">{formatNumber(r.defect)}</span> },
  { key: 'rate', header: '불량률', sortable: true, align: 'right', render: (r) => <span className={`num ${r.rate > 2 ? 'is-danger' : ''}`}>{r.rate.toFixed(1)}%</span> },
  { key: 'status', header: '상태', render: (r) => <StatusBadge status={r.status} /> },
]

export default function Results() {
  const navigate = useNavigate()
  const toast = useToast()
  const { results } = useMes()
  const [period, setPeriod] = useState('week')
  const from = PERIODS.find((p) => p.key === period).from

  const rows = useMemo(
    () => results.filter((r) => r.at >= from).map((r) => ({ ...r, rate: r.good + r.defect ? (r.defect / (r.good + r.defect)) * 100 : 0 })).sort((a, b) => b.at.localeCompare(a.at)),
    [results, from],
  )
  const q = useListQuery(rows, { filters: FILTERS, sorters: SORTERS, search: (r) => [r.woId, r.itemName, r.itemCode, r.equip, r.worker], pageSize: 20, persistKey: 'lineon:list:results' })

  const list = q.list
  const good = list.reduce((n, r) => n + r.good, 0)
  const defect = list.reduce((n, r) => n + r.defect, 0)
  const pending = list.filter((r) => r.status === '승인 대기').length
  const byLine = LINES.map((l) => ({ label: l, value: list.filter((r) => r.line === l).reduce((n, r) => n + r.good, 0), state: 'done' }))

  return (
    <AppLayout current="PR-01">
      <main className="page">
        <header className="page-top">
          <div>
            <h1>실적 현황</h1>
            <p>현장 태블릿에서 입력한 생산실적 · 반장이 승인하면 확정됩니다</p>
          </div>
          <div className="page-top__right">
            <div className="seg" role="group" aria-label="기간">
              {PERIODS.map((p) => <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</button>)}
            </div>
            <Button icon="down" onClick={() => toast(`실적 ${formatNumber(list.length)}건을 엑셀로 내보냈어요`)}>내보내기</Button>
            <Button variant="primary" icon="check" onClick={() => navigate('/results/approval')}>실적 승인 {pending ? `(${pending})` : ''}</Button>
          </div>
        </header>

        <div className="results-top">
          <div className="kpi-row results-top__kpis">
            <KpiCard label="양품" value={formatNumber(good)} unit="EA" sub={`${list.length}건 입력`} />
            <KpiCard label="불량" value={formatNumber(defect)} unit="EA" sub={`불량률 ${good + defect ? ((defect / (good + defect)) * 100).toFixed(1) : '0.0'}%`} to="/defects" />
            <KpiCard label="승인 완료율" value={percent(list.filter((r) => r.status === '승인').length, list.length)} unit="%" meter={percent(list.filter((r) => r.status === '승인').length, list.length)} meterTone="success" sub={`승인 대기 ${pending}건`} to="/results/approval" />
            <KpiCard label="반려" value={list.filter((r) => r.status === '반려').length} unit="건" sub="작업자 재입력 필요" />
          </div>
          <Card title="라인별 양품" className="results-top__chart">
            <div className="card__body">
              <BarChart data={byLine} unit="EA" height={150} ariaLabel="라인별 양품 수량" />
            </div>
          </Card>
        </div>

        <section className="data-card" aria-label="실적 목록">
          <FilterBar
            onReset={q.isDirty ? q.resetFilters : null}
            end={<SearchInput id="res-search" value={q.query} onChange={q.setQuery} placeholder="작업지시·품목·설비·작업자" label="실적 검색" />}
          >
            <FilterChip label="라인" options={LINES} selected={q.values.line} onChange={(v) => q.setFilter('line', v)} />
            <FilterChip label="상태" options={RESULT_STATUSES} selected={q.values.status} onChange={(v) => q.setFilter('status', v)} />
          </FilterBar>
          <DataTable
            columns={COLUMNS}
            rows={q.pageRows}
            caption={`생산실적 ${list.length}건`}
            sort={q.sort}
            onSort={q.cycleSort}
            minWidth={1000}
            empty={{ title: '조건에 맞는 실적이 없어요', actionLabel: '필터 초기화', onAction: q.resetFilters }}
          />
          <ListFooter pagination={q.pagination} pageSize={q.pageSize} pageSizes={[20, 50]} onPageSize={q.setPageSize} onPage={q.setPage} />
        </section>
      </main>
    </AppLayout>
  )
}
