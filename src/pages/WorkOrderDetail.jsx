import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import { Avatar, Button, Count, StatusBadge } from '../components/ui'
import { ConfirmModal } from '../components/feedback'
import { Field, Select } from '../components/form'
import { useMes, useWorkOrders } from '../store/MesStore'
import { useToast } from '../store/ToastContext'
import { TODAY, lotOf } from '../data/workOrders'
import {
  CAN_CANCEL, CAN_EDIT, CAN_FINISH_EARLY, CANCEL_REASONS, DISABLED_REASON, FINISH_REASONS, LEAD_TONE,
} from '../constants/workOrder'
import { dayDiff, formatNumber, formatShortDate, percent } from '../utils/format'
import ComingSoon from './ComingSoon'
import './WorkOrderDetail.scss'

const TABS = ['기본정보', '실적', '불량', '첨부']

/** 버튼이 비활성일 때 이유를 툴팁으로 보여줌 (숨기지 않고 비활성화하는 규칙) */
function ActionButton({ disabledReason, ...props }) {
  if (!disabledReason) return <Button {...props} />
  return (
    <span className="tip" tabIndex={0} aria-describedby={`tip-${props.children}`}>
      <Button {...props} disabled />
      <span className="tip__bubble" role="tooltip" id={`tip-${props.children}`}>{disabledReason}</span>
    </span>
  )
}

function Summary({ wo }) {
  const diff = dayDiff(wo.due, TODAY)
  const closed = wo.status === '완료' || wo.status === '취소'
  const dueTag = closed ? null : diff < 0 ? ['late', `지연 ${-diff}일`] : diff <= 2 ? ['soon', diff === 0 ? '오늘 마감' : `D-${diff} · 여유 적음`] : ['ok', `D-${diff}`]
  const p = percent(wo.done, wo.qty)
  return (
    <section className="data-card summary" aria-label="핵심 수치">
      <div><span>지시수량</span><strong className="num">{formatNumber(wo.qty)}<small>EA</small></strong><em>단위 EA</em></div>
      <div><span>생산수량</span><strong className="num">{formatNumber(wo.done)}<small>EA</small></strong><em>양품 {formatNumber(wo.done - wo.defects)}</em></div>
      <div><span>불량</span><strong className="num is-danger">{formatNumber(wo.defects)}<small>EA</small></strong><em>불량률 {wo.done ? ((wo.defects / wo.done) * 100).toFixed(1) : '0.0'}%</em></div>
      <div>
        <span>진행률</span><strong className="num">{p}<small>%</small></strong>
        <div className="summary__bar"><span className={p === 100 ? 'is-done' : ''} style={{ width: `${p}%` }} /></div>
      </div>
      <div>
        <span>납기</span><strong className="num">{formatShortDate(wo.due).split(' ')[0]}<small>{formatShortDate(wo.due).split(' ')[1]}</small></strong>
        {dueTag ? <em className={`summary__due is-${dueTag[0]}`}>{dueTag[1]}</em> : <em>{wo.status}</em>}
      </div>
    </section>
  )
}

function Row({ label, children }) {
  return <div className="info__row"><dt>{label}</dt><dd>{children}</dd></div>
}

function InfoTab({ wo }) {
  return (
    <div className="info">
      <h3>품목 · 공정</h3>
      <dl className="info__grid">
        <Row label="품목">{wo.itemName}</Row>
        <Row label="품목코드"><span className="num">{wo.itemCode}</span></Row>
        <Row label="공정">
          <span className="route">
            {wo.route.map((r, i) => (
              <span key={r} className="route__step">{i > 0 && <Icon name="chevR" size={12} />}<span>{r}</span></span>
            ))}
          </span>
        </Row>
        <Row label="생산계획">{wo.plan}</Row>
        {wo.status !== '대기' && wo.status !== '취소' && <Row label="LOT"><Link to={`/lots/${lotOf(wo)}`} className="cell-link num">{lotOf(wo)}</Link></Row>}
      </dl>
      <h3>배정</h3>
      <dl className="info__grid">
        <Row label="라인 · 설비">{wo.line} · {wo.equip ? <Link to={`/equipment/${wo.equip}`} className="cell-link num">{wo.equip}</Link> : <Link to={`/assignments?ids=${wo.id}&line=${wo.line}`} className="cell-link">미배정 · 배정하기</Link>}</Row>
        <Row label="담당 반장"><span className="info__person"><Avatar name={wo.lead} tone={LEAD_TONE[wo.lead]} />{wo.lead}</span></Row>
        <Row label="작업 시작"><span className="num">{wo.start.replaceAll('-', '.')} {wo.startTime}</span></Row>
        <Row label="우선순위">{wo.priority}</Row>
      </dl>
      <h3>기타</h3>
      <dl className="info__grid info__grid--one">
        <Row label="비고">{wo.memo || <span className="muted">없음</span>}</Row>
      </dl>
    </div>
  )
}

function EmptyTab({ label }) {
  return <div className="tab-empty"><Icon name="inbox" size={28} /><p>등록된 {label}이 없어요</p></div>
}

function ResultTab({ results }) {
  if (!results.length) return <EmptyTab label="실적" />
  return (
    <table className="mini-table">
      <thead><tr><th>입력 시각</th><th>작업자</th><th className="r">양품</th><th className="r">불량</th><th>승인</th></tr></thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.id}>
            <td className="num">{r.at.slice(5).replace('-', '.')}</td>
            <td>{r.worker}</td>
            <td className="r num">{formatNumber(r.good)}</td>
            <td className="r num">{formatNumber(r.defect)}</td>
            <td><StatusBadge status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DefectTab({ defects, wo }) {
  return (
    <>
      {defects.length ? (
        <table className="mini-table">
          <thead><tr><th>발생</th><th>유형</th><th className="r">수량</th><th>원인</th><th>조치</th></tr></thead>
          <tbody>
            {defects.map((d) => (
              <tr key={d.id}>
                <td className="num">{d.at.slice(5).replace('-', '.')}</td>
                <td>{d.type}</td>
                <td className="r num">{d.qty}</td>
                <td>{d.cause4M || '—'}{d.causeText ? ` · ${d.causeText}` : ''}</td>
                <td><StatusBadge status={d.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyTab label="불량" />
      )}
      <p className="tab-links">
        <Link to={`/defects/new?wo=${wo.id}`}>불량 등록</Link>
        <Link to={`/lots/${lotOf(wo)}`}>LOT {lotOf(wo)} 추적</Link>
      </p>
    </>
  )
}

function History({ events }) {
  return (
    <section className="data-card history" aria-label="진행 이력">
      <header><h2>진행 이력</h2><span className="num">{events.length}건</span></header>
      <ol className="timeline">
        {events.map((e, i) => (
          <li key={i} className={i === 0 ? 'is-latest' : ''}>
            <span className="timeline__dot" aria-hidden="true" />
            <div>
              <p className="timeline__title">{e.type} <StatusBadge status={e.status} /></p>
              <p className="timeline__meta num">{e.at.slice(5).replace('-', '.')} · {e.by}</p>
              {e.note && <p className="timeline__note">{e.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function WorkOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { getById, cancel, finishEarly } = useWorkOrders()
  const { results: allResults, defects: allDefects } = useMes()
  const wo = getById(id)
  const [tab, setTab] = useState('기본정보')
  const [modal, setModal] = useState(null) // 'cancel' | 'finish'
  const [reason, setReason] = useState('')

  if (!wo) return <ComingSoon />

  const closed = wo.status === '완료' || wo.status === '취소'
  const open = (m) => { setReason(''); setModal(m) }
  const confirm = () => {
    if (modal === 'cancel') { cancel([wo.id], reason); toast(`${wo.id} 작업지시를 취소했어요`) }
    if (modal === 'finish') { finishEarly(wo.id, reason); toast(`${wo.id} 작업지시를 ${formatNumber(wo.done)} EA로 조기 종료했어요`) }
    setModal(null)
  }

  const results = allResults.filter((r) => r.woId === wo.id)
  const defects = allDefects.filter((d) => d.woId === wo.id)
  const counts = { 실적: results.length, 불량: defects.length, 첨부: 0 }

  return (
    <AppLayout current="PP-03" crumbs={[{ label: wo.id }]}>
      <main className="page detail">
        <Link to="/work-orders" className="back"><Icon name="chevL" size={16} /> 작업지시 목록</Link>

        <header className="detail__head">
          <div>
            <h1><span className="num">{wo.id}</span> <StatusBadge status={wo.status} /></h1>
            <p>{wo.itemName} <span className="num">{wo.itemCode}</span> · {wo.line} 라인 <span className="num">{wo.equip || '미배정'}</span></p>
          </div>
          <div className="detail__actions">
            <ActionButton icon="edit" onClick={() => navigate(`/work-orders/${wo.id}/edit`)} disabledReason={CAN_EDIT(wo) ? null : DISABLED_REASON.edit}>수정</ActionButton>
            <ActionButton icon="stop" onClick={() => open('finish')} disabledReason={CAN_FINISH_EARLY(wo) ? null : DISABLED_REASON.finish}>조기 종료</ActionButton>
            <ActionButton variant="danger" icon="ban" onClick={() => open('cancel')} disabledReason={CAN_CANCEL(wo) ? null : closed ? DISABLED_REASON.cancelClosed : DISABLED_REASON.cancel}>취소</ActionButton>
          </div>
        </header>

        <Summary wo={wo} />

        <div className="detail__cols">
          <section className="data-card detail__tabs">
            <div className="views" role="tablist" aria-label="상세 정보">
              {TABS.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className={`views__tab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
                  {t} {counts[t] != null && <Count>{counts[t]}</Count>}
                </button>
              ))}
            </div>
            <div className="detail__panel" role="tabpanel">
              {tab === '기본정보' && <InfoTab wo={wo} />}
              {tab === '실적' && <ResultTab results={results} />}
              {tab === '불량' && <DefectTab defects={defects} wo={wo} />}
              {tab === '첨부' && <EmptyTab label="첨부 파일" />}
            </div>
          </section>
          <History events={wo.history} />
        </div>

        <ConfirmModal
          open={modal === 'cancel'}
          danger
          title={`${wo.id} 작업지시를 취소할까요?`}
          confirmLabel="취소하기"
          confirmDisabled={!reason}
          onConfirm={confirm}
          onClose={() => setModal(null)}
        >
          <p>취소한 작업지시는 되돌릴 수 없고, 목록의 "취소" 상태 필터에서 볼 수 있어요.</p>
          <Field label="취소 사유" required>
            {(p) => <Select {...p} options={CANCEL_REASONS} placeholder="사유를 선택하세요" value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        </ConfirmModal>

        <ConfirmModal
          open={modal === 'finish'}
          title="조기 종료할까요?"
          confirmLabel={`${formatNumber(wo.done)} EA로 종료`}
          confirmDisabled={!reason}
          onConfirm={confirm}
          onClose={() => setModal(null)}
        >
          <p>지금까지 만든 <strong className="num">{formatNumber(wo.done)} EA</strong>를 실적으로 확정하고 작업을 완료 처리해요. 남은 {formatNumber(wo.qty - wo.done)} EA는 필요하면 새 작업지시로 발행하세요.</p>
          <Field label="종료 사유" required>
            {(p) => <Select {...p} options={FINISH_REASONS} placeholder="사유를 선택하세요" value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        </ConfirmModal>
      </main>
    </AppLayout>
  )
}
