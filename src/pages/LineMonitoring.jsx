/** DB-02 라인 모니터링 — 라인 반장이 설비 상태를 보고 바로 조치 (재개·사유 수정·작업 배정) */
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import Icon from '../components/Icon'
import DowntimeModal from '../components/DowntimeModal'
import { Card, CardLink, Dot, LiveBadge, Meter, Tag } from '../components/panels'
import { EQUIP_TONE } from '../constants/tones'
import { Avatar, Button, StatusBadge } from '../components/ui'
import { ConfirmModal } from '../components/feedback'
import { useMes } from '../store/MesStore'
import { countByStatus, currentWoOf, downtimeMinutes, lineProgress } from '../utils/mes'
import { useToast } from '../store/ToastContext'
import useNow from '../hooks/useNow'
import { LEADS, LINES, TODAY, WORKERS } from '../data/workOrders'
import { formatNumber, percent } from '../utils/format'
import { formatDuration, minutesBetween } from '../utils/clock'
import { levelOf } from '../config/access'
import './LineMonitoring.scss'

export default function LineMonitoring() {
  const [params, setParams] = useSearchParams()
  const { user, permissions, equipment, workOrders, downtime, extraOutput, run } = useMes()
  // 라인은 주소(?line=)로 관리 → 대시보드 등에서 특정 라인으로 바로 들어올 수 있음
  const line = LINES.includes(params.get('line')) ? params.get('line') : user.line && user.line !== '전체' ? user.line : '가공'
  const now = useNow()
  const toast = useToast()
  // 재개·사유 수정·배정은 설비관리 '처리' 권한이 있는 역할만 (라인 반장, 현장 작업자, 시스템 관리자)
  const canAct = levelOf(permissions, user.role, 'EQ-01') === '처리'
  const [modal, setModal] = useState(null) // { type: 'edit' | 'report' | 'resume', equip, downtime? }

  const eqs = equipment.filter((e) => e.line === line)
  const st = countByStatus(eqs)
  const prog = lineProgress(line, extraOutput)
  const todayDown = downtime.filter((d) => d.start.startsWith(TODAY) && !d.planned && eqs.some((e) => e.id === d.equip))
  const downMin = todayDown.reduce((n, d) => n + downtimeMinutes(d), 0)

  // 알람·이벤트 로그 (비가동 시작·복구, 점검, 경고) — 비가동 이력 데이터에서 만들어 시간 역순 정렬
  const events = [
    ...todayDown.flatMap((d) => [
      { at: d.start, tone: 'danger', tag: '비가동', equip: d.equip, text: `비가동 등록 · ${d.reason} · ${d.by}` },
      ...(d.end ? [{ at: d.end, tone: 'success', tag: '복구', equip: d.equip, text: `가동 재개 · ${formatDuration(downtimeMinutes(d))} 비가동` }] : []),
    ]),
    ...downtime.filter((d) => d.planned && d.start.startsWith(TODAY) && eqs.some((e) => e.id === d.equip)).map((d) => ({ at: d.start, tone: 'brand', tag: '점검', equip: d.equip, text: `${d.reason} 시작 · ${d.by}` })),
    ...(line === '가공' ? [{ at: `${TODAY} 14:21`, tone: 'warning', tag: '경고', equip: 'CNC-03', text: '사이클 타임이 기준보다 18% 길어졌어요 (6:00 → 7:05)' }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at))

  const resume = (equip) => {
    run('downtime/resume', { equip })
    toast(`${equip} 가동을 재개했어요`)
    setModal(null)
  }

  return (
    <AppLayout current="DB-02">
      <main className="page lm">
        <header className="page-top">
          <div>
            <h1>{line} 라인 모니터링</h1>
            <p>주간 근무 08:00 – 17:00 · 설비 {eqs.length}대 · 담당 반장 {LEADS[line]}</p>
          </div>
          <div className="page-top__right">
            <div className="seg" role="group" aria-label="라인 선택">
              {LINES.map((l) => (
                <button key={l} type="button" aria-pressed={l === line} onClick={() => setParams({ line: l })}>{l}</button>
              ))}
            </div>
            <LiveBadge>실시간 <span className="num">{now.time}</span></LiveBadge>
          </div>
        </header>

        <section className="card lm-strip" aria-label="라인 요약">
          {[['가동', 'success'], ['비가동', 'danger'], ['대기', 'neutral'], ['점검', 'brand']].map(([s, tone]) => (
            <div key={s}>
              <Dot tone={tone}>{s}</Dot>
              <strong className={`num ${s === '비가동' && st[s] ? 'is-danger' : ''}`}>{st[s]}<small>대</small></strong>
            </div>
          ))}
          <div>
            <span>라인 달성률</span>
            <strong className="num">{prog.pct}<small>%</small></strong>
          </div>
          <div>
            <span>오늘 비가동 누적</span>
            <strong className="num">{downMin}<small>분</small></strong>
          </div>
        </section>

        <div className="tiles">
          {eqs.map((eq) => (
            <EquipTile
              key={eq.id}
              eq={eq}
              wo={currentWoOf(workOrders, eq.id)}
              next={workOrders.find((w) => w.equip === eq.id && w.status === '대기')}
              openDown={downtime.find((d) => d.equip === eq.id && !d.end)}
              canAct={canAct}
              onEdit={(d) => setModal({ type: 'edit', equip: eq.id, downtime: d })}
              onResume={() => setModal({ type: 'resume', equip: eq.id })}
            />
          ))}
        </div>

        <Card title="알람 · 이벤트" action={<CardLink to="/downtime">비가동 이력</CardLink>}>
          <ul className="card__body alarm-log">
            {events.map((e, i) => (
              <li key={i}>
                <span className="num muted">{e.at.slice(11)}</span>
                <Tag tone={e.tone}>{e.tag}</Tag>
                <Link to={`/equipment/${e.equip}`} className="num alarm-log__eq">{e.equip}</Link>
                <span>{e.text}</span>
              </li>
            ))}
            {events.length === 0 && <li className="muted">오늘 발생한 알람이 없어요</li>}
          </ul>
        </Card>

        <DowntimeModal open={modal?.type === 'edit'} equip={modal?.equip} edit={modal?.downtime} onClose={() => setModal(null)} />
        <ConfirmModal
          open={modal?.type === 'resume'}
          title={`${modal?.equip} 가동을 재개할까요?`}
          confirmLabel="재개"
          onConfirm={() => resume(modal.equip)}
          onClose={() => setModal(null)}
        >
          <p>비가동을 종료하고, 일시정지된 작업지시가 있으면 다시 진행 상태로 바꿔요. 비가동 시간은 이력에 기록돼요.</p>
        </ConfirmModal>
      </main>
    </AppLayout>
  )
}

/** 설비 타일 — 상태(가동·비가동·대기·점검)마다 보여주는 내용과 버튼이 다름 */
function EquipTile({ eq, wo, next, openDown, canAct, onEdit, onResume }) {
  const navigate = useNavigate()
  const worker = WORKERS[eq.id]
  const slow = eq.id === 'CNC-03' && eq.status === '가동'
  const tone = eq.status === '비가동' ? 'is-down' : slow ? 'is-warn' : ''
  return (
    <article className={`tile ${tone}`} aria-label={`${eq.id} ${eq.status}`}>
      <header className="tile__head">
        <div>
          <Link to={`/equipment/${eq.id}`} className="tile__id num">{eq.id}</Link>
          <small>{eq.name}</small>
        </div>
        <StatusBadge status={eq.status} tone={EQUIP_TONE[eq.status]} />
      </header>

      {eq.status === '비가동' && (
        <div className="tile__body">
          {wo && <p className="tile__muted num">{wo.id} · {wo.itemName}</p>}
          <p className="tile__down"><strong className="num">{minutesBetween(eq.since)}</strong> 분째 비가동</p>
          <p className="tile__muted">{openDown?.reason ?? eq.note} · {openDown?.by} {openDown?.start.slice(11)} 등록</p>
          {canAct ? (
            <div className="tile__actions">
              <Button onClick={() => onEdit(openDown)} disabled={!openDown}>사유 수정</Button>
              <Button variant="primary" icon="check" onClick={onResume}>재개</Button>
            </div>
          ) : (
            <p className="tile__hint"><Icon name="shield" size={14} /> 조치는 라인 반장 권한이에요</p>
          )}
        </div>
      )}

      {eq.status === '점검' && (
        <div className="tile__body">
          <div className="tile__plan">
            <strong><Icon name="wrench" size={16} /> 계획 정비</strong>
            <span className="num">{eq.note.replace('계획 정비 ', '')}</span>
          </div>
          <p className="tile__muted">가동률 계산에서 제외돼요</p>
        </div>
      )}

      {eq.status === '대기' && (
        <div className="tile__body tile__idle">
          {next ? (
            <>
              <p className="tile__muted">배정된 다음 작업</p>
              <Link to={`/work-orders/${next.id}`} className="cell-link num">{next.id}</Link>
              <strong>{next.itemName}</strong>
              <Button variant="secondary" onClick={() => navigate(`/tablet/${eq.id}`)}>태블릿에서 시작</Button>
            </>
          ) : (
            <>
              <span className="tile__empty-icon"><Icon name="box" size={20} /></span>
              <strong>배정된 작업 없음</strong>
              <p className="tile__muted num">{eq.since.slice(11)}부터 대기{eq.note ? ` · ${eq.note}` : ''}</p>
              {canAct && <Button variant="primary" icon="userp" onClick={() => navigate(`/assignments?equip=${eq.id}`)}>작업 배정</Button>}
            </>
          )}
        </div>
      )}

      {eq.status === '가동' && wo && (
        <div className="tile__body">
          {slow && <Tag tone="warning" icon="alert">사이클 타임 +18%</Tag>}
          <Link to={`/work-orders/${wo.id}`} className="cell-link num">{wo.id}</Link>
          <strong className="tile__item">{wo.itemName}</strong>
          <div className="tile__prog">
            <Meter value={percent(wo.done, wo.qty)} />
            <span className="num">{formatNumber(wo.done)}/{formatNumber(wo.qty)}</span>
          </div>
          <footer className="tile__foot">
            <span className="tile__worker"><Avatar name={worker ?? '작'} size={22} tone="gray" /> {worker}</span>
            <span className="num muted"><Icon name="clock" size={13} /> {formatDuration(minutesBetween(eq.since))}</span>
          </footer>
        </div>
      )}
      {eq.status === '가동' && !wo && <div className="tile__body"><p className="tile__muted">진행 중인 작업 정보가 없어요</p></div>}
    </article>
  )
}
