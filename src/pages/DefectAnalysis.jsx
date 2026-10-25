/** QC-02 불량 현황·분석 — 조건을 바꾸면 지표·차트·내역이 함께 바뀜. 유형 막대를 누르면 내역 필터 */
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import FilterChip from '../components/FilterChip'
import { Card, KpiCard, Meter, Tag } from '../components/panels'
import { LineChart } from '../components/charts'
import { Avatar, Button, StatusBadge } from '../components/ui'
import { ListFooter } from '../components/list/ListParts'
import { Modal } from '../components/feedback'
import { Field, Segmented, Textarea } from '../components/form'
import { useMes } from '../store/MesStore'
import { useToast } from '../store/ToastContext'
import { LINES, TODAY, addDays } from '../data/workOrders'
import { ACTION_STATUSES, CAUSE_4M, DAILY_OUTPUT, DEFECT_TYPES, LINE_PLAN } from '../data/mes'
import { formatNumber } from '../utils/format'
import { shortStamp } from '../utils/clock'
import { levelOf } from '../config/access'
import './DefectAnalysis.scss'

const TARGET = 2.0
const PERIODS = [
  { key: 'month', label: '이번 달', from: '2026-10-01', text: '10.01 – 10.22' },
  { key: '14d', label: '최근 14일', from: addDays(TODAY, -13), text: `${addDays(TODAY, -13).slice(5).replace('-', '.')} – 10.22` },
  { key: 'week', label: '이번 주', from: '2026-10-19', text: '10.19 – 10.22' },
]
const TOTAL_PLAN = Object.values(LINE_PLAN).reduce((a, b) => a + b, 0)
const PAGE = 10

export default function DefectAnalysis() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { defects, user, permissions, run } = useMes()
  const canAct = levelOf(permissions, user.role, 'QC-02') === '처리'
  const [period, setPeriod] = useState('month')
  const [lines, setLines] = useState([])
  const [type, setType] = useState(null)
  const [status, setStatus] = useState(params.get('status') ? [params.get('status')] : [])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE)
  const [edit, setEdit] = useState(null)

  const p = PERIODS.find((x) => x.key === period)
  const share = lines.length ? lines.reduce((n, l) => n + LINE_PLAN[l], 0) / TOTAL_PLAN : 1
  const base = defects.filter((d) => d.at >= p.from && (!lines.length || lines.includes(d.line)))

  // 일별 불량률
  const days = []
  for (let d = p.from; d <= TODAY; d = addDays(d, 1)) days.push(d)
  const output = Math.round(DAILY_OUTPUT * share)
  const points = days.map((d) => ({ label: d.slice(5).replace('-', '.'), value: Math.round((base.filter((x) => x.at.startsWith(d)).reduce((n, x) => n + x.qty, 0) / output) * 1000) / 10 }))
  const over = points.filter((x) => x.value > TARGET).length

  const qty = base.reduce((n, d) => n + d.qty, 0)
  const produced = output * days.length
  const rate = (qty / produced) * 100
  const byType = DEFECT_TYPES.map((t) => ({ t, n: base.filter((d) => d.type === t).reduce((a, d) => a + d.qty, 0) })).sort((a, b) => b.n - a.n)
  const top = byType[0]
  const topLine = LINES.map((l) => ({ l, n: base.filter((d) => d.type === top.t && d.line === l).reduce((a, d) => a + d.qty, 0) })).sort((a, b) => b.n - a.n)[0]
  const open = base.filter((d) => d.status === '미조치')
  const oldest = open.reduce((a, b) => (!a || b.at < a.at ? b : a), null)

  const list = base.filter((d) => (!type || d.type === type) && (!status.length || status.includes(d.status)))
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize))
  const cur = Math.min(page, pageCount)
  const rows = list.slice((cur - 1) * pageSize, cur * pageSize)

  const pickType = (t) => { setType((x) => (x === t ? null : t)); setPage(1) }

  return (
    <AppLayout current="QC-02">
      <main className="page">
        <header className="page-top">
          <div>
            <h1>불량 현황·분석</h1>
            <p>조건을 바꾸면 지표·차트·내역이 함께 바뀝니다</p>
          </div>
          <div className="page-top__right">
            <FilterChip
              label="기간"
              icon="cal"
              options={PERIODS.map((x) => x.label)}
              selected={[p.label]}
              summary={p.text}
              onChange={(v) => { const next = PERIODS.find((x) => x.label === v.filter((l) => l !== p.label)[0]); if (next) { setPeriod(next.key); setPage(1) } }}
            />
            <FilterChip label="라인" options={LINES} selected={lines} onChange={(v) => { setLines(v); setPage(1) }} />
            <Button icon="down" onClick={() => toast(`${p.text} 불량 리포트를 내보냈어요`)}>리포트 내보내기</Button>
            {canAct && <Button variant="primary" icon="plus" onClick={() => navigate('/defects/new')}>불량 등록</Button>}
          </div>
        </header>

        <div className="kpi-row">
          <KpiCard label="불량률" value={rate.toFixed(1)} unit="%" delta={{ text: `${rate <= 1.9 ? '−' : '+'}${Math.abs(1.9 - rate).toFixed(1)}%p`, good: rate <= 1.9 }} sub={`목표 ${TARGET.toFixed(1)}% 이하 · 지난달 1.9%`} />
          <KpiCard label="불량 수량" value={formatNumber(qty)} unit="EA" sub={`생산 ${formatNumber(produced)} EA 중`} />
          <KpiCard label="최다 유형" value={qty ? Math.round((top.n / qty) * 100) : 0} unit="%" sub={qty ? `${top.t} · ${topLine.l} 라인에서 ${top.n ? Math.round((topLine.n / top.n) * 100) : 0}%` : '—'} />
          <KpiCard
            label="미조치 불량" value={open.length} unit="건" tone={open.length ? 'danger' : undefined}
            badge={open.length ? <Tag tone="danger">확인 필요</Tag> : null}
            sub={oldest ? `가장 오래된 건 ${oldest.at.startsWith(TODAY) ? '오늘' : shortStamp(oldest.at).slice(0, 5)} ${oldest.at.slice(11)}` : '모두 조치됨'}
          />
        </div>

        <div className="qa-grid">
          <Card title="일별 불량률 추이" action={over ? <Tag tone="danger">목표 초과 {over}일</Tag> : <Tag tone="success">목표 이내</Tag>}>
            <div className="card__body">
              <LineChart points={points} target={TARGET} max={3} format={(v) => `${v}%`} height={210} ariaLabel="일별 불량률 추이 선 차트, 빨간 점선은 목표 2%" />
            </div>
          </Card>

          <Card title="유형별 불량" action={<small className="muted">누르면 내역 필터</small>}>
            <ul className="card__body pareto">
              {byType.map(({ t, n }) => (
                <li key={t}>
                  <button type="button" className={type === t ? 'is-on' : ''} aria-pressed={type === t} onClick={() => pickType(t)}>
                    <span className="pareto__top">
                      <span>{t}</span>
                      <span className="num muted">{formatNumber(n)}</span>
                      <strong className="num">{qty ? Math.round((n / qty) * 100) : 0}%</strong>
                    </span>
                    <Meter value={top.n ? (n / top.n) * 100 : 0} tone={type === t ? 'brand' : 'neutral'} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <section className="data-card" aria-label="불량 내역">
          <header className="qa-list__head">
            <h2>불량 내역 <span className="num">{formatNumber(list.length)}건</span></h2>
            {type && (
              <button type="button" className="chip chip--active" onClick={() => setType(null)} aria-label={`유형 ${type} 필터 해제`}>
                유형 · {type} <Icon name="x" size={14} />
              </button>
            )}
            <FilterChip label="조치 상태" options={ACTION_STATUSES} selected={status} onChange={(v) => { setStatus(v); setPage(1) }} />
          </header>
          <div className="table-scroll">
            <table className="simple-table qa-table">
              <thead>
                <tr><th>발생 일시</th><th>작업지시</th><th>품목</th><th>라인 · 설비</th><th>유형</th><th className="r">수량</th><th>등록자</th><th>조치 상태</th><th>LOT</th></tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td className="num">{shortStamp(d.at)}</td>
                    <td><Link to={`/work-orders/${d.woId}`} className="cell-link num">{d.woId}</Link></td>
                    <td>{d.itemName}</td>
                    <td className="num">{d.line} · {d.equip}</td>
                    <td>{d.type}</td>
                    <td className="r num">{d.qty}</td>
                    <td><span className="cell-person"><Avatar name={d.by} size={24} tone="gray" />{d.by}</span></td>
                    <td>
                      <button type="button" className="qa-status" onClick={() => setEdit(d)} disabled={!canAct} aria-label={`${d.id} 조치 입력`}>
                        <StatusBadge status={d.status} />
                        {canAct && <Icon name="edit" size={14} />}
                      </button>
                    </td>
                    <td><Link to={`/lots/${d.lot}`} className="qa-lot num">{d.lot}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="qa-empty">조건에 맞는 불량 내역이 없어요</p>}
          </div>
          <ListFooter
            pagination={{ page: cur, pageCount, from: list.length ? (cur - 1) * pageSize + 1 : 0, to: (cur - 1) * pageSize + rows.length, total: list.length }}
            pageSize={pageSize} pageSizes={[10, 20, 50]} onPageSize={(n) => { setPageSize(n); setPage(1) }} onPage={setPage}
          />
        </section>

        <ActionModal defect={edit} onClose={() => setEdit(null)} onSave={(changes) => { run('defect/update', { id: edit.id, changes }); toast(`${edit.woId} 불량 조치를 저장했어요`); setEdit(null) }} />
      </main>
    </AppLayout>
  )
}

function ActionModal({ defect, onClose, onSave }) {
  return (
    <Modal open={Boolean(defect)} onClose={onClose} title="원인·조치 입력" description={defect ? `${defect.woId} · ${defect.type} ${defect.qty} EA · ${shortStamp(defect.at)}` : ''} size="sm">
      {defect && <ActionBody key={defect.id} defect={defect} onClose={onClose} onSave={onSave} />}
    </Modal>
  )
}

function ActionBody({ defect, onClose, onSave }) {
  const [f, setF] = useState({ status: defect.status, cause4M: defect.cause4M || '', causeText: defect.causeText || '', action: defect.action || '' })
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  return (
    <div className="action-form">
      <Field label="조치 상태">{() => <Segmented label="조치 상태" options={ACTION_STATUSES} value={f.status} onChange={(v) => set('status', v)} />}</Field>
      <Field label="원인 구분 (4M)">{() => <Segmented label="원인 구분" options={CAUSE_4M} value={f.cause4M} onChange={(v) => set('cause4M', v)} />}</Field>
      <Field label="원인 상세">{(p) => <Textarea {...p} rows={2} value={f.causeText} onChange={(e) => set('causeText', e.target.value)} placeholder="예: 금형 마모" />}</Field>
      <Field label="조치 내용" error={f.status === '완료' && !f.action ? '완료로 바꾸려면 조치 내용을 입력하세요' : undefined}>
        {(p) => <Textarea {...p} rows={2} value={f.action} onChange={(e) => set('action', e.target.value)} placeholder="예: 금형 교체 완료, 초품 검사 합격" />}
      </Field>
      <div className="modal__foot action-form__foot">
        <Button onClick={onClose}>닫기</Button>
        <Button variant="primary" disabled={f.status === '완료' && !f.action} onClick={() => onSave(f)}>저장</Button>
      </div>
    </div>
  )
}
