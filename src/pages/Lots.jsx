/**
 * QC-03 LOT 추적 — LOT 번호로 원자재 → 공정 → 제품 → 출하까지 앞뒤로 추적
 * 같은 원자재 LOT을 쓴 다른 제품 LOT을 함께 보여줘서, 문제가 생기면 영향 범위를 바로 파악
 */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import { Card, Tabs, Tag, EmptyState } from '../components/panels'
import { Button, StatusBadge } from '../components/ui'
import { ConfirmModal } from '../components/feedback'
import { Field, Textarea } from '../components/form'
import { ListFooter } from '../components/list/ListParts'
import { useMes } from '../store/MesStore'
import { useToast } from '../store/ToastContext'
import { TODAY, WORKERS, lotOf } from '../data/workOrders'
import { MATERIAL_INFO, materialLotOf } from '../data/mes'
import { formatNumber } from '../utils/format'
import { shortStamp } from '../utils/clock'
import { levelOf } from '../config/access'
import './Lots.scss'

/** 작업지시 → LOT 행 */
function useLots() {
  const { workOrders, defects, lotHolds } = useMes()
  return workOrders
    .filter((w) => w.status !== '대기' && w.status !== '취소')
    .map((w) => {
      const lot = lotOf(w)
      const hold = lotHolds[lot]
      const ship = hold?.hold ? '출하 보류' : w.status === '완료' ? (w.due < TODAY ? '출하완료' : '출하 가능') : '생산 중'
      return { lot, wo: w, material: materialLotOf(w), ship, hold, defectQty: defects.filter((d) => d.woId === w.id).reduce((n, d) => n + d.qty, 0) }
    })
    .sort((a, b) => b.lot.localeCompare(a.lot))
}

const SHIP_TONE = { '출하 보류': 'danger', '출하 가능': 'success', 출하완료: 'neutral', '생산 중': 'brand' }

export default function Lots() {
  const { lot } = useParams()
  return lot ? <LotDetail key={lot} lotNo={lot} /> : <LotSearch />
}

function LotSearch() {
  const navigate = useNavigate()
  const lots = useLots()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const query = q.trim().toLowerCase()
  const TABS = {
    all: { label: '전체', test: () => true },
    hold: { label: '출하 보류', test: (l) => l.ship === '출하 보류' },
    defect: { label: '불량 있음', test: (l) => l.defectQty > 0 },
    running: { label: '생산 중', test: (l) => l.ship === '생산 중' },
  }
  const matched = lots.filter((l) => !query || [l.lot, l.wo.id, l.wo.itemName, l.wo.itemCode, l.material].some((s) => s.toLowerCase().includes(query)))
  const list = matched.filter(TABS[tab].test)
  const pageCount = Math.max(1, Math.ceil(list.length / 15))
  const cur = Math.min(page, pageCount)
  const rows = list.slice((cur - 1) * 15, cur * 15)

  const go = () => {
    const exact = lots.find((l) => l.lot.toLowerCase() === query || l.wo.id.toLowerCase() === query)
    if (exact) navigate(`/lots/${exact.lot}`)
  }

  return (
    <AppLayout current="QC-03">
      <main className="page">
        <header className="page-top">
          <div>
            <h1>LOT 추적</h1>
            <p>제품 LOT·작업지시·원자재 LOT 번호로 찾으면 생산 이력과 출하까지 한 번에 볼 수 있어요</p>
          </div>
        </header>

        <section className="card lot-search">
          <label className="lot-search__box">
            <Icon name="search" size={20} />
            <input
              type="search"
              autoFocus
              placeholder="예: L2610-22-142, WO-2610-0142, M2610-15-004-BR"
              aria-label="LOT 번호, 작업지시번호 또는 원자재 LOT 검색"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              onKeyDown={(e) => e.key === 'Enter' && go()}
            />
            <Button variant="primary" onClick={go} disabled={!query}>추적</Button>
          </label>
          <p className="lot-search__hint">최근 조회: {['L2610-22-142', 'L2610-22-143', 'L2610-20-136'].map((l) => <Link key={l} to={`/lots/${l}`} className="num">{l}</Link>)}</p>
        </section>

        <section className="data-card" aria-label="LOT 목록">
          <Tabs label="LOT 상태" value={tab} onChange={(k) => { setTab(k); setPage(1) }} items={Object.entries(TABS).map(([key, t]) => ({ key, label: t.label, count: matched.filter(t.test).length }))} />
          <div className="table-scroll">
            <table className="simple-table">
              <thead><tr><th>제품 LOT</th><th>작업지시</th><th>품목</th><th>원자재 LOT</th><th className="r">생산</th><th className="r">불량</th><th>생산일</th><th>출하 상태</th></tr></thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.lot} className="is-clickable" onClick={() => navigate(`/lots/${l.lot}`)}>
                    <td><Link to={`/lots/${l.lot}`} className="cell-link num" onClick={(e) => e.stopPropagation()}>{l.lot}</Link></td>
                    <td className="num">{l.wo.id}</td>
                    <td>{l.wo.itemName}</td>
                    <td className="num muted">{l.material}</td>
                    <td className="r num">{formatNumber(l.wo.done)}</td>
                    <td className={`r num ${l.defectQty ? 'is-danger' : ''}`}>{formatNumber(l.defectQty)}</td>
                    <td className="num">{l.wo.start.slice(5).replace('-', '.')}</td>
                    <td><StatusBadge status={l.ship} tone={SHIP_TONE[l.ship]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <EmptyState title="찾는 LOT이 없어요" >번호를 다시 확인해 주세요</EmptyState>}
          </div>
          <ListFooter pagination={{ page: cur, pageCount, from: list.length ? (cur - 1) * 15 + 1 : 0, to: (cur - 1) * 15 + rows.length, total: list.length }} pageSize={15} pageSizes={[15]} onPageSize={() => {}} onPage={setPage} />
        </section>
      </main>
    </AppLayout>
  )
}

function LotDetail({ lotNo }) {
  const toast = useToast()
  const { defects, results, user, permissions, run } = useMes()
  const lots = useLots()
  const l = lots.find((x) => x.lot === lotNo)
  const [modal, setModal] = useState(false)
  const [reason, setReason] = useState('')
  const canAct = levelOf(permissions, user.role, 'QC-03') === '처리'

  if (!l) {
    return (
      <AppLayout current="QC-03" crumbs={[{ label: lotNo }]}>
        <main className="page"><Card><EmptyState title={`${lotNo} LOT을 찾을 수 없어요`}><Link to="/lots" className="cell-link">LOT 검색으로</Link></EmptyState></Card></main>
      </AppLayout>
    )
  }

  const { wo } = l
  const mat = MATERIAL_INFO[wo.itemCode.slice(0, 2)]
  // 같은 원자재 LOT을 쓴 다른 제품 LOT = 문제 발생 시 함께 확인할 영향 범위
  const siblings = lots.filter((x) => x.material === l.material && x.lot !== l.lot)
  const lotDefects = defects.filter((d) => d.woId === wo.id)
  const lotResults = results.filter((r) => r.woId === wo.id)
  const held = l.ship === '출하 보류'
  // 품목의 표준 공정 순서대로 공정 단계를 만듦 (마지막 단계만 진행 상태를 따라감)
  const steps = wo.route.map((r, i) => {
    const last = i === wo.route.length - 1
    const doneStep = wo.status === '완료' || !last
    return {
      name: r,
      equip: i === 0 || r.includes(wo.line === '가공' ? 'CNC' : '프레스') ? wo.equip : r === '검사·포장' ? 'IN-01' : r === '용접' ? 'WD-02' : '—',
      worker: i === 0 ? WORKERS[wo.equip] ?? '작업자' : r === '검사·포장' ? '최유나' : '문지아',
      state: doneStep ? '완료' : wo.status === '일시정지' ? '일시정지' : '진행',
    }
  })

  const toggleHold = () => {
    run('lot/hold', { lot: l.lot, hold: !held, reason })
    toast(held ? `${l.lot} 출하 보류를 해제했어요` : `${l.lot}을(를) 출하 보류했어요`)
    setModal(false)
  }

  return (
    <AppLayout current="QC-03" crumbs={[{ label: l.lot }]}>
      <main className="page">
        <Link to="/lots" className="back"><Icon name="chevL" size={16} /> LOT 검색</Link>
        <header className="page-top">
          <div>
            <h1 className="lot-title"><span className="num">{l.lot}</span> <StatusBadge status={l.ship} tone={SHIP_TONE[l.ship]} /></h1>
            <p>{wo.itemName} <span className="num">{wo.itemCode}</span> · <Link to={`/work-orders/${wo.id}`} className="cell-link num">{wo.id}</Link> · {wo.line} 라인</p>
          </div>
          <div className="page-top__right">
            <Button icon="down" onClick={() => toast(`${l.lot} 추적 보고서를 내보냈어요`)}>추적 보고서</Button>
            {canAct && (held ? (
              <Button variant="primary" icon="check" onClick={() => { setReason(''); setModal(true) }}>보류 해제</Button>
            ) : (
              <Button variant="danger" icon="ban" onClick={() => { setReason(''); setModal(true) }} disabled={l.ship === '출하완료'}>출하 보류</Button>
            ))}
          </div>
        </header>

        {held && (
          <div className="lot-hold" role="alert">
            <Icon name="alert" size={18} />
            <span><strong>출하 보류 중</strong> · {l.hold.reason} · {l.hold.by} {shortStamp(l.hold.at)}</span>
          </div>
        )}

        {/* 추적 흐름: 원자재 → 공정 → 제품 → 출하 */}
        <Card title="추적 흐름" desc="원자재부터 출하까지 · 단계를 누르면 관련 화면으로 이동">
          <ol className="trace">
            <li className="trace__node">
              <span className="trace__kind">원자재 LOT</span>
              <strong className="num">{l.material}</strong>
              <small>{mat.name}</small>
              <small>{mat.vendor} · 입고 {l.material.includes('15-004') ? '10.15' : l.material.includes('08-011') ? '10.08' : '10.01'}</small>
            </li>
            {steps.map((s) => (
              <li key={s.name} className="trace__node">
                <span className="trace__kind">공정</span>
                <strong>{s.name}</strong>
                <small className="num">{s.equip !== '—' ? <Link to={`/equipment/${s.equip}`}>{s.equip}</Link> : '—'} · {s.worker}</small>
                <StatusBadge status={s.state} />
              </li>
            ))}
            <li className="trace__node is-product">
              <span className="trace__kind">제품 LOT</span>
              <strong className="num">{l.lot}</strong>
              <small className="num">생산 {formatNumber(wo.done)} · 불량 {formatNumber(l.defectQty)} EA</small>
              <small className="num">{wo.start.slice(5).replace('-', '.')} 생산</small>
            </li>
            <li className={`trace__node ${held ? 'is-hold' : ''}`}>
              <span className="trace__kind">출하</span>
              <strong>{l.ship}</strong>
              <small>{l.ship === '출하완료' ? `${wo.due.slice(5).replace('-', '.')} 현대모비스(가상) 납품` : l.ship === '출하 가능' ? '출하 대기' : held ? '품질 확인 후 출하' : '생산 완료 후 출하'}</small>
            </li>
          </ol>
        </Card>

        <div className="lot-grid">
          <Card title="같은 원자재 LOT을 쓴 제품" desc={`${l.material} · 문제 발생 시 함께 확인할 범위`} action={<Tag tone={siblings.length ? 'warning' : 'neutral'}>{siblings.length}개 LOT</Tag>}>
            <ul className="card__body sib-list">
              {siblings.slice(0, 8).map((s) => (
                <li key={s.lot}>
                  <Link to={`/lots/${s.lot}`} className="cell-link num">{s.lot}</Link>
                  <span>{s.wo.itemName}</span>
                  <StatusBadge status={s.ship} tone={SHIP_TONE[s.ship]} />
                </li>
              ))}
              {siblings.length > 8 && <li className="muted">외 {siblings.length - 8}개</li>}
              {siblings.length === 0 && <li className="muted">같은 원자재를 쓴 다른 LOT이 없어요</li>}
            </ul>
          </Card>

          <Card title="불량 기록" action={<Link to={`/defects/new?wo=${wo.id}`} className="card__link">불량 등록</Link>}>
            <ul className="card__body sib-list">
              {lotDefects.slice(0, 8).map((d) => (
                <li key={d.id}>
                  <span className="num muted">{shortStamp(d.at)}</span>
                  <span>{d.type} · <strong className="num">{d.qty}</strong> EA</span>
                  <StatusBadge status={d.status} />
                </li>
              ))}
              {lotDefects.length === 0 && <li className="muted">불량 기록이 없어요</li>}
            </ul>
          </Card>

          <Card title="생산실적">
            <ul className="card__body sib-list">
              {lotResults.map((r) => (
                <li key={r.id}>
                  <span className="num muted">{shortStamp(r.at)}</span>
                  <span className="num">양품 {formatNumber(r.good)} · 불량 {r.defect}</span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
              {lotResults.length === 0 && <li className="muted">승인된 실적이 없어요</li>}
            </ul>
          </Card>
        </div>

        <ConfirmModal
          open={modal}
          danger={!held}
          title={held ? `${l.lot} 출하 보류를 해제할까요?` : `${l.lot}을(를) 출하 보류할까요?`}
          confirmLabel={held ? '보류 해제' : '출하 보류'}
          confirmDisabled={!reason.trim()}
          onConfirm={toggleHold}
          onClose={() => setModal(false)}
        >
          <p>{held ? '해제하면 이 LOT을 다시 출하할 수 있어요.' : '보류하면 품질 확인이 끝날 때까지 이 LOT을 출하할 수 없어요.'}</p>
          <Field label={held ? '해제 사유' : '보류 사유'} required>
            {(p) => <Textarea {...p} rows={2} placeholder={held ? '예: 전수 검사 결과 이상 없음' : '예: 치수 불량 조사'} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        </ConfirmModal>
      </main>
    </AppLayout>
  )
}
