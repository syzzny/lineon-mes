/**
 * PR-03 작업자 실적 입력 (태블릿) — 현장에서 장갑 낀 손으로도 누르기 쉽게 큰 버튼
 * 양품 등록 · 불량 1개씩 등록 · 실행 취소(5분) · 비가동 신고(EQ-03) · 작업 시작/종료
 * 등록한 실적은 바로 PR-02 실적 승인, DB-01·02 대시보드에 반영됩니다.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import Logo from '../components/layout/Logo'
import DowntimeModal from '../components/DowntimeModal'
import { Avatar, Button, StatusBadge } from '../components/ui'
import { ConfirmModal } from '../components/feedback'
import { useMes } from '../store/MesStore'
import { currentWoOf } from '../utils/mes'
import { useToast } from '../store/ToastContext'
import useNow from '../hooks/useNow'
import { LINES, TODAY, WORKERS, lotOf } from '../data/workOrders'
import { EQUIP_TONE } from '../constants/tones'
import { formatNumber, percent } from '../utils/format'
import { formatDuration, minutesBetween } from '../utils/clock'
import './Tablet.scss'

const UNDO_SEC = 5 * 60 // 실행 취소 가능 시간
const STEPS = [-10, -1, 1, 10]

/** /tablet — 설비 선택 (태블릿 로그인 대신) */
export function TabletPicker() {
  const { equipment } = useMes()
  return (
    <div className="tablet">
      <header className="tablet__bar">
        <Link to="/dashboard"><Logo /></Link>
        <div className="tablet__title"><strong>작업 설비 선택</strong><small>태블릿에서 사용할 설비를 고르세요</small></div>
      </header>
      <main className="tablet__pick">
        {LINES.map((l) => (
          <section key={l}>
            <h2>{l} 라인</h2>
            <div className="tablet__pick-grid">
              {equipment.filter((e) => e.line === l).map((e) => (
                <Link key={e.id} to={`/tablet/${e.id}`} className="pick-card">
                  <strong className="num">{e.id}</strong>
                  <small>{e.name} · {WORKERS[e.id] ?? '담당 없음'}</small>
                  <StatusBadge status={e.status} tone={EQUIP_TONE[e.status]} />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

export default function Tablet() {
  const { equip } = useParams()
  const navigate = useNavigate()
  const { equipById, workOrders, defects, downtime, run } = useMes()
  const toast = useToast()
  const now = useNow(1000)
  const eq = equipById(equip)
  const [qty, setQty] = useState(20)
  const [last, setLast] = useState(null) // { kind, qty, type?, id?, at, left(초) }
  const [modal, setModal] = useState(null) // 'down' | 'end' | 'resume'

  // 실행 취소 남은 시간 (1초마다 줄어듦)
  const counting = Boolean(last?.left)
  useEffect(() => {
    if (!counting) return
    const t = setInterval(() => setLast((l) => (l && l.left > 0 ? { ...l, left: l.left - 1 } : l)), 1000)
    return () => clearInterval(t)
  }, [counting])

  if (!eq) {
    return (
      <div className="tablet tablet--center">
        <p>설비를 찾을 수 없어요.</p>
        <Button variant="primary" onClick={() => navigate('/tablet')}>설비 선택으로</Button>
      </div>
    )
  }

  const worker = WORKERS[eq.id] ?? '작업자'
  const wo = currentWoOf(workOrders, eq.id)
  const next = workOrders.filter((w) => w.equip === eq.id && w.status === '대기').sort((a, b) => a.start.localeCompare(b.start))[0]
  const openDown = downtime.find((d) => d.equip === eq.id && !d.end)
  const types = eq.line === '조립·검사' ? ['용접 불량', '치수 불량', '찍힘·스크래치', '기타'] : ['버(Burr)', '치수 불량', '찍힘·스크래치', '기타']
  const todayDefects = (t) => defects.filter((d) => wo && d.woId === wo.id && d.type === t && d.at.startsWith(TODAY)).reduce((n, d) => n + d.qty, 0)
  const paused = wo?.status === '일시정지'
  const canUndo = last?.left > 0

  const registerGood = () => {
    run('output/add', { woId: wo.id, good: qty })
    setLast({ kind: 'good', qty, at: now.time, left: UNDO_SEC })
    toast(`양품 ${qty}개를 등록했어요`)
  }
  const registerDefect = (type) => {
    const id = `D-${TODAY.slice(5).replace('-', '')}-T${defects.length + 1}`
    run('defect/add', { fromTablet: true, defect: { id, woId: wo.id, lot: lotOf(wo), itemCode: wo.itemCode, itemName: wo.itemName, line: wo.line, equip: wo.equip, type, qty: 1 } })
    setLast({ kind: 'defect', qty: 1, type, id, at: now.time, left: UNDO_SEC })
    toast(`${type} 1개를 등록했어요`)
  }
  const undo = () => {
    if (last.kind === 'good') run('output/add', { woId: wo.id, good: -last.qty, undo: true })
    else run('defect/remove', { id: last.id })
    toast('방금 등록을 취소했어요')
    setLast(null)
  }

  return (
    <div className="tablet">
      <header className="tablet__bar">
        <Link to="/tablet" aria-label="설비 선택으로"><Logo /></Link>
        <div className="tablet__title">
          <strong className="num">{eq.id}</strong>
          <small>{eq.name} · {eq.line} 라인</small>
        </div>
        <span className="tablet__clock num"><Icon name="clock" size={18} /> {now.time}</span>
        <span className="tablet__worker"><Avatar name={worker} size={30} /> {worker}</span>
        <Button className="tablet__logout" onClick={() => navigate('/tablet')}>로그아웃</Button>
      </header>

      {paused && openDown && (
        <div className="tablet__alert" role="alert">
          <Icon name="alert" size={22} />
          <span><strong>비가동 중</strong> · {openDown.reason} · <span className="num">{minutesBetween(openDown.start)}</span>분째 · 작업이 일시정지됐어요</span>
          <Button variant="primary" icon="check" onClick={() => setModal('resume')}>재개</Button>
        </div>
      )}

      {wo ? (
        <main className="tablet__grid">
          <div className="tablet__col">
            <section className="t-card">
              <p className="t-card__eyebrow">현재 작업</p>
              <h1>{wo.itemName} <StatusBadge status={wo.status} /></h1>
              <p className="t-card__meta num">{wo.id} · {wo.itemCode} · {wo.startTime} 시작 · {formatDuration(minutesBetween(`${wo.start} ${wo.startTime}`))} 경과</p>
              <div className="t-stats">
                {[['지시', wo.qty, 'neutral'], ['양품', wo.done - wo.defects, 'success'], ['불량', wo.defects, 'danger'], ['남은 수량', Math.max(0, wo.qty - wo.done), 'brand']].map(([k, v, tone]) => (
                  <div key={k}><span className={`dot dot--${tone}`} /> {k}<strong className="num">{formatNumber(v)}</strong></div>
                ))}
              </div>
              <div className="t-progress" role="progressbar" aria-valuenow={percent(wo.done, wo.qty)} aria-valuemin={0} aria-valuemax={100} aria-label="진행률">
                <span style={{ width: `${Math.min(100, percent(wo.done, wo.qty))}%` }} />
              </div>
            </section>

            <section className="t-card t-input" aria-label="양품 수량 입력">
              <h2>양품 수량 입력</h2>
              <div className="t-stepper">
                {STEPS.slice(0, 2).map((s) => (
                  <button key={s} type="button" disabled={paused} onClick={() => setQty((q) => Math.max(1, q + s))}>{s > 0 ? `+${s}` : `−${-s}`}</button>
                ))}
                <label className="t-stepper__value">
                  <input
                    type="number" inputMode="numeric" min={1} value={qty} disabled={paused}
                    aria-label="등록할 양품 수량"
                    onChange={(e) => setQty(Math.max(1, Math.min(9999, Number(e.target.value) || 1)))}
                  />
                  <small>EA</small>
                </label>
                {STEPS.slice(2).map((s) => (
                  <button key={s} type="button" disabled={paused} onClick={() => setQty((q) => Math.min(9999, q + s))}>+{s}</button>
                ))}
              </div>
              <button type="button" className="t-primary" disabled={paused} onClick={registerGood}>
                <Icon name="check" size={22} strokeWidth={2.4} /> 양품 {formatNumber(qty)}개 등록
              </button>
              {last && (
                <div className="t-last">
                  <span>
                    <small>방금 등록</small>
                    <strong className="num">{last.at} · {last.kind === 'good' ? `양품 +${last.qty} EA` : `불량 +1 (${last.type})`}</strong>
                  </span>
                  {canUndo && (
                    <button type="button" onClick={undo}>
                      <Icon name="undo" size={18} /> 실행 취소 · <span className="num">{Math.floor(last.left / 60)}:{String(last.left % 60).padStart(2, '0')}</span>
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>

          <div className="tablet__col">
            <section className="t-card" aria-label="불량 등록">
              <h2>불량 등록</h2>
              <p className="t-card__hint">유형을 누르면 1개씩 바로 등록돼요</p>
              <div className="t-defects">
                {types.map((t) => (
                  <button key={t} type="button" disabled={paused} onClick={() => registerDefect(t)}>
                    <strong>{t}</strong>
                    <small><span className="dot dot--danger" /> 오늘 <span className="num">{todayDefects(t)}</span></small>
                  </button>
                ))}
              </div>
            </section>

            <section className="t-card t-actions" aria-label="작업 처리">
              <h2>작업 처리</h2>
              <button type="button" className="t-action is-warn" disabled={paused} onClick={() => setModal('down')}>
                <Icon name="alert" size={22} /> 비가동 신고
              </button>
              <button type="button" className="t-action" onClick={() => setModal('end')}>
                <Icon name="stop" size={22} /> 작업 종료
              </button>
              <p className="t-card__hint">작업 종료 시 최종 수량을 한 번 더 확인해요</p>
            </section>
          </div>
        </main>
      ) : (
        <main className="tablet__empty">
          <section className="t-card">
            {next ? (
              <>
                <p className="t-card__eyebrow">다음 작업</p>
                <h1>{next.itemName}</h1>
                <p className="t-card__meta num">{next.id} · 지시 {formatNumber(next.qty)} EA · 납기 {next.due.slice(5).replace('-', '.')}</p>
                <button
                  type="button"
                  className="t-primary"
                  disabled={eq.status === '비가동' || eq.status === '점검'}
                  onClick={() => { run('wo/start', { id: next.id }); toast(`${next.id} 작업을 시작했어요`) }}
                >
                  <Icon name="check" size={22} /> 작업 시작
                </button>
                {(eq.status === '비가동' || eq.status === '점검') && <p className="t-card__hint">설비가 {eq.status} 상태라 시작할 수 없어요</p>}
              </>
            ) : (
              <>
                <Icon name="inbox" size={36} />
                <h1>배정된 작업이 없어요</h1>
                <p className="t-card__meta">라인 반장이 작업을 배정하면 이 화면에 바로 나타나요</p>
              </>
            )}
          </section>
          {eq.status === '비가동' && openDown && (
            <Button variant="primary" icon="check" onClick={() => setModal('resume')}>설비 재개</Button>
          )}
        </main>
      )}

      <DowntimeModal open={modal === 'down'} equip={eq.id} variant="tablet" onClose={() => setModal(null)} onDone={() => setLast(null)} />
      <ConfirmModal
        open={modal === 'end'}
        title="작업을 종료할까요?"
        confirmLabel="작업 종료"
        onConfirm={() => { run('wo/endWork', { id: wo.id }); setModal(null); setLast(null); toast(`${wo.id} 작업을 종료하고 실적 승인을 요청했어요`) }}
        onClose={() => setModal(null)}
      >
        {wo && (
          <>
            <div className="t-confirm">
              <div><span>양품</span><strong className="num">{formatNumber(wo.done - wo.defects)}</strong></div>
              <div><span>불량</span><strong className="num is-danger">{formatNumber(wo.defects)}</strong></div>
              <div><span>지시</span><strong className="num">{formatNumber(wo.qty)}</strong></div>
            </div>
            <p>{wo.done < wo.qty ? `지시수량보다 ${formatNumber(wo.qty - wo.done)} EA 적어요. 그래도 종료하면 반장 승인 후 실적이 확정돼요.` : '반장이 승인하면 실적이 확정돼요.'}</p>
          </>
        )}
      </ConfirmModal>
      <ConfirmModal
        open={modal === 'resume'}
        title="설비를 다시 가동할까요?"
        confirmLabel="재개"
        onConfirm={() => { run('downtime/resume', { equip: eq.id }); setModal(null); toast(`${eq.id} 가동을 재개했어요`) }}
        onClose={() => setModal(null)}
      >
        <p>비가동을 종료하고 일시정지된 작업을 이어서 진행해요.</p>
      </ConfirmModal>
    </div>
  )
}
