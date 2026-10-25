import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import FilterChip from '../components/FilterChip'
import DataTable from '../components/DataTable/DataTable'
import { DueCell, LinkCell, PersonCell, ProgressCell, TwoLineCell } from '../components/cells'
import { FilterBar, ListFooter, PageHeader, SearchInput, ViewTabs } from '../components/list/ListParts'
import { Field, Select } from '../components/form'
import { Button, StatusBadge } from '../components/ui'
import { BulkActionBar, ConfirmModal } from '../components/feedback'
import useListQuery from '../hooks/useListQuery'
import useSelection from '../hooks/useSelection'
import { useWorkOrders } from '../store/MesStore'
import { useToast } from '../store/ToastContext'
import { LEADS, LINES, TODAY } from '../data/workOrders'
import { CAN_CANCEL, CANCEL_REASONS, DEFAULT_STATUS_FILTER, LEAD_TONE, PAGE_SIZES, WO_STATUSES, WO_VIEWS } from '../constants/workOrder'
import { formatNumber } from '../utils/format'

const LEAD_NAMES = [...new Set(Object.values(LEADS))]

/* ---------- 목록 설정: 어떤 필터·정렬·컬럼을 쓸지만 정의 ---------- */

const FILTERS = {
  status: { initial: DEFAULT_STATUS_FILTER, match: (w, v) => v.includes(w.status) },
  line: { match: (w, v) => v.includes(w.line) },
  lead: { match: (w, v) => v.includes(w.lead) },
}

const SORTERS = { due: (a, b) => a.due.localeCompare(b.due) }

const searchFields = (w) => [w.id, w.itemName, w.itemCode, w.equip]

const closedLabel = (w) => (w.status === '완료' ? '완료' : w.status === '취소' ? '취소됨' : null)

const COLUMNS = [
  { key: 'id', header: '작업지시', render: (w) => <LinkCell to={`/work-orders/${w.id}`}>{w.id}</LinkCell> },
  { key: 'status', header: '상태', render: (w) => <StatusBadge status={w.status} /> },
  { key: 'item', header: '품목', render: (w) => <TwoLineCell primary={w.itemName} secondary={w.itemCode} /> },
  { key: 'line', header: '라인 · 설비', render: (w) => <TwoLineCell primary={w.line} secondary={w.equip} /> },
  { key: 'progress', header: '진행률', render: (w) => <ProgressCell done={w.done} total={w.qty} /> },
  { key: 'due', header: '납기', sortable: true, render: (w) => <DueCell due={w.due} today={TODAY} closed={closedLabel(w)} /> },
  { key: 'lead', header: '담당 반장', render: (w) => <PersonCell name={w.lead} tone={LEAD_TONE[w.lead]} /> },
]

/* ---------- 화면 ---------- */
// 필터·정렬·페이지는 useListQuery, 행 선택은 useSelection이 맡고 이 화면은 조립만 함

export default function WorkOrderList() {
  const navigate = useNavigate()
  const toast = useToast()
  const { workOrders, cancel } = useWorkOrders()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reason, setReason] = useState('')

  const q = useListQuery(workOrders, {
    filters: FILTERS, views: WO_VIEWS, sorters: SORTERS, search: searchFields,
    pageSize: PAGE_SIZES[0], persistKey: 'lineon:list:work-orders',
  })
  const sel = useSelection()

  // 상단 전체 검색에서 넘어온 검색어 적용 (이미 목록에 있을 때도)
  const location = useLocation()
  const incoming = location.state?.q
  const { setQuery, setView } = q
  useEffect(() => {
    if (incoming) { setQuery(incoming); setView('all') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming, location.key])

  // 일괄 취소: 대기 상태만 취소 가능 (상태별 액션 규칙)
  // 선택한 것 중 취소 가능한 건(cancellable)과 제외되는 건(blocked)을 나눠서 모달에 안내
  const selectedRows = workOrders.filter((w) => sel.selected.has(w.id))
  const cancellable = selectedRows.filter(CAN_CANCEL)
  const blocked = selectedRows.filter((w) => !CAN_CANCEL(w))

  const openCancel = () => { setReason(''); setConfirmOpen(true) }
  const cancelSelected = () => {
    cancel(cancellable.map((w) => w.id), reason)
    sel.clear()
    setConfirmOpen(false)
    toast(`작업지시 ${cancellable.length}건을 취소했어요`)
  }

  return (
    <AppLayout current="PP-03">
      <main className="page">
        <PageHeader
          title="작업지시"
          count={workOrders.length}
          description="발행된 작업지시를 조회하고 배정·취소를 한 번에 처리합니다"
          actions={
            <>
              <Button icon="down" onClick={() => toast(`${formatNumber(q.list.length)}건을 엑셀로 내보냈어요`)}>내보내기</Button>
              <Button variant="primary" icon="plus" onClick={() => navigate('/work-orders/new')}>작업지시 등록</Button>
            </>
          }
        />

        <section className="data-card" aria-label="작업지시 목록">
          <ViewTabs views={WO_VIEWS} counts={q.viewCounts} value={q.view} onChange={q.setView} />

          <FilterBar
            onReset={q.isDirty ? q.resetFilters : null}
            end={<SearchInput id="wo-search" value={q.query} onChange={q.setQuery} placeholder="번호·품목·설비 검색" label="작업지시 검색" />}
          >
            <FilterChip label="상태" options={WO_STATUSES} selected={q.values.status} onChange={(v) => q.setFilter('status', v)} />
            <FilterChip label="라인" options={LINES} selected={q.values.line} onChange={(v) => q.setFilter('line', v)} />
            <FilterChip label="담당 반장" options={LEAD_NAMES} selected={q.values.lead} onChange={(v) => q.setFilter('lead', v)} />
          </FilterBar>

          <DataTable
            columns={COLUMNS}
            rows={q.pageRows}
            caption={`작업지시 목록, ${q.list.length}건`}
            selection={{ selected: sel.selected, onToggle: sel.toggle, onToggleMany: sel.setMany }}
            sort={q.sort}
            onSort={q.cycleSort}
            rowMenuLabel={(w) => `${w.id} 상세 보기`}
            onRowMenu={(w) => navigate(`/work-orders/${w.id}`)}
            empty={{
              title: '조건에 맞는 작업지시가 없어요',
              description: '필터를 바꾸거나 검색어를 확인해 주세요',
              actionLabel: '필터 초기화',
              onAction: q.resetFilters,
            }}
          />

          <ListFooter pagination={q.pagination} pageSize={q.pageSize} pageSizes={PAGE_SIZES} onPageSize={q.setPageSize} onPage={q.setPage} />
        </section>

        <BulkActionBar
          count={sel.count}
          onAssign={() => navigate(`/assignments?ids=${[...sel.selected].join(',')}&line=${workOrders.find((w) => sel.selected.has(w.id))?.line ?? ''}`)}
          onCancel={openCancel}
          onClear={sel.clear}
        />

        <ConfirmModal
          open={confirmOpen}
          danger
          title={blocked.length ? `선택 ${sel.count}건 중 ${cancellable.length}건만 취소됩니다` : `작업지시 ${cancellable.length}건을 취소할까요?`}
          confirmLabel={cancellable.length ? `${cancellable.length}건 취소` : '확인'}
          confirmDisabled={cancellable.length > 0 && !reason}
          onConfirm={cancellable.length ? cancelSelected : () => setConfirmOpen(false)}
          onClose={() => setConfirmOpen(false)}
        >
          {blocked.length > 0 && (
            <>
              <p>대기 상태가 아닌 작업지시는 취소할 수 없어 제외됩니다. 진행 중인 작업은 상세 화면에서 "조기 종료"를 이용하세요.</p>
              <ul>
                {blocked.slice(0, 5).map((w) => (
                  <li key={w.id}>제외 · <span className="num">{w.id}</span> · {w.status}</li>
                ))}
                {blocked.length > 5 && <li>외 {blocked.length - 5}건</li>}
              </ul>
            </>
          )}
          {cancellable.length > 0 && (
            <Field label="취소 사유" required>
              {(p) => <Select {...p} options={CANCEL_REASONS} placeholder="사유를 선택하세요" value={reason} onChange={(e) => setReason(e.target.value)} />}
            </Field>
          )}
        </ConfirmModal>
      </main>
    </AppLayout>
  )
}
