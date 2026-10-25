/**
 * PR-02 실적 승인 — 반장이 작업자 실적을 확인하고 승인·반려
 * 불량률이 기준을 넘거나 실행 취소 기록이 있으면 "확인 필요"로 따로 모아 보여줍니다.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import { Tabs, Tag, EmptyState } from '../components/panels'
import { Button, Checkbox, StatusBadge } from '../components/ui'
import { ConfirmModal } from '../components/feedback'
import { Field, Select, Textarea } from '../components/form'
import useSelection from '../hooks/useSelection'
import { useMes } from '../store/MesStore'
import { useToast } from '../store/ToastContext'
import { resultFlags } from '../utils/mes'
import { formatNumber, percent } from '../utils/format'
import { shortStamp } from '../utils/clock'
import { levelOf } from '../config/access'
import './ResultApproval.scss'

const REJECT_REASONS = ['수량 재확인 필요', '불량 유형 확인 필요', '작업지시 잘못 선택', '기타']

export default function ResultApproval() {
  const { results, workOrders, user, permissions, run } = useMes()
  const toast = useToast()
  const canAct = levelOf(permissions, user.role, 'PR-02') === '처리'
  const [tab, setTab] = useState('pending')
  const [activeId, setActiveId] = useState(null)
  const [modal, setModal] = useState(null) // 'approve' | 'reject'
  const [reason, setReason] = useState('')
  const [memo, setMemo] = useState('')
  const sel = useSelection()

  const woOf = (r) => workOrders.find((w) => w.id === r.woId)
  // 실적마다 확인이 필요한 이유(flags)를 계산 — 기준은 utils/mes.js resultFlags
  const rows = results.map((r) => ({ ...r, flags: resultFlags(r, woOf(r)) })).sort((a, b) => a.at.localeCompare(b.at))
  const pending = rows.filter((r) => r.status === '승인 대기')
  const TABS = {
    pending: { label: '승인 대기', list: pending },
    check: { label: '확인 필요', list: pending.filter((r) => r.flags.length) },
    rejected: { label: '반려', list: rows.filter((r) => r.status === '반려').reverse() },
    approved: { label: '승인 완료', list: rows.filter((r) => r.status === '승인').reverse().slice(0, 30) },
  }
  const list = TABS[tab].list
  const active = rows.find((r) => r.id === activeId) ?? list[0]
  const selectable = tab === 'pending' || tab === 'check'
  const selected = list.filter((r) => sel.selected.has(r.id))
  // 일괄 승인할 때 '확인 필요'가 섞여 있으면 한 번 더 확인 모달을 띄움
  const flaggedSel = selected.filter((r) => r.flags.length)

  const approve = (ids) => {
    run('results/approve', { ids })
    toast(`실적 ${ids.length}건을 승인했어요`)
    sel.clear()
    setModal(null)
  }
  const reject = () => {
    run('results/reject', { id: active.id, reason: memo ? `${reason} · ${memo}` : reason })
    toast(`${active.woId} 실적을 반려했어요 · ${active.worker}에게 알림`)
    setModal(null)
  }

  return (
    <AppLayout current="PR-02">
      <main className="page">
        <header className="page-top">
          <div>
            <h1>실적 승인</h1>
            <p>작업자가 입력한 실적을 확인하고 승인하면 생산실적으로 확정돼요</p>
          </div>
        </header>

        {!canAct && (
          <div className="notice"><Icon name="shield" size={16} /> {user.role}은(는) 실적을 조회만 할 수 있어요.</div>
        )}

        <div className="approval">
          <section className="data-card approval__list" aria-label="실적 목록">
            <Tabs
              label="실적 상태"
              value={tab}
              onChange={(k) => { setTab(k); setActiveId(null); sel.clear() }}
              items={Object.entries(TABS).map(([key, t]) => ({ key, label: t.label, count: t.list.length }))}
            />
            {list.length ? (
              <div className="table-scroll">
                <table className="simple-table approval__table">
                  <thead>
                    <tr>
                      {selectable && canAct && (
                        <th className="table__check">
                          <Checkbox
                            checked={selected.length === list.length}
                            indeterminate={selected.length > 0 && selected.length < list.length}
                            onChange={() => sel.setMany(list.map((r) => r.id), selected.length !== list.length)}
                            label="전체 선택"
                          />
                        </th>
                      )}
                      <th>입력</th><th>작업지시 · 품목</th><th>작업자</th><th className="r">양품</th><th className="r">불량</th><th>확인</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.id} className={`is-clickable ${active?.id === r.id ? 'is-on' : ''}`} onClick={() => setActiveId(r.id)}>
                        {selectable && canAct && (
                          <td className="table__check" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={sel.selected.has(r.id)} onChange={() => sel.toggle(r.id)} label={`${r.woId} 선택`} />
                          </td>
                        )}
                        <td className="num">{shortStamp(r.at)}</td>
                        <td>
                          <button type="button" className="approval__wo" onClick={() => setActiveId(r.id)}>
                            <span className="num">{r.woId}</span>
                            <small>{r.itemName} · {r.equip}</small>
                          </button>
                        </td>
                        <td>{r.worker}</td>
                        <td className="r num">{formatNumber(r.good)}</td>
                        <td className="r num">{formatNumber(r.defect)}</td>
                        <td>{r.status !== '승인 대기' ? <StatusBadge status={r.status} /> : r.flags.length ? <Tag tone="warning" icon="alert">확인 필요</Tag> : <Tag tone="success">정상</Tag>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="check" title={tab === 'check' ? '확인이 필요한 실적이 없어요' : '실적이 없어요'} />
            )}
          </section>

          <aside className="card approval__detail" aria-label="실적 상세">
            {active ? <Detail r={active} wo={woOf(active)} canAct={canAct} onApprove={() => setModal('approve-one')} onReject={() => { setReason(''); setMemo(''); setModal('reject') }} /> : <EmptyState title="왼쪽에서 실적을 고르세요" />}
          </aside>
        </div>

        {selected.length > 0 && canAct && (
          <div className="bulk-bar" role="region" aria-label="선택 실적 일괄 처리">
            <span className="bulk-bar__count"><span className="num">{selected.length}</span>건 선택됨</span>
            <span className="bulk-bar__sep" />
            <button type="button" onClick={() => (flaggedSel.length ? setModal('approve') : approve(selected.map((r) => r.id)))}>
              <Icon name="check" size={16} /> 일괄 승인
            </button>
            <span className="bulk-bar__sep" />
            <button type="button" aria-label="선택 해제" onClick={sel.clear}><Icon name="x" size={16} /></button>
          </div>
        )}

        <ConfirmModal
          open={modal === 'approve'}
          title={`확인 필요 ${flaggedSel.length}건이 포함돼 있어요`}
          confirmLabel={`${selected.length}건 모두 승인`}
          onConfirm={() => approve(selected.map((r) => r.id))}
          onClose={() => setModal(null)}
        >
          <ul className="approval__flags">
            {flaggedSel.map((r) => <li key={r.id}><span className="num">{r.woId}</span> · {r.flags.join(', ')}</li>)}
          </ul>
          <p>확인 없이 승인하면 이 수량 그대로 실적이 확정돼요.</p>
        </ConfirmModal>
        <ConfirmModal
          open={modal === 'approve-one'}
          title={`${active?.woId} 실적을 승인할까요?`}
          confirmLabel="승인"
          onConfirm={() => approve([active.id])}
          onClose={() => setModal(null)}
        >
          <p>양품 <strong className="num">{formatNumber(active?.good ?? 0)}</strong> · 불량 <strong className="num">{formatNumber(active?.defect ?? 0)}</strong> EA로 확정돼요.</p>
        </ConfirmModal>
        <ConfirmModal
          open={modal === 'reject'}
          danger
          title="실적을 반려할까요?"
          confirmLabel="반려"
          confirmDisabled={!reason}
          onConfirm={reject}
          onClose={() => setModal(null)}
        >
          <p>반려하면 {active?.worker}에게 알림이 가고, 작업자가 수량을 고쳐 다시 올려요.</p>
          <Field label="반려 사유" required>
            {(p) => <Select {...p} options={REJECT_REASONS} placeholder="사유 선택" value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <Field label="작업자에게 남길 말">
            {(p) => <Textarea {...p} rows={2} placeholder="예: 14시 이후 양품 수량을 다시 세어 주세요" value={memo} onChange={(e) => setMemo(e.target.value)} />}
          </Field>
        </ConfirmModal>
      </main>
    </AppLayout>
  )
}

/** 오른쪽 상세 — 수치, 확인 필요 이유, 태블릿 입력 기록, 승인·반려 */
function Detail({ r, wo, canAct, onApprove, onReject }) {
  const total = r.good + r.defect
  return (
    <div className="r-detail">
      <header>
        <div>
          <Link to={`/work-orders/${r.woId}`} className="cell-link num">{r.woId}</Link>
          <h2>{r.itemName}</h2>
          <p className="num">{r.line} · {r.equip} · {r.worker} · {shortStamp(r.at)} 입력</p>
        </div>
        <StatusBadge status={r.status} />
      </header>

      <div className="r-detail__nums">
        <div><span>양품</span><strong className="num">{formatNumber(r.good)}</strong></div>
        <div><span>불량</span><strong className="num is-danger">{formatNumber(r.defect)}</strong></div>
        <div><span>불량률</span><strong className="num">{total ? ((r.defect / total) * 100).toFixed(1) : '0.0'}%</strong></div>
      </div>

      {r.flags.length > 0 && r.status === '승인 대기' && (
        <div className="r-detail__flags">
          <strong><Icon name="alert" size={16} /> 확인이 필요해요</strong>
          <ul>{r.flags.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
      {r.status === '반려' && <div className="r-detail__flags"><strong>반려 사유</strong><p>{r.rejectReason}</p></div>}

      {wo && (
        <dl className="r-detail__wo">
          <div><dt>작업지시 진행</dt><dd className="num">{formatNumber(wo.done)} / {formatNumber(wo.qty)} EA ({percent(wo.done, wo.qty)}%)</dd></div>
          <div><dt>작업지시 상태</dt><dd><StatusBadge status={wo.status} /></dd></div>
          {r.approvedBy && <div><dt>처리</dt><dd className="num">{r.approvedBy} · {shortStamp(r.approvedAt)}</dd></div>}
        </dl>
      )}

      <h3>입력 기록</h3>
      {r.log.length ? (
        <ol className="r-detail__log">
          {r.log.map((l, i) => <li key={i} className="num">{l.slice(5).replace('-', '.')}</li>)}
        </ol>
      ) : (
        <p className="muted">태블릿 입력 기록이 없는 실적이에요 (작업 종료 시 일괄 입력)</p>
      )}

      {canAct && r.status === '승인 대기' && (
        <div className="r-detail__actions">
          <Button variant="danger" onClick={onReject}>반려</Button>
          <Button variant="primary" icon="check" onClick={onApprove}>승인</Button>
        </div>
      )}
    </div>
  )
}
